/**
 * Code Generation Orchestrator - Phase 4 of Four-Phase Agile Workflow
 *
 * Coordinates code generation from technical plan using local LLM (Ollama).
 * Privacy-first: All inference runs locally, no cloud fallback.
 *
 * MVP Steps (9 steps):
 * 1. Sync task from Linear
 * 2. Update status to Code In Progress
 * 3. Get technical plan document (Phase 3)
 * 4. Parse technical plan (local function)
 * 5. Get codebase context document (optional - RAG chunks)
 * 6. Fetch full file contents from GitHub (for files to be modified)
 * 7. Generate code (Ollama - local LLM with full file context)
 * 8. Create branch + commit + draft PR
 * 9. Update status to Code Review
 */

import { executeChild, ApplicationFailure, proxyActivities, workflowInfo } from '@temporalio/workflow';
import type { WorkflowConfig, CodeGenerationPhaseConfig, TechnicalPlanGenerationOutput } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';
import type * as progressActivities from '../../activities/workflow-progress.activities';
import type * as codeGenActivities from '../../activities/code-generation.activities';
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
  const { generateCodeFromPlan, fetchFilesFromGitHub } = proxyActivities<typeof codeGenActivities>({
    startToCloseTimeout: '15 minutes', // Long timeout for local LLM inference
    retry: { maximumAttempts: 2 },
  });

  // Configure VCS activities
  const { createBranch, commitFiles, createPullRequest } = proxyActivities<typeof vcsActivities>({
    startToCloseTimeout: '2 minutes',
    retry: { maximumAttempts: 3 },
  });

  const workflowId = workflowInfo().workflowId;
  const TOTAL_STEPS = 9; // Added step for fetching full files from GitHub
  const PHASE = 'code_generation' as const;
  const projectId = input.projectId;
  const taskId = input.taskId;
  const workflowStartTime = new Date();

  try {
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

    // Step 7: Generate code (Ollama - local LLM)
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Generate Code (Ollama - Local LLM)',
      stepNumber: 7,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step7Start = Date.now();
    const codeResult = await generateCodeFromPlan({
      task: {
        id: task.id,
        linearId: task.linearId,
        title: task.title,
        description: task.description,
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

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Generate Code (Ollama - Local LLM)',
      stepNumber: 7,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step7Start),
      completedAt: new Date(),
      metadata: {
        filesGenerated: codeResult.code.files.length,
        branchName: codeResult.code.branchName,
        fullFilesProvided: fullFileContents.length,
        ai: codeResult.aiMetrics,
        result: codeResult.resultSummary,
      },
    });

    // Step 8: Create branch + commit + draft PR
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Create Branch, Commit & Draft PR',
      stepNumber: 8,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step8Start = Date.now();

    // Create branch
    await createBranch({
      projectId: input.projectId,
      branchName: codeResult.code.branchName,
      baseBranch: 'main', // TODO: Get from project config
    });

    // Commit files
    await commitFiles({
      projectId: input.projectId,
      branchName: codeResult.code.branchName,
      files: codeResult.code.files.map((f) => ({
        path: f.path,
        content: f.content,
      })),
      message: codeResult.code.commitMessage,
    });

    // Create draft PR (always draft for safety)
    const pr = await createPullRequest({
      projectId: input.projectId,
      branchName: codeResult.code.branchName,
      title: codeResult.code.prTitle,
      description: codeResult.code.prDescription,
      targetBranch: 'main', // TODO: Get from project config
      draft: true, // Always draft for safety - requires human review
      linearIdentifier: task.identifier,
      labels: ['auto-generated', 'devflow-phase-4'],
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Create Branch, Commit & Draft PR',
      stepNumber: 8,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step8Start),
      completedAt: new Date(),
      metadata: {
        branchName: codeResult.code.branchName,
        prNumber: pr.number,
        prUrl: pr.url,
        draft: pr.draft,
        filesCommitted: codeResult.code.files.length,
      },
    });

    // Step 9: Update status to Code Review
    if (features.enableAutoStatusUpdate) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Code Review',
        stepNumber: 9,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step9Start = Date.now();
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
        stepNumber: 9,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step9Start),
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
        stepNumber: 9,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Mark workflow as completed with duration
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
      generatedFiles: codeResult.code.files.length,
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
