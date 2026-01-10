/**
 * Code Generation Orchestrator - Phase 4 V2 of Four-Phase Agile Workflow
 *
 * Coordinates code generation from technical plan using local LLM (Ollama).
 * Privacy-first: All inference runs locally, no cloud fallback.
 *
 * V2 Steps (14 steps with container execution and retry loop):
 * Phase A: Setup
 * 1. Sync task from Linear
 * 2. Update status to Code In Progress
 * 3. Get technical plan document (Phase 3)
 * 4. Parse technical plan (local function)
 * 5. Get codebase context document (optional - RAG chunks)
 * 6. Fetch full file contents from GitHub (for files to be modified)
 *
 * Phase B: Generation Loop (with retry)
 * 7. Generate code (Ollama - local LLM)
 *
 * Phase C: Container Execution (V2)
 * 8. Execute in container (clone, apply files, lint, typecheck, test)
 * 9. Analyze failures with AI (if failed, retry up to maxRetries)
 *
 * Phase D: Commit & PR
 * 10. Create branch
 * 11. Commit files
 * 12. Create draft PR
 *
 * Phase E: Finalization
 * 13. Update status to Code Review
 * 14. Log completion metrics
 */

import { executeChild, ApplicationFailure, proxyActivities, workflowInfo } from '@temporalio/workflow';
import type { WorkflowConfig, CodeGenerationPhaseConfig, TechnicalPlanGenerationOutput, GeneratedFile, ExecuteInContainerOutput } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';
import type * as progressActivities from '../../activities/workflow-progress.activities';
import type * as codeGenActivities from '../../activities/code-generation.activities';
import type * as containerActivities from '../../activities/container-execution.activities';
import type * as vcsActivities from '../../activities/vcs.activities';

// Import common step workflows
import { syncLinearTaskWorkflow } from '../steps/common/sync-linear-task.workflow';
import { updateLinearStatusWorkflow } from '../steps/common/update-linear-status.workflow';
import { getPhaseDocumentWorkflow } from '../steps/common/get-phase-document.workflow';

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
  /** V2: Container execution result */
  containerResult?: {
    success: boolean;
    failedPhase?: string;
    duration: number;
  };
  /** V2: Retry metrics */
  retryMetrics?: {
    totalAttempts: number;
    validationRetries: number;
  };
}

/**
 * Parse technical plan from Linear Document content
 */
function parseTechnicalPlanFromDocument(documentContent: string): TechnicalPlanGenerationOutput {
  // Default empty plan
  const defaultPlan: TechnicalPlanGenerationOutput = {
    architecture: [],
    implementationSteps: [],
    testingStrategy: '',
    risks: [],
    filesAffected: [],
    dependencies: [],
    technicalDecisions: [],
    estimatedTime: 0,
  };

  if (!documentContent) return defaultPlan;

  try {
    // Extract architecture decisions
    const archMatch = documentContent.match(/## Architecture Decisions?\n\n([\s\S]*?)(?=\n## |$)/);
    const architecture = archMatch
      ? archMatch[1]
          .split('\n')
          .filter((line) => line.match(/^\d+\./))
          .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      : [];

    // Extract implementation steps
    const stepsMatch = documentContent.match(/## Implementation Steps?\n\n([\s\S]*?)(?=\n## |$)/);
    const implementationSteps = stepsMatch
      ? stepsMatch[1]
          .split('\n')
          .filter((line) => line.match(/^\d+\./))
          .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      : [];

    // Extract testing strategy
    const testingMatch = documentContent.match(/## Testing Strategy\n\n([\s\S]*?)(?=\n## |$)/);
    const testingStrategy = testingMatch ? testingMatch[1].trim() : '';

    // Extract risks
    const risksMatch = documentContent.match(/## Risks?\s*(?:& Mitigations?)?\n\n([\s\S]*?)(?=\n## |$)/);
    const risks = risksMatch
      ? risksMatch[1]
          .split('\n')
          .filter((line) => line.match(/^[-•*]|\d+\./))
          .map((line) => line.replace(/^[-•*]\s*|\d+\.\s*/, '').trim())
      : [];

    // Extract files affected
    const filesMatch = documentContent.match(/## Files? (?:Affected|to (?:Modify|Create))\n\n([\s\S]*?)(?=\n## |$)/);
    const filesAffected = filesMatch
      ? filesMatch[1]
          .split('\n')
          .filter((line) => line.match(/^[-•*]/))
          .map((line) => line.replace(/^[-•*]\s*/, '').replace(/`/g, '').trim())
      : [];

    // Extract dependencies
    const depsMatch = documentContent.match(/## Dependencies?\n\n([\s\S]*?)(?=\n## |$)/);
    const dependencies = depsMatch
      ? depsMatch[1]
          .split('\n')
          .filter((line) => line.match(/^[-•*]/))
          .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      : [];

    // Extract technical decisions
    const decisionsMatch = documentContent.match(/## Technical Decisions?\n\n([\s\S]*?)(?=\n## |$)/);
    const technicalDecisions = decisionsMatch
      ? decisionsMatch[1]
          .split('\n')
          .filter((line) => line.match(/^\d+\./))
          .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      : [];

    // Extract estimated time (in hours)
    const timeMatch = documentContent.match(/\*\*Estimated Time:\*\*\s*(\d+)/);
    const estimatedTime = timeMatch ? parseInt(timeMatch[1], 10) : 0;

    return {
      architecture,
      implementationSteps,
      testingStrategy,
      risks,
      filesAffected,
      dependencies,
      technicalDecisions,
      estimatedTime,
    };
  } catch (error) {
    console.error('[parseTechnicalPlanFromDocument] Failed to parse:', error);
    return defaultPlan;
  }
}

/**
 * Parse Codebase Context document back to RAG-like format
 */
function parseCodebaseContextDocument(documentContent: string): {
  chunks: Array<{
    filePath: string;
    content: string;
    score: number;
    language: string;
  }>;
} | null {
  if (!documentContent) return null;

  const chunks: Array<{
    filePath: string;
    content: string;
    score: number;
    language: string;
  }> = [];

  const sectionRegex =
    /###\s*\d+\.\s*`([^`]+)`\n\n\*\*Score:\*\*\s*([\d.]+)%\s*\|\s*\*\*Language:\*\*\s*(\w+)[\s\S]*?```\w*\n([\s\S]*?)```/g;

  let match;
  while ((match = sectionRegex.exec(documentContent)) !== null) {
    const [, filePath, scoreStr, language, content] = match;

    chunks.push({
      filePath,
      content: content.trim(),
      score: parseFloat(scoreStr) / 100,
      language,
    });
  }

  if (chunks.length === 0) return null;

  return { chunks };
}

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
  const { logWorkflowProgress, logWorkflowFailure, logWorkflowCompletion } = proxyActivities<typeof progressActivities>({
    startToCloseTimeout: '10 seconds',
    retry: { maximumAttempts: 3 },
  });

  // Configure code generation activities (long timeout for Ollama)
  const { generateCodeFromPlan, fetchFilesFromGitHub, analyzeFailuresWithAI } = proxyActivities<typeof codeGenActivities>({
    startToCloseTimeout: '15 minutes', // Long timeout for local LLM inference
    retry: { maximumAttempts: 2 },
  });

  // Configure container execution activities (V2)
  const { executeInContainer, getDefaultCommands, getDefaultImage } = proxyActivities<typeof containerActivities>({
    startToCloseTimeout: '15 minutes', // Long timeout for container execution
    retry: { maximumAttempts: 1 }, // Don't retry container execution - we handle retries in the workflow
  });

  // Configure VCS activities
  const { createBranch, commitFiles, createPullRequest } = proxyActivities<typeof vcsActivities>({
    startToCloseTimeout: '2 minutes',
    retry: { maximumAttempts: 3 },
  });

  const workflowId = workflowInfo().workflowId;
  const TOTAL_STEPS = features.enableContainerExecution ? 14 : 9; // V2 has 14 steps with container
  const PHASE = 'code_generation' as const;
  const projectId = input.projectId;
  const taskId = input.taskId;
  const workflowStartTime = new Date();

  // V2: Track retry metrics
  let retryCount = 0;
  let errorContext = '';
  let lastContainerResult: ExecuteInContainerOutput | null = null;

  try {
    // ========================================
    // Phase A: Setup (Steps 1-6)
    // ========================================

    // Step 1: Sync task from Linear
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Sync Linear Task',
      stepNumber: 1,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step1Start = Date.now();
    const task = await executeChild(syncLinearTaskWorkflow, {
      workflowId: `sync-task-${input.taskId}-${Date.now()}`,
      args: [{ taskId: input.taskId, projectId: input.projectId }],
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Sync Linear Task',
      stepNumber: 1,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step1Start),
      completedAt: new Date(),
      metadata: { taskId: task.id, linearId: task.linearId, title: task.title },
    });

    // Step 2: Update status to Code In Progress
    if (features.enableAutoStatusUpdate) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to In Progress',
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step2Start = Date.now();
      await executeChild(updateLinearStatusWorkflow, {
        workflowId: `status-in-progress-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            status: LINEAR_STATUSES.codeInProgress,
          },
        ],
      });

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to In Progress',
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step2Start),
        completedAt: new Date(),
        metadata: { status: LINEAR_STATUSES.codeInProgress },
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to In Progress (disabled)',
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Step 3: Get technical plan document (Phase 3)
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Get Technical Plan Document',
      stepNumber: 3,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step3Start = Date.now();
    const technicalPlanDoc = await executeChild(getPhaseDocumentWorkflow, {
      workflowId: `get-technical-plan-${input.taskId}-${Date.now()}`,
      args: [
        {
          projectId: input.projectId,
          linearId: task.linearId,
          phase: 'technical_plan' as const,
        },
      ],
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Get Technical Plan Document',
      stepNumber: 3,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step3Start),
      completedAt: new Date(),
      metadata: { hasDocument: !!technicalPlanDoc.content, contentLength: technicalPlanDoc.content?.length || 0 },
    });

    // Step 4: Parse technical plan (local function)
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Parse Technical Plan',
      stepNumber: 4,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step4Start = Date.now();
    const technicalPlan = technicalPlanDoc.content
      ? parseTechnicalPlanFromDocument(technicalPlanDoc.content)
      : {
          architecture: [],
          implementationSteps: [],
          testingStrategy: '',
          risks: [],
          filesAffected: [],
          dependencies: [],
          technicalDecisions: [],
          estimatedTime: 0,
        };

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Parse Technical Plan',
      stepNumber: 4,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step4Start),
      completedAt: new Date(),
      metadata: {
        architectureCount: technicalPlan.architecture?.length || 0,
        stepsCount: technicalPlan.implementationSteps?.length || 0,
        filesCount: technicalPlan.filesAffected?.length || 0,
      },
    });

    // Step 5: Get codebase context document (conditional)
    let ragContext: ReturnType<typeof parseCodebaseContextDocument> = null;
    if (features.reuseCodebaseContext) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Codebase Context Document',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step5Start = Date.now();
      const codebaseContextDoc = await executeChild(getPhaseDocumentWorkflow, {
        workflowId: `get-codebase-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            phase: 'codebase_context' as const,
          },
        ],
      });

      ragContext = codebaseContextDoc.content
        ? parseCodebaseContextDocument(codebaseContextDoc.content)
        : null;

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Codebase Context Document',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step5Start),
        completedAt: new Date(),
        metadata: { hasContext: !!ragContext, chunksCount: ragContext?.chunks?.length || 0 },
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Codebase Context Document (disabled)',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Step 6: Fetch full file contents from GitHub (for better Ollama context)
    let fullFileContents: Array<{ path: string; content: string }> = [];
    const filesAffected = technicalPlan.filesAffected || [];

    if (filesAffected.length > 0) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Fetch Full Files from GitHub',
        stepNumber: 6,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step6Start = Date.now();
      const fetchResult = await fetchFilesFromGitHub({
        projectId: input.projectId,
        filePaths: filesAffected,
      });

      fullFileContents = fetchResult.files;

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Fetch Full Files from GitHub',
        stepNumber: 6,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step6Start),
        completedAt: new Date(),
        metadata: {
          filesRequested: filesAffected.length,
          filesFetched: fullFileContents.length,
          filesNotFound: fetchResult.notFound.length,
          notFoundFiles: fetchResult.notFound,
        },
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Fetch Full Files from GitHub (no files specified)',
        stepNumber: 6,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // ========================================
    // Phase B & C: Generation Loop with Container Execution (Steps 7-9)
    // ========================================

    const maxRetries = features.maxRetries ?? 3;
    let generatedFiles: GeneratedFile[] = [];
    let codeResult: Awaited<ReturnType<typeof generateCodeFromPlan>> | null = null;
    let containerSuccess = true;

    // Generation loop with retry
    while (retryCount <= maxRetries) {
      // Step 7: Generate code (Ollama - local LLM)
      const isRetry = retryCount > 0;
      const step7Name = isRetry
        ? `Generate Code (Retry ${retryCount}/${maxRetries})`
        : 'Generate Code (Ollama - Local LLM)';

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: step7Name,
        stepNumber: 7,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
        metadata: isRetry ? { retryCount, errorContext: errorContext.substring(0, 500) } : undefined,
      });

      const step7Start = Date.now();
      codeResult = await generateCodeFromPlan({
        task: {
          id: task.id,
          linearId: task.linearId,
          title: task.title,
          description: task.description + (errorContext ? `\n\n${errorContext}` : ''),
          identifier: task.identifier,
        },
        technicalPlan,
        projectId: input.projectId,
        taskId: input.taskId,
        workflowId,
        ragContext: ragContext ?? undefined,
        fullFileContents: fullFileContents.length > 0 ? fullFileContents : undefined,
        aiModel: automation.aiModel,
      });

      generatedFiles = codeResult.code.files;

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: step7Name,
        stepNumber: 7,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step7Start),
        completedAt: new Date(),
        metadata: {
          filesGenerated: generatedFiles.length,
          branchName: codeResult.code.branchName,
          fullFilesProvided: fullFileContents.length,
          ai: codeResult.aiMetrics,
          result: codeResult.resultSummary,
          retryCount,
        },
      });

      // ========================================
      // V2: Container Execution (Step 8)
      // ========================================

      if (features.enableContainerExecution) {
        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Execute in Container (Clone, Lint, Typecheck, Test)',
          stepNumber: 8,
          totalSteps: TOTAL_STEPS,
          status: 'in_progress',
          startedAt: new Date(),
          metadata: { retryCount, fileCount: generatedFiles.length },
        });

        const step8Start = Date.now();

        try {
          lastContainerResult = await executeInContainer({
            projectId: input.projectId,
            taskId: input.taskId,
            generatedFiles,
            commands: {
              install: 'npm ci',
              lint: features.enableLintCheck ? 'npm run lint --if-present' : undefined,
              typecheck: features.enableTypecheckCheck ? 'npm run typecheck --if-present' : undefined,
              test: features.enableTestExecution ? 'npm test --if-present' : undefined,
            },
            containerConfig: {
              image: features.containerImage || 'node:20-alpine',
              memory: features.containerMemory || '2g',
              timeout: (features.containerTimeoutMinutes || 10) * 60 * 1000,
            },
          });

          containerSuccess = lastContainerResult.success;

          await logWorkflowProgress({
            workflowId,
            projectId,
            taskId,
            phase: PHASE,
            stepName: 'Execute in Container (Clone, Lint, Typecheck, Test)',
            stepNumber: 8,
            totalSteps: TOTAL_STEPS,
            status: containerSuccess ? 'completed' : 'failed',
            startedAt: new Date(step8Start),
            completedAt: new Date(),
            metadata: {
              success: containerSuccess,
              duration: lastContainerResult.duration,
              failedPhase: lastContainerResult.failedPhase,
              exitCode: lastContainerResult.exitCode,
              testResults: lastContainerResult.testResults,
            },
          });

          // If container execution succeeded, break the retry loop
          if (containerSuccess) {
            break;
          }

          // V2: Analyze failures with AI (Step 9)
          if (retryCount < maxRetries) {
            await logWorkflowProgress({
              workflowId,
              projectId,
              taskId,
              phase: PHASE,
              stepName: 'Analyze Failures with AI',
              stepNumber: 9,
              totalSteps: TOTAL_STEPS,
              status: 'in_progress',
              startedAt: new Date(),
              metadata: { failedPhase: lastContainerResult.failedPhase, retryCount },
            });

            const step9Start = Date.now();
            const analysis = await analyzeFailuresWithAI({
              projectId: input.projectId,
              taskId: input.taskId,
              generatedFiles,
              containerResult: lastContainerResult,
              previousAttempts: retryCount,
              originalPromptContext: {
                technicalPlan: {
                  architecture: technicalPlan.architecture || [],
                  implementationSteps: technicalPlan.implementationSteps || [],
                  testingStrategy: technicalPlan.testingStrategy || '',
                  risks: technicalPlan.risks || [],
                },
              },
              workflowId,
            });

            errorContext = analysis.retryPromptEnhancement;

            await logWorkflowProgress({
              workflowId,
              projectId,
              taskId,
              phase: PHASE,
              stepName: 'Analyze Failures with AI',
              stepNumber: 9,
              totalSteps: TOTAL_STEPS,
              status: 'completed',
              startedAt: new Date(step9Start),
              completedAt: new Date(),
              metadata: {
                failedPhase: analysis.failedPhase,
                confidence: analysis.confidence,
                suggestedFixes: analysis.suggestedFixes.length,
                analysis: analysis.analysis.substring(0, 500),
              },
            });

            retryCount++;
            continue; // Retry generation
          }
        } catch (containerError) {
          // Container execution failed entirely - log and continue to PR creation
          containerSuccess = false;
          await logWorkflowProgress({
            workflowId,
            projectId,
            taskId,
            phase: PHASE,
            stepName: 'Execute in Container (Clone, Lint, Typecheck, Test)',
            stepNumber: 8,
            totalSteps: TOTAL_STEPS,
            status: 'failed',
            startedAt: new Date(step8Start),
            completedAt: new Date(),
            metadata: {
              error: containerError instanceof Error ? containerError.message : 'Unknown error',
            },
          });
        }
      }

      break; // Exit retry loop if container execution is disabled or max retries reached
    }

    // ========================================
    // Phase D: Commit & PR (Steps 10-12)
    // ========================================

    if (!codeResult) {
      throw new Error('Code generation failed - no result');
    }

    // Step 10: Create branch
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Create Branch',
      stepNumber: 10,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step10Start = Date.now();
    await createBranch({
      projectId: input.projectId,
      branchName: codeResult.code.branchName,
      baseBranch: 'main', // TODO: Get from project config
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Create Branch',
      stepNumber: 10,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step10Start),
      completedAt: new Date(),
      metadata: { branchName: codeResult.code.branchName },
    });

    // Step 11: Commit files
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Commit Generated Files',
      stepNumber: 11,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step11Start = Date.now();
    await commitFiles({
      projectId: input.projectId,
      branchName: codeResult.code.branchName,
      files: generatedFiles.map((f) => ({
        path: f.path,
        content: f.content,
      })),
      message: codeResult.code.commitMessage,
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Commit Generated Files',
      stepNumber: 11,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step11Start),
      completedAt: new Date(),
      metadata: { filesCommitted: generatedFiles.length },
    });

    // Step 12: Create draft PR
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Create Draft PR',
      stepNumber: 12,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step12Start = Date.now();

    // Build PR description with container results if available
    let prDescription = codeResult.code.prDescription;
    if (features.enableContainerExecution && lastContainerResult) {
      const containerStatus = containerSuccess ? '✅ All checks passed' : `❌ Failed at: ${lastContainerResult.failedPhase}`;
      prDescription += `\n\n## Container Validation\n\n${containerStatus}\n\n- Retries: ${retryCount}/${maxRetries}`;
      if (lastContainerResult.testResults) {
        prDescription += `\n- Tests: ${lastContainerResult.testResults.passed} passed, ${lastContainerResult.testResults.failed} failed`;
      }
    }

    const pr = await createPullRequest({
      projectId: input.projectId,
      branchName: codeResult.code.branchName,
      title: codeResult.code.prTitle,
      description: prDescription,
      targetBranch: 'main', // TODO: Get from project config
      draft: true, // Always draft for safety - requires human review
      linearIdentifier: task.identifier,
      labels: ['auto-generated', 'devflow-phase-4', containerSuccess ? 'checks-passed' : 'checks-failed'],
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Create Draft PR',
      stepNumber: 12,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step12Start),
      completedAt: new Date(),
      metadata: { prNumber: pr.number, prUrl: pr.url, draft: pr.draft },
    });

    // ========================================
    // Phase E: Finalization (Steps 13-14)
    // ========================================

    // Step 13: Update status to Code Review
    if (features.enableAutoStatusUpdate) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Code Review',
        stepNumber: 13,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step13Start = Date.now();
      await executeChild(updateLinearStatusWorkflow, {
        workflowId: `status-review-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            status: LINEAR_STATUSES.codeReview,
          },
        ],
      });

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Code Review',
        stepNumber: 13,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step13Start),
        completedAt: new Date(),
        metadata: { status: LINEAR_STATUSES.codeReview },
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Code Review (disabled)',
        stepNumber: 13,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Step 14: Log completion metrics
    await logWorkflowCompletion({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      startedAt: workflowStartTime,
    });

    return {
      success: true,
      phase: 'code_generation',
      message: `Code generated and draft PR created for task ${task.identifier}`,
      pr: {
        number: pr.number,
        url: pr.url,
        draft: pr.draft,
      },
      generatedFiles: generatedFiles.length,
      containerResult: lastContainerResult
        ? {
            success: containerSuccess,
            failedPhase: lastContainerResult.failedPhase,
            duration: lastContainerResult.duration,
          }
        : undefined,
      retryMetrics: {
        totalAttempts: retryCount + 1,
        validationRetries: retryCount,
      },
    };
  } catch (error) {
    // Log workflow failure
    await logWorkflowFailure({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      error: error instanceof Error ? error.message : 'Unknown error',
      stepName: 'Workflow Failed',
    });

    // Update status to Failed (conditional)
    if (features.enableAutoStatusUpdate) {
      try {
        const task = await executeChild(syncLinearTaskWorkflow, {
          workflowId: `sync-task-error-${input.taskId}-${Date.now()}`,
          args: [{ taskId: input.taskId, projectId: input.projectId }],
        });

        await executeChild(updateLinearStatusWorkflow, {
          workflowId: `status-failed-${input.taskId}-${Date.now()}`,
          args: [
            {
              projectId: input.projectId,
              linearId: task.linearId,
              status: LINEAR_STATUSES.codeFailed,
            },
          ],
        });
      } catch (updateError) {
        console.error('[codeGenerationOrchestrator] Failed to update status to Failed:', updateError);
      }
    }

    throw ApplicationFailure.create({
      message: `Code generation orchestrator failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'CodeGenerationOrchestratorFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
