/**
 * Code Generation Orchestrator - Phase 4 of Four-Phase Agile Workflow
 *
 * Modular orchestrator using sub-workflows for each step.
 * Includes production-readiness fixes: pre-flight validation, circuit breaker, token budgeting.
 *
 * Sub-workflows:
 * - setupCodeGenerationWorkflow: Sync task + status update
 * - contextRetrievalWorkflow: Get technical plan + codebase context + files
 * - ambiguityDetectionWorkflow: V3 pre-generation analysis
 * - generateCodeWorkflow: AI code generation
 * - containerValidationWorkflow: Lint/typecheck/test in Docker
 * - solutionDetectionWorkflow: V3 post-failure solution choice
 * - preApprovalWorkflow: V3 pre-PR approval
 * - commitPRWorkflow: Create branch + commit + PR
 * - finalizationWorkflow: Status update + metrics
 */

import {
  executeChild,
  ApplicationFailure,
  proxyActivities,
  workflowInfo,
  setHandler,
  condition,
} from '@temporalio/workflow';
import type { WorkflowConfig, CodeGenerationPhaseConfig, GeneratedFile } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';
import type * as progressActivities from '../../activities/workflow-progress.activities';
import type * as preflightActivities from '../../activities/preflight-validation.activities';

// V3: Import signal definition
import {
  codeQuestionResponseSignal,
  CodeQuestionResponsePayload,
} from '../signals/code-question-response.signal';

// Import sub-workflows
import { setupCodeGenerationWorkflow } from '../steps/code-generation/setup.workflow';
import { contextRetrievalWorkflow } from '../steps/code-generation/context-retrieval.workflow';
import { ambiguityDetectionWorkflow } from '../steps/code-generation/ambiguity-detection.workflow';
import { generateCodeWorkflow } from '../steps/code-generation/generate-code.workflow';
import { containerValidationWorkflow } from '../steps/code-generation/container-validation.workflow';
import { solutionDetectionWorkflow } from '../steps/code-generation/solution-detection.workflow';
import { preApprovalWorkflow } from '../steps/code-generation/pre-approval.workflow';
import { commitPRWorkflow } from '../steps/code-generation/commit-pr.workflow';
import { finalizationWorkflow } from '../steps/code-generation/finalization.workflow';
import { updateLinearStatusWorkflow } from '../steps/common/update-linear-status.workflow';

// ============================================
// Types
// ============================================

export interface CodeGenerationOrchestratorInput {
  taskId: string;
  projectId: string;
  config?: WorkflowConfig;
}

export interface CodeGenerationOrchestratorResult {
  success: boolean;
  phase: 'code_generation';
  message: string;
  pr?: {
    number: number;
    url: string;
    draft: boolean;
  };
  generatedFiles?: number;
  containerResult?: {
    success: boolean;
    failedPhase?: string;
    duration: number;
  };
  retryMetrics?: {
    totalAttempts: number;
    validationRetries: number;
  };
  interactiveMetrics?: {
    ambiguitiesDetected: number;
    clarificationQuestions: number;
    solutionChoices: number;
    approvalRequested: boolean;
    humanResponsesReceived: number;
  };
}

// ============================================
// Main Orchestrator
// ============================================

/**
 * Code Generation Orchestrator
 *
 * Coordinates sub-workflows for Phase 4 code generation.
 * Includes pre-flight validation and signal handling for V3 interactive features.
 */
export async function codeGenerationOrchestrator(
  input: CodeGenerationOrchestratorInput
): Promise<CodeGenerationOrchestratorResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  // Get automation config with defaults
  const automation: CodeGenerationPhaseConfig =
    config.automation?.phases?.codeGeneration || DEFAULT_AUTOMATION_CONFIG.phases.codeGeneration;
  const features = automation.features;

  // Configure progress logging activities
  const { logWorkflowFailure, logWorkflowProgress } = proxyActivities<typeof progressActivities>({
    startToCloseTimeout: '10 seconds',
    retry: { maximumAttempts: 3 },
  });

  // Configure pre-flight validation activities
  const { validatePrerequisites } = proxyActivities<typeof preflightActivities>({
    startToCloseTimeout: '1 minute',
    retry: { maximumAttempts: 1 }, // Don't retry - fail fast
  });

  const workflowId = workflowInfo().workflowId;
  const projectId = input.projectId;
  const taskId = input.taskId;
  const workflowStartTime = new Date();

  // V2: Track retry metrics
  let retryCount = 0;
  let errorContext = '';

  // V3: Track interactive metrics
  const interactiveMetrics = {
    ambiguitiesDetected: 0,
    clarificationQuestions: 0,
    solutionChoices: 0,
    approvalRequested: false,
    humanResponsesReceived: 0,
  };

  // V3: Signal handler state with question ID tracking to prevent race conditions
  let pendingQuestionId: string | null = null;
  let questionResponse: CodeQuestionResponsePayload | null = null;

  // V3: Set up signal handler for code question responses
  // Uses questionId matching to prevent race conditions between multiple questions
  setHandler(codeQuestionResponseSignal, (payload: CodeQuestionResponsePayload) => {
    // Only accept responses for the current pending question
    if (pendingQuestionId && payload.questionId === pendingQuestionId) {
      questionResponse = payload;
    } else if (!pendingQuestionId) {
      questionResponse = payload;
    }
    // Ignore responses for other question IDs (stale responses)
  });

  // V3: Helper to wait for question response with timeout
  // Now uses questionId to match responses to specific questions
  async function waitForQuestionResponse(
    questionId: string,
    timeoutHours: number
  ): Promise<CodeQuestionResponsePayload | null> {
    const timeoutMs = timeoutHours * 60 * 60 * 1000;

    // Set the pending question ID and reset response atomically
    pendingQuestionId = questionId;
    questionResponse = null;

    // Wait for a response matching this question ID
    const gotResponse = await condition(
      () => questionResponse !== null && questionResponse.questionId === questionId,
      timeoutMs
    );

    // Clear pending question ID
    pendingQuestionId = null;

    if (gotResponse && questionResponse && questionResponse.questionId === questionId) {
      interactiveMetrics.humanResponsesReceived++;
      const response = questionResponse;
      questionResponse = null;
      return response;
    }

    return null;
  }

  // Calculate total steps based on enabled features
  let totalSteps = 10; // Base steps
  if (features.enableAmbiguityDetection) totalSteps += 2;
  if (features.enableSolutionChoice) totalSteps += 2;
  if (features.enablePrePRApproval) totalSteps += 2;
  if (features.enableContainerExecution) totalSteps += 2;

  let currentStep = 0;

  try {
    // ========================================
    // Phase 0: Pre-flight Validation
    // ========================================

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Pre-flight Validation',
      stepNumber: 0,
      totalSteps,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const preflightStart = Date.now();
    const preflightResult = await validatePrerequisites({
      projectId,
      taskId,
    });

    if (!preflightResult.success) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: 'code_generation',
        stepName: 'Pre-flight Validation',
        stepNumber: 0,
        totalSteps,
        status: 'failed',
        startedAt: new Date(preflightStart),
        completedAt: new Date(),
        metadata: {
          checks: preflightResult.checks.map(c => ({
            name: c.name,
            passed: c.passed,
            error: c.error,
          })),
          failureSummary: preflightResult.failureSummary,
        },
      });

      throw ApplicationFailure.create({
        message: `Pre-flight validation failed: ${preflightResult.failureSummary}`,
        type: 'PreflightValidationFailure',
        nonRetryable: true,
      });
    }

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Pre-flight Validation',
      stepNumber: 0,
      totalSteps,
      status: 'completed',
      startedAt: new Date(preflightStart),
      completedAt: new Date(),
      metadata: {
        totalDurationMs: preflightResult.totalDurationMs,
        checksRun: preflightResult.checks.length,
      },
    });

    // ========================================
    // Phase A: Setup
    // ========================================

    currentStep++;
    const setupResult = await executeChild(setupCodeGenerationWorkflow, {
      workflowId: `setup-${taskId}-${Date.now()}`,
      args: [
        {
          projectId,
          taskId,
          config,
          parentWorkflowId: workflowId,
        },
      ],
    });

    const task = setupResult.task;

    // ========================================
    // Phase A: Context Retrieval
    // ========================================

    currentStep++;
    const contextResult = await executeChild(contextRetrievalWorkflow, {
      workflowId: `context-${taskId}-${Date.now()}`,
      args: [
        {
          projectId,
          taskId,
          linearId: task.linearId,
          config,
          parentWorkflowId: workflowId,
        },
      ],
    });

    const parsedPlan = contextResult.technicalPlan;
    const codebaseContextString = contextResult.codebaseContext
      ?.map((c) => `${c.filePath}:\n${c.content}`)
      .join('\n\n');

    // Convert ParsedTechnicalPlan to TechnicalPlanGenerationOutput format
    const technicalPlanForActivities = {
      architecture: parsedPlan.architecture?.map(a => a.approach) || [],
      implementationSteps: parsedPlan.implementationSteps?.map(s => `${s.title}: ${s.description}`) || [],
      testingStrategy: parsedPlan.testingStrategy
        ? `Unit: ${parsedPlan.testingStrategy.unitTests?.join(', ') || 'N/A'}, ` +
          `Integration: ${parsedPlan.testingStrategy.integrationTests?.join(', ') || 'N/A'}`
        : '',
      risks: parsedPlan.risks || [],
      filesAffected: parsedPlan.filesAffected || [],
      dependencies: [],
      technicalDecisions: [],
      estimatedTime: 0,
    };

    // ========================================
    // Phase B: Ambiguity Detection (V3)
    // ========================================

    if (features.enableAmbiguityDetection) {
      currentStep++;
      const ambiguityResult = await executeChild(ambiguityDetectionWorkflow, {
        workflowId: `ambiguity-${taskId}-${Date.now()}`,
        args: [
          {
            projectId,
            taskId,
            linearId: task.linearId,
            config,
            parentWorkflowId: workflowId,
            organizationId: undefined,
            task: {
              id: task.id,
              linearId: task.linearId,
              title: task.title,
              description: task.description || '',
              identifier: task.identifier,
            },
            technicalPlan: technicalPlanForActivities,
            codebaseContext: codebaseContextString,
            stepNumber: currentStep,
            totalSteps,
          },
        ],
      });

      interactiveMetrics.ambiguitiesDetected = ambiguityResult.detectionResult?.ambiguityCount || 0;

      // Wait for response if question was posted
      if (ambiguityResult.waitingForResponse && ambiguityResult.questionId) {
        interactiveMetrics.clarificationQuestions++;
        currentStep++;

        const timeoutHours = features.humanResponseTimeoutHours || 24;
        const response = await waitForQuestionResponse(
          ambiguityResult.questionId,
          timeoutHours
        );

        if (response) {
          const selectedOpt = ambiguityResult.options?.find(
            (o) => o.id === response.selectedOption
          );
          if (selectedOpt) {
            errorContext += `\n\nUser selected clarification: ${selectedOpt.label}\n${selectedOpt.description}`;
          } else if (response.customText) {
            errorContext += `\n\nUser provided custom clarification: ${response.customText}`;
          }
        } else if (features.autoProceedOnTimeout) {
          const recommended = ambiguityResult.options?.find((o) => o.recommended);
          if (recommended) {
            errorContext += `\n\nAuto-selected recommended option: ${recommended.label}\n${recommended.description}`;
          }
        }
      }
    }

    // ========================================
    // Phase C: Generation Loop
    // ========================================

    const maxRetries = features.maxRetries ?? 3;
    let generatedFiles: GeneratedFile[] = [];
    let containerSuccess = true;
    let lastContainerDuration = 0;
    let lastFailedPhase: string | undefined;

    while (retryCount <= maxRetries) {
      currentStep++;

      // Generate code
      const codeResult = await executeChild(generateCodeWorkflow, {
        workflowId: `generate-${taskId}-${retryCount}-${Date.now()}`,
        args: [
          {
            projectId,
            taskId,
            config,
            parentWorkflowId: workflowId,
            organizationId: undefined,
            task: {
              id: task.id,
              linearId: task.linearId,
              title: task.title,
              description: task.description || '',
              identifier: task.identifier,
            },
            technicalPlan: technicalPlanForActivities,
            codebaseContext: codebaseContextString,
            fullFileContents: contextResult.fullFileContents,
            errorContext,
            previousAttempts: retryCount,
            maxRetries,
          },
        ],
      });

      generatedFiles = codeResult.files;

      // Container validation (if enabled)
      if (features.enableContainerExecution) {
        currentStep++;

        const containerResult = await executeChild(containerValidationWorkflow, {
          workflowId: `container-${taskId}-${retryCount}-${Date.now()}`,
          args: [
            {
              projectId,
              taskId,
              config,
              parentWorkflowId: workflowId,
              organizationId: undefined,
              generatedFiles,
              enableLint: features.enableLintCheck ?? true,
              enableTypecheck: features.enableTypecheckCheck ?? true,
              enableTests: features.enableTestExecution ?? true,
              containerImage: features.containerImage,
              containerMemory: features.containerMemory,
              containerTimeoutMinutes: features.containerTimeoutMinutes,
              attemptNumber: retryCount,
            },
          ],
        });

        containerSuccess = containerResult.success;
        lastContainerDuration = containerResult.duration;
        lastFailedPhase = containerResult.failedPhase;

        if (containerSuccess) {
          break; // Exit retry loop
        }

        // Handle failure - solution detection (V3)
        if (features.enableSolutionChoice && retryCount < maxRetries) {
          currentStep++;

          const solutionResult = await executeChild(solutionDetectionWorkflow, {
            workflowId: `solution-${taskId}-${retryCount}-${Date.now()}`,
            args: [
              {
                projectId,
                taskId,
                linearId: task.linearId,
                config,
                parentWorkflowId: workflowId,
                organizationId: undefined,
                task: {
                  id: task.id,
                  linearId: task.linearId,
                  title: task.title,
                  identifier: task.identifier,
                },
                generatedFiles,
                containerResult: containerResult.containerResult,
                technicalPlan: technicalPlanForActivities,
                codebaseContext: codebaseContextString,
                attemptNumber: retryCount,
                maxAttempts: maxRetries,
                stepNumber: currentStep,
                totalSteps,
              },
            ],
          });

          if (solutionResult.waitingForResponse && solutionResult.questionId) {
            interactiveMetrics.solutionChoices++;
            currentStep++;

            const timeoutHours = features.humanResponseTimeoutHours || 24;
            const response = await waitForQuestionResponse(
              solutionResult.questionId!,
              timeoutHours
            );

            if (response) {
              const selectedSol = solutionResult.options?.find(
                (o) => o.id === response.selectedOption
              );
              if (selectedSol) {
                errorContext = `User selected solution: ${selectedSol.label}\n${selectedSol.description}`;
              } else if (response.customText) {
                errorContext = `User provided custom fix: ${response.customText}`;
              }
            } else if (features.autoProceedOnTimeout) {
              const recommended = solutionResult.options?.find((o) => o.recommended);
              if (recommended) {
                errorContext = `Auto-selected recommended solution: ${recommended.label}\n${recommended.description}`;
              }
            }
          } else if (solutionResult.singleSolutionContext) {
            errorContext = solutionResult.singleSolutionContext;
          }
        } else if (containerResult.failureAnalysis) {
          errorContext = containerResult.failureAnalysis.retryPromptEnhancement;
        }

        retryCount++;
      } else {
        // No container execution - exit loop
        break;
      }
    }

    // ========================================
    // Phase D: Pre-PR Approval (V3)
    // ========================================

    if (features.enablePrePRApproval) {
      currentStep++;
      interactiveMetrics.approvalRequested = true;

      const approvalResult = await executeChild(preApprovalWorkflow, {
        workflowId: `approval-${taskId}-${Date.now()}`,
        args: [
          {
            projectId,
            taskId,
            linearId: task.linearId,
            config,
            parentWorkflowId: workflowId,
            task: {
              id: task.id,
              linearId: task.linearId,
              title: task.title,
              identifier: task.identifier,
            },
            generatedFiles,
            branchName: `feat/${task.identifier.toLowerCase()}`,
            prTitle: `feat: ${task.identifier} - ${task.title}`,
            commitMessage: `feat(${task.identifier}): implement ${task.title}`,
            validationSummary: features.enableContainerExecution
              ? {
                  success: containerSuccess,
                  testsRun: 0,
                  testsPassed: 0,
                  lintPassed: containerSuccess || lastFailedPhase !== 'lint',
                  typecheckPassed: containerSuccess || lastFailedPhase !== 'typecheck',
                }
              : undefined,
            stepNumber: currentStep,
            totalSteps,
          },
        ],
      });

      currentStep++;
      const timeoutHours = features.humanResponseTimeoutHours || 24;
      const response = await waitForQuestionResponse(
        approvalResult.questionId || `approval-${taskId}`,
        timeoutHours
      );

      if (response?.responseType === 'rejected') {
        // User rejected - fail the workflow
        throw ApplicationFailure.create({
          message: `Pre-PR approval rejected: ${response.customText || 'No reason provided'}`,
          type: 'PreApprovalRejected',
        });
      }
    }

    // ========================================
    // Phase E: Commit & PR
    // ========================================

    currentStep++;
    const prResult = await executeChild(commitPRWorkflow, {
      workflowId: `commit-pr-${taskId}-${Date.now()}`,
      args: [
        {
          projectId,
          taskId,
          config,
          parentWorkflowId: workflowId,
          task: {
            id: task.id,
            linearId: task.linearId,
            title: task.title,
            identifier: task.identifier,
          },
          generatedFiles,
          branchName: `feat/${task.identifier.toLowerCase()}`,
          commitMessage: `feat(${task.identifier}): implement ${task.title}`,
          prTitle: `feat: ${task.identifier} - ${task.title}`,
          prDescription: `Implementation for ${task.identifier}\n\n${task.description || ''}`,
          targetBranch: 'main',
          containerResult: features.enableContainerExecution
            ? {
                success: containerSuccess,
                duration: lastContainerDuration,
                exitCode: 0,
                phases: {},
                logs: '',
              }
            : undefined,
          retryMetrics: {
            totalAttempts: retryCount + 1,
            validationRetries: retryCount,
          },
          interactiveMetrics: {
            ambiguitiesDetected: interactiveMetrics.ambiguitiesDetected,
            clarificationQuestions: interactiveMetrics.clarificationQuestions,
            solutionChoices: interactiveMetrics.solutionChoices,
            approvalRequested: interactiveMetrics.approvalRequested,
          },
        },
      ],
    });

    // ========================================
    // Phase F: Finalization
    // ========================================

    currentStep++;
    await executeChild(finalizationWorkflow, {
      workflowId: `finalize-${taskId}-${Date.now()}`,
      args: [
        {
          projectId,
          taskId,
          linearId: task.linearId,
          config,
          parentWorkflowId: workflowId,
          workflowStartTime,
          pr: {
            number: prResult.number,
            url: prResult.url,
            draft: prResult.draft,
          },
          containerResult: features.enableContainerExecution
            ? {
                success: containerSuccess,
                failedPhase: lastFailedPhase,
                duration: lastContainerDuration,
              }
            : undefined,
          retryMetrics: {
            totalAttempts: retryCount + 1,
            validationRetries: retryCount,
          },
          interactiveMetrics,
        },
      ],
    });

    return {
      success: true,
      phase: 'code_generation',
      message: `Code generated and draft PR created for task ${task.identifier}`,
      pr: {
        number: prResult.number,
        url: prResult.url,
        draft: prResult.draft,
      },
      generatedFiles: generatedFiles.length,
      containerResult: features.enableContainerExecution
        ? {
            success: containerSuccess,
            failedPhase: lastFailedPhase,
            duration: lastContainerDuration,
          }
        : undefined,
      retryMetrics: {
        totalAttempts: retryCount + 1,
        validationRetries: retryCount,
      },
      interactiveMetrics,
    };
  } catch (error) {
    // Log workflow failure
    await logWorkflowFailure({
      workflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      error: error instanceof Error ? error.message : 'Unknown error',
      stepName: 'Workflow Failed',
    });

    // Update status to Failed (if enabled)
    if (features.enableAutoStatusUpdate) {
      try {
        await executeChild(updateLinearStatusWorkflow, {
          workflowId: `status-failed-${taskId}-${Date.now()}`,
          args: [
            {
              projectId,
              linearId: input.taskId, // Use taskId as linearId fallback
              status: LINEAR_STATUSES.codeFailed,
            },
          ],
        });
      } catch {
        // Ignore status update errors
      }
    }

    throw ApplicationFailure.create({
      message: `Code generation orchestrator failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'CodeGenerationOrchestratorFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
