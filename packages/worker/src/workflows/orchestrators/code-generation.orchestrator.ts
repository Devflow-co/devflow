/**
 * Code Generation Orchestrator - Phase 4 V3 of Four-Phase Agile Workflow
 *
 * Coordinates code generation from technical plan using local LLM (Ollama).
 * Privacy-first: All inference runs locally, no cloud fallback.
 *
 * V3 adds interactive features for human-in-the-loop code generation:
 * - Ambiguity detection before generation
 * - Solution choice when validation fails with multiple fixes
 * - Optional pre-PR approval
 *
 * V3 Steps (up to 23 steps with all features enabled):
 * Phase A: Setup (Steps 1-6)
 * 1. Sync task from Linear
 * 2. Update status to Code In Progress
 * 3. Get technical plan document (Phase 3)
 * 4. Parse technical plan (local function)
 * 5. Get codebase context document (optional - RAG chunks)
 * 6. Fetch full file contents from GitHub (for files to be modified)
 *
 * Phase B: Pre-Generation Analysis (V3 - Steps 7-9)
 * 7. Detect ambiguities in technical plan
 * 8. Post clarification question (if ambiguities found)
 * 9. Wait for response signal (with timeout)
 *
 * Phase C: Generation Loop (Steps 10-15)
 * 10. Generate code (Ollama - local LLM)
 * 11. Execute in container (clone, apply files, lint, typecheck, test)
 * 12. Analyze failures (if failed)
 * 13. Detect multiple solutions (V3)
 * 14. Post solution choice question (if multiple solutions)
 * 15. Wait for response signal (with timeout)
 *
 * Phase D: Pre-PR Approval (V3 - Steps 16-18)
 * 16. Generate code preview
 * 17. Post approval question
 * 18. Wait for approval signal (with timeout)
 *
 * Phase E: Commit & PR (Steps 19-21)
 * 19. Create branch
 * 20. Commit files
 * 21. Create draft PR
 *
 * Phase F: Finalization (Steps 22-23)
 * 22. Update status to Code Review
 * 23. Log completion metrics
 */

import { executeChild, ApplicationFailure, proxyActivities, workflowInfo, setHandler, condition } from '@temporalio/workflow';
import type { WorkflowConfig, CodeGenerationPhaseConfig, TechnicalPlanGenerationOutput, GeneratedFile, ExecuteInContainerOutput } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';
import type * as progressActivities from '../../activities/workflow-progress.activities';
import type * as codeGenActivities from '../../activities/code-generation.activities';
import type * as containerActivities from '../../activities/container-execution.activities';
import type * as vcsActivities from '../../activities/vcs.activities';
import type * as interactiveActivities from '../../activities/interactive.activities';

// V3: Import signal definition
import { codeQuestionResponseSignal, CodeQuestionResponsePayload } from '../signals/code-question-response.signal';

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
  /** V3: Interactive metrics */
  interactiveMetrics?: {
    ambiguitiesDetected: number;
    clarificationQuestions: number;
    solutionChoices: number;
    approvalRequested: boolean;
    humanResponsesReceived: number;
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

  // V3: Configure interactive activities
  const { postCodeQuestion, generateCodePreview } = proxyActivities<typeof interactiveActivities>({
    startToCloseTimeout: '30 seconds',
    retry: { maximumAttempts: 2 },
  });

  // V3: Configure ambiguity/solution detection activities
  const { detectAmbiguityBeforeGeneration, detectMultipleSolutions } = proxyActivities<typeof codeGenActivities>({
    startToCloseTimeout: '3 minutes',
    retry: { maximumAttempts: 2 },
  });

  const workflowId = workflowInfo().workflowId;

  // V3: Calculate total steps based on enabled features
  let TOTAL_STEPS = 14; // Base V2 steps
  if (features.enableAmbiguityDetection) TOTAL_STEPS += 3; // Steps 7-9
  if (features.enableSolutionChoice) TOTAL_STEPS += 3; // Steps in retry loop
  if (features.enablePrePRApproval) TOTAL_STEPS += 3; // Steps 16-18
  const PHASE = 'code_generation' as const;
  const projectId = input.projectId;
  const taskId = input.taskId;
  const workflowStartTime = new Date();

  // V2: Track retry metrics
  let retryCount = 0;
  let errorContext = '';
  let lastContainerResult: ExecuteInContainerOutput | null = null;

  // V3: Track interactive metrics
  let interactiveMetrics = {
    ambiguitiesDetected: 0,
    clarificationQuestions: 0,
    solutionChoices: 0,
    approvalRequested: false,
    humanResponsesReceived: 0,
  };

  // V3: Signal handler state
  let questionResponse: CodeQuestionResponsePayload | null = null;

  // V3: Set up signal handler for code question responses
  setHandler(codeQuestionResponseSignal, (payload: CodeQuestionResponsePayload) => {
    questionResponse = payload;
  });

  // V3: Helper to wait for question response with timeout
  async function waitForQuestionResponse(timeoutHours: number): Promise<CodeQuestionResponsePayload | null> {
    const timeoutMs = timeoutHours * 60 * 60 * 1000;
    questionResponse = null; // Reset before waiting

    const gotResponse = await condition(() => questionResponse !== null, timeoutMs);

    if (gotResponse && questionResponse) {
      interactiveMetrics.humanResponsesReceived++;
      return questionResponse;
    }

    return null; // Timeout
  }

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
    // Phase B: Pre-Generation Analysis (V3 - Steps 7-9)
    // ========================================

    // V3: Track step offset based on enabled features
    let stepOffset = 6; // After Phase A setup steps

    // V3: Ambiguity detection before code generation
    let selectedAmbiguityOption: string | null = null;
    if (features.enableAmbiguityDetection) {
      stepOffset++;
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Detect Ambiguities in Technical Plan',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const ambiguityStart = Date.now();
      const ambiguityResult = await detectAmbiguityBeforeGeneration({
        task: {
          id: task.id,
          linearId: task.linearId,
          title: task.title,
          description: task.description,
          identifier: task.identifier,
        },
        technicalPlan,
        projectId: input.projectId,
        codebaseContext: ragContext?.chunks?.map(c => `${c.filePath}:\n${c.content}`).join('\n\n'),
        workflowId,
      });

      interactiveMetrics.ambiguitiesDetected = ambiguityResult.ambiguities.length;

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Detect Ambiguities in Technical Plan',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(ambiguityStart),
        completedAt: new Date(),
        metadata: {
          hasAmbiguities: ambiguityResult.hasAmbiguities,
          ambiguityCount: ambiguityResult.ambiguities.length,
          confidence: ambiguityResult.confidence,
        },
      });

      // V3: If ambiguities found, post question and wait for response
      if (ambiguityResult.hasAmbiguities && ambiguityResult.ambiguities.length > 0) {
        stepOffset++;
        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Post Clarification Question',
          stepNumber: stepOffset,
          totalSteps: TOTAL_STEPS,
          status: 'in_progress',
          startedAt: new Date(),
        });

        const questionStart = Date.now();
        const firstAmbiguity = ambiguityResult.ambiguities[0];

        // Build options from ambiguity
        const options = firstAmbiguity.options.map(opt => ({
          id: opt.id,
          label: opt.label,
          description: opt.description,
          pros: opt.pros,
          cons: opt.cons,
          recommended: opt.recommended,
        }));

        const questionResult = await postCodeQuestion({
          projectId: input.projectId,
          taskId: task.id,
          linearId: task.linearId,
          questionType: 'clarification',
          question: `**${firstAmbiguity.title}**\n\n${firstAmbiguity.description}`,
          options,
          metadata: {
            workflowId,
            stepNumber: stepOffset,
            totalSteps: TOTAL_STEPS,
            timeoutHours: features.humanResponseTimeoutHours || 24,
            context: `Ambiguity detected in technical plan: ${firstAmbiguity.type}`,
            postedAt: new Date(),
            taskIdentifier: task.identifier,
          },
        });

        interactiveMetrics.clarificationQuestions++;

        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Post Clarification Question',
          stepNumber: stepOffset,
          totalSteps: TOTAL_STEPS,
          status: 'completed',
          startedAt: new Date(questionStart),
          completedAt: new Date(),
          metadata: {
            questionId: questionResult.questionId,
            commentId: questionResult.commentId,
            ambiguityType: firstAmbiguity.type,
          },
        });

        // V3: Wait for response
        stepOffset++;
        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Waiting for Clarification Response',
          stepNumber: stepOffset,
          totalSteps: TOTAL_STEPS,
          status: 'in_progress',
          startedAt: new Date(),
          metadata: { timeoutHours: features.humanResponseTimeoutHours || 24 },
        });

        const waitStart = Date.now();
        const response = await waitForQuestionResponse(features.humanResponseTimeoutHours || 24);

        if (response) {
          selectedAmbiguityOption = response.selectedOption || null;

          await logWorkflowProgress({
            workflowId,
            projectId,
            taskId,
            phase: PHASE,
            stepName: 'Waiting for Clarification Response',
            stepNumber: stepOffset,
            totalSteps: TOTAL_STEPS,
            status: 'completed',
            startedAt: new Date(waitStart),
            completedAt: new Date(),
            metadata: {
              responseType: response.responseType,
              selectedOption: response.selectedOption,
              respondedBy: response.respondedBy,
            },
          });

          // Add selected option context to error context for code generation
          if (selectedAmbiguityOption) {
            const selectedOpt = firstAmbiguity.options.find(o => o.id === selectedAmbiguityOption);
            if (selectedOpt) {
              errorContext += `\n\nUser selected option for "${firstAmbiguity.title}": ${selectedOpt.label}\n${selectedOpt.description}`;
            }
          } else if (response.customText) {
            errorContext += `\n\nUser provided custom clarification for "${firstAmbiguity.title}": ${response.customText}`;
          }
        } else {
          // Timeout - use recommended option or auto-proceed
          await logWorkflowProgress({
            workflowId,
            projectId,
            taskId,
            phase: PHASE,
            stepName: 'Waiting for Clarification Response',
            stepNumber: stepOffset,
            totalSteps: TOTAL_STEPS,
            status: 'completed',
            startedAt: new Date(waitStart),
            completedAt: new Date(),
            metadata: { timedOut: true, autoProceed: features.autoProceedOnTimeout },
          });

          if (features.autoProceedOnTimeout) {
            // Use recommended option
            const recommendedOpt = firstAmbiguity.options.find(o => o.recommended);
            if (recommendedOpt) {
              selectedAmbiguityOption = recommendedOpt.id;
              errorContext += `\n\nAuto-selected recommended option for "${firstAmbiguity.title}": ${recommendedOpt.label}\n${recommendedOpt.description}`;
            }
          }
        }
      }
    }

    // ========================================
    // Phase C: Generation Loop with Container Execution (Steps 10-15)
    // ========================================

    const maxRetries = features.maxRetries ?? 3;
    let generatedFiles: GeneratedFile[] = [];
    let codeResult: Awaited<ReturnType<typeof generateCodeFromPlan>> | null = null;
    let containerSuccess = true;

    // Generation loop with retry
    while (retryCount <= maxRetries) {
      stepOffset++;
      // Step: Generate code (Ollama - local LLM)
      const isRetry = retryCount > 0;
      const stepName = isRetry
        ? `Generate Code (Retry ${retryCount}/${maxRetries})`
        : 'Generate Code (Ollama - Local LLM)';

      const genStepNumber = stepOffset;
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName,
        stepNumber: genStepNumber,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
        metadata: isRetry ? { retryCount, errorContext: errorContext.substring(0, 500) } : undefined,
      });

      const genStepStart = Date.now();
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
        stepName,
        stepNumber: genStepNumber,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(genStepStart),
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
      // V2: Container Execution
      // ========================================

      if (features.enableContainerExecution) {
        stepOffset++;
        const containerStepNumber = stepOffset;
        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Execute in Container (Clone, Lint, Typecheck, Test)',
          stepNumber: containerStepNumber,
          totalSteps: TOTAL_STEPS,
          status: 'in_progress',
          startedAt: new Date(),
          metadata: { retryCount, fileCount: generatedFiles.length },
        });

        const containerStepStart = Date.now();

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
            stepNumber: containerStepNumber,
            totalSteps: TOTAL_STEPS,
            status: containerSuccess ? 'completed' : 'failed',
            startedAt: new Date(containerStepStart),
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

          // V2: Analyze failures with AI
          if (retryCount < maxRetries) {
            stepOffset++;
            const analysisStepNumber = stepOffset;
            await logWorkflowProgress({
              workflowId,
              projectId,
              taskId,
              phase: PHASE,
              stepName: 'Analyze Failures with AI',
              stepNumber: analysisStepNumber,
              totalSteps: TOTAL_STEPS,
              status: 'in_progress',
              startedAt: new Date(),
              metadata: { failedPhase: lastContainerResult.failedPhase, retryCount },
            });

            const analysisStepStart = Date.now();
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
              stepNumber: analysisStepNumber,
              totalSteps: TOTAL_STEPS,
              status: 'completed',
              startedAt: new Date(analysisStepStart),
              completedAt: new Date(),
              metadata: {
                failedPhase: analysis.failedPhase,
                confidence: analysis.confidence,
                suggestedFixes: analysis.suggestedFixes.length,
                analysis: analysis.analysis.substring(0, 500),
              },
            });

            // V3: Detect multiple solutions (if enabled)
            if (features.enableSolutionChoice) {
              stepOffset++;
              const solutionStepNumber = stepOffset;
              await logWorkflowProgress({
                workflowId,
                projectId,
                taskId,
                phase: PHASE,
                stepName: 'Detect Solution Options',
                stepNumber: solutionStepNumber,
                totalSteps: TOTAL_STEPS,
                status: 'in_progress',
                startedAt: new Date(),
              });

              const solutionStart = Date.now();
              const solutionResult = await detectMultipleSolutions({
                task: {
                  id: task.id,
                  linearId: task.linearId,
                  title: task.title,
                  identifier: task.identifier,
                },
                generatedFiles,
                containerResult: lastContainerResult,
                attemptNumber: retryCount + 1,
                maxAttempts: maxRetries,
                technicalPlan,
                codebaseContext: ragContext?.chunks?.map(c => `${c.filePath}:\n${c.content}`).join('\n\n'),
                projectId: input.projectId,
                workflowId,
              });

              await logWorkflowProgress({
                workflowId,
                projectId,
                taskId,
                phase: PHASE,
                stepName: 'Detect Solution Options',
                stepNumber: solutionStepNumber,
                totalSteps: TOTAL_STEPS,
                status: 'completed',
                startedAt: new Date(solutionStart),
                completedAt: new Date(),
                metadata: {
                  hasMultipleSolutions: solutionResult.hasMultipleSolutions,
                  solutionCount: solutionResult.solutions?.length || 1,
                },
              });

              // V3: If multiple solutions, post question and wait for response
              if (solutionResult.hasMultipleSolutions && solutionResult.solutions) {
                stepOffset++;
                await logWorkflowProgress({
                  workflowId,
                  projectId,
                  taskId,
                  phase: PHASE,
                  stepName: 'Post Solution Choice Question',
                  stepNumber: stepOffset,
                  totalSteps: TOTAL_STEPS,
                  status: 'in_progress',
                  startedAt: new Date(),
                });

                const questionStart = Date.now();

                // Build options from solutions
                const options = solutionResult.solutions.map(sol => ({
                  id: sol.id,
                  label: sol.label,
                  description: `${sol.description}\n\nChanges: ${sol.changes}`,
                  pros: sol.pros,
                  cons: sol.cons,
                  recommended: sol.recommended,
                }));

                const questionResult = await postCodeQuestion({
                  projectId: input.projectId,
                  taskId: task.id,
                  linearId: task.linearId,
                  questionType: 'solution_choice',
                  question: `**Validation Failed: ${solutionResult.errorAnalysis.errorType}**\n\nMultiple solutions are available to fix this error. Which approach would you prefer?`,
                  options,
                  metadata: {
                    workflowId,
                    stepNumber: stepOffset,
                    totalSteps: TOTAL_STEPS,
                    timeoutHours: features.humanResponseTimeoutHours || 24,
                    context: `Validation failed at ${solutionResult.errorAnalysis.phase}: ${solutionResult.errorAnalysis.errorType}`,
                    postedAt: new Date(),
                    taskIdentifier: task.identifier,
                  },
                });

                interactiveMetrics.solutionChoices++;

                await logWorkflowProgress({
                  workflowId,
                  projectId,
                  taskId,
                  phase: PHASE,
                  stepName: 'Post Solution Choice Question',
                  stepNumber: stepOffset,
                  totalSteps: TOTAL_STEPS,
                  status: 'completed',
                  startedAt: new Date(questionStart),
                  completedAt: new Date(),
                  metadata: {
                    questionId: questionResult.questionId,
                    commentId: questionResult.commentId,
                  },
                });

                // V3: Wait for response
                stepOffset++;
                await logWorkflowProgress({
                  workflowId,
                  projectId,
                  taskId,
                  phase: PHASE,
                  stepName: 'Waiting for Solution Choice Response',
                  stepNumber: stepOffset,
                  totalSteps: TOTAL_STEPS,
                  status: 'in_progress',
                  startedAt: new Date(),
                  metadata: { timeoutHours: features.humanResponseTimeoutHours || 24 },
                });

                const waitStart = Date.now();
                const response = await waitForQuestionResponse(features.humanResponseTimeoutHours || 24);

                if (response) {
                  const selectedSolution = response.selectedOption
                    ? solutionResult.solutions.find(s => s.id === response.selectedOption)
                    : null;

                  await logWorkflowProgress({
                    workflowId,
                    projectId,
                    taskId,
                    phase: PHASE,
                    stepName: 'Waiting for Solution Choice Response',
                    stepNumber: stepOffset,
                    totalSteps: TOTAL_STEPS,
                    status: 'completed',
                    startedAt: new Date(waitStart),
                    completedAt: new Date(),
                    metadata: {
                      responseType: response.responseType,
                      selectedOption: response.selectedOption,
                      respondedBy: response.respondedBy,
                    },
                  });

                  if (selectedSolution) {
                    errorContext = `User selected solution: ${selectedSolution.label}\n${selectedSolution.description}\n\nApply these changes: ${selectedSolution.changes}`;
                  } else if (response.customText) {
                    errorContext = `User provided custom fix instructions: ${response.customText}`;
                  }
                } else {
                  // Timeout - use recommended solution
                  await logWorkflowProgress({
                    workflowId,
                    projectId,
                    taskId,
                    phase: PHASE,
                    stepName: 'Waiting for Solution Choice Response',
                    stepNumber: stepOffset,
                    totalSteps: TOTAL_STEPS,
                    status: 'completed',
                    startedAt: new Date(waitStart),
                    completedAt: new Date(),
                    metadata: { timedOut: true, autoProceed: features.autoProceedOnTimeout },
                  });

                  if (features.autoProceedOnTimeout && solutionResult.recommendation) {
                    const recommendedSolution = solutionResult.solutions.find(s => s.id === solutionResult.recommendation);
                    if (recommendedSolution) {
                      errorContext = `Auto-selected recommended solution: ${recommendedSolution.label}\n${recommendedSolution.description}\n\nApply these changes: ${recommendedSolution.changes}`;
                    }
                  }
                }
              }
            }

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
            stepNumber: containerStepNumber,
            totalSteps: TOTAL_STEPS,
            status: 'failed',
            startedAt: new Date(containerStepStart),
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
    // Phase D: Pre-PR Approval (V3 - Optional)
    // ========================================

    if (!codeResult) {
      throw new Error('Code generation failed - no result');
    }

    // V3: Pre-PR approval (if enabled)
    if (features.enablePrePRApproval) {
      stepOffset++;
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Generate Code Preview',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const previewStart = Date.now();
      const previewResult = await generateCodePreview({
        files: generatedFiles.map(f => ({
          path: f.path,
          action: f.action,
          content: f.content,
          originalContent: fullFileContents.find(ff => ff.path === f.path)?.content,
        })),
        summary: `Generated ${generatedFiles.length} files for ${task.identifier}`,
      });

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Generate Code Preview',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(previewStart),
        completedAt: new Date(),
        metadata: {
          totalFiles: previewResult.preview.totalFiles,
          totalLinesChanged: previewResult.preview.totalLinesChanged,
        },
      });

      // Post approval question
      stepOffset++;
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Post Approval Question',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const approvalStart = Date.now();
      const approvalQuestion = await postCodeQuestion({
        projectId: input.projectId,
        taskId: task.id,
        linearId: task.linearId,
        questionType: 'approval',
        question: 'Please review the generated code and approve or reject the PR creation.',
        preview: previewResult.preview,
        metadata: {
          workflowId,
          stepNumber: stepOffset,
          totalSteps: TOTAL_STEPS,
          timeoutHours: features.humanResponseTimeoutHours || 24,
          context: `Pre-PR approval request for ${generatedFiles.length} files`,
          postedAt: new Date(),
          taskIdentifier: task.identifier,
        },
      });

      interactiveMetrics.approvalRequested = true;

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Post Approval Question',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(approvalStart),
        completedAt: new Date(),
        metadata: {
          questionId: approvalQuestion.questionId,
          commentId: approvalQuestion.commentId,
        },
      });

      // Wait for approval
      stepOffset++;
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Waiting for Approval Response',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
        metadata: { timeoutHours: features.humanResponseTimeoutHours || 24 },
      });

      const approvalWaitStart = Date.now();
      const approvalResponse = await waitForQuestionResponse(features.humanResponseTimeoutHours || 24);

      if (approvalResponse) {
        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Waiting for Approval Response',
          stepNumber: stepOffset,
          totalSteps: TOTAL_STEPS,
          status: 'completed',
          startedAt: new Date(approvalWaitStart),
          completedAt: new Date(),
          metadata: {
            responseType: approvalResponse.responseType,
            respondedBy: approvalResponse.respondedBy,
          },
        });

        // If rejected, throw error to fail workflow
        if (approvalResponse.responseType === 'rejected') {
          throw new Error(`PR rejected by ${approvalResponse.respondedBy}: ${approvalResponse.customText || 'No reason provided'}`);
        }
      } else {
        // Timeout
        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Waiting for Approval Response',
          stepNumber: stepOffset,
          totalSteps: TOTAL_STEPS,
          status: 'completed',
          startedAt: new Date(approvalWaitStart),
          completedAt: new Date(),
          metadata: { timedOut: true, autoProceed: features.autoProceedOnTimeout },
        });

        if (!features.autoProceedOnTimeout || features.timeoutDefaultOption === 'cancel') {
          throw new Error('PR approval timed out and auto-proceed is disabled');
        }
      }
    }

    // ========================================
    // Phase E: Commit & PR
    // ========================================

    // Create branch
    stepOffset++;
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Create Branch',
      stepNumber: stepOffset,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const branchStepStart = Date.now();
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
      stepNumber: stepOffset,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(branchStepStart),
      completedAt: new Date(),
      metadata: { branchName: codeResult.code.branchName },
    });

    // Commit files
    stepOffset++;
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Commit Generated Files',
      stepNumber: stepOffset,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const commitStepStart = Date.now();
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
      stepNumber: stepOffset,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(commitStepStart),
      completedAt: new Date(),
      metadata: { filesCommitted: generatedFiles.length },
    });

    // Create draft PR
    stepOffset++;
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Create Draft PR',
      stepNumber: stepOffset,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const prStepStart = Date.now();

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
      stepNumber: stepOffset,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(prStepStart),
      completedAt: new Date(),
      metadata: { prNumber: pr.number, prUrl: pr.url, draft: pr.draft },
    });

    // ========================================
    // Phase F: Finalization
    // ========================================

    // Update status to Code Review
    if (features.enableAutoStatusUpdate) {
      stepOffset++;
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Code Review',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const statusStepStart = Date.now();
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
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(statusStepStart),
        completedAt: new Date(),
        metadata: { status: LINEAR_STATUSES.codeReview },
      });
    } else {
      stepOffset++;
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Code Review (disabled)',
        stepNumber: stepOffset,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Log completion metrics
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
      // V3: Interactive metrics
      interactiveMetrics,
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
