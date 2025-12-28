/**
 * Refinement Orchestrator - Phase 1 of Three-Phase Agile Workflow
 *
 * Coordinates all refinement step workflows:
 * 1. Sync task from Linear
 * 2. Update status to In Progress (conditional)
 * 3. Get existing PO answers
 * 4. Retrieve RAG context (conditional)
 * 5. Save codebase context document (conditional)
 * 6. Analyze documentation (conditional)
 * 7. Save documentation context (conditional)
 * 8. Generate refinement (AI)
 * 9. Add task type label
 * 10. Save external context documents (conditional)
 * 11. Update title/description
 * 12. Append refinement to issue
 * 13. Create subtasks (conditional, blocking)
 * 14. Post PO questions (conditional, blocks completion)
 * 15. Update status to Ready (conditional)
 */

import { executeChild, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowConfig, RefinementPhaseConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';

// Import step workflows
import { syncLinearTaskWorkflow } from '../steps/common/sync-linear-task.workflow';
import { updateLinearStatusWorkflow } from '../steps/common/update-linear-status.workflow';
import { getPOAnswersWorkflow } from '../steps/refinement/get-po-answers.workflow';
import { retrieveRagContextWorkflow } from '../steps/refinement/retrieve-rag-context.workflow';
import { saveCodebaseContextWorkflow } from '../steps/refinement/save-codebase-context.workflow';
import { analyzeDocumentationWorkflow } from '../steps/refinement/analyze-documentation.workflow';
import { saveDocumentationContextWorkflow } from '../steps/refinement/save-documentation-context.workflow';
import { generateRefinementWorkflow } from '../steps/refinement/generate-refinement.workflow';
import { addTaskTypeLabelWorkflow } from '../steps/refinement/add-task-type-label.workflow';
import { saveExternalContextWorkflow } from '../steps/refinement/save-external-context.workflow';
import { updateTaskContentWorkflow } from '../steps/refinement/update-task-content.workflow';
import { appendRefinementWorkflow } from '../steps/refinement/append-refinement.workflow';
import { createSubtasksWorkflow } from '../steps/refinement/create-subtasks.workflow';
import { postPOQuestionsWorkflow } from '../steps/refinement/post-po-questions.workflow';

export interface RefinementOrchestratorInput {
  taskId: string;
  projectId: string;
  config?: WorkflowConfig;
}

export interface RefinementOrchestratorResult {
  success: boolean;
  phase: 'refinement';
  message: string;
  refinement?: any;
  subtasksCreated?: {
    total: number;
    created: number;
    failed: number;
  };
  blocked?: boolean;
  waitingForAnswers?: boolean;
  questionsCount?: number;
}

export async function refinementOrchestrator(
  input: RefinementOrchestratorInput
): Promise<RefinementOrchestratorResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  // Get automation config with defaults
  const automation: RefinementPhaseConfig =
    config.automation?.phases?.refinement || DEFAULT_AUTOMATION_CONFIG.phases.refinement;
  const features = automation.features;

  try {
    // Step 1: Sync task from Linear
    const task = await executeChild(syncLinearTaskWorkflow, {
      workflowId: `sync-task-${input.taskId}-${Date.now()}`,
      args: [{ taskId: input.taskId, projectId: input.projectId }],
    });

    // Step 2: Update status to Refinement In Progress (conditional)
    if (features.enableAutoStatusUpdate) {
      await executeChild(updateLinearStatusWorkflow, {
        workflowId: `status-in-progress-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            status: LINEAR_STATUSES.refinementInProgress,
          },
        ],
      });
    }

    // Step 3: Get existing PO answers
    const poAnswersResult = await executeChild(getPOAnswersWorkflow, {
      workflowId: `get-po-answers-${input.taskId}-${Date.now()}`,
      args: [{ linearIssueId: task.linearId, projectId: input.projectId }],
    });

    // Step 4: Retrieve RAG context (conditional)
    let ragContext: any = null;
    if (features.enableRagContext) {
      ragContext = await executeChild(retrieveRagContextWorkflow, {
        workflowId: `retrieve-rag-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            query: `${task.title}\n${task.description}`,
            topK: 10,
            useReranking: true,
          },
        ],
      });

      // Step 5: Save codebase context document (conditional)
      if (features.enableContextDocuments && ragContext?.chunks?.length > 0) {
        const topChunks = ragContext.chunks.slice(0, 5);
        await executeChild(saveCodebaseContextWorkflow, {
          workflowId: `save-codebase-${input.taskId}-${Date.now()}`,
          args: [
            {
              projectId: input.projectId,
              linearId: task.linearId,
              chunks: topChunks,
              taskContext: {
                title: task.title,
                query: `${task.title}\n${task.description}`,
              },
            },
          ],
        });
      }
    }

    // Step 6: Analyze documentation (conditional)
    let documentationContext: any;
    if (features.enableDocumentationAnalysis) {
      try {
        documentationContext = await executeChild(analyzeDocumentationWorkflow, {
          workflowId: `analyze-docs-${input.taskId}-${Date.now()}`,
          args: [
            {
              projectId: input.projectId,
              taskQuery: `${task.title}\n${task.description}`,
            },
          ],
        });

        // Step 7: Save documentation context (conditional)
        if (features.enableContextDocuments && documentationContext) {
          await executeChild(saveDocumentationContextWorkflow, {
            workflowId: `save-docs-${input.taskId}-${Date.now()}`,
            args: [
              {
                projectId: input.projectId,
                linearId: task.linearId,
                context: documentationContext,
                taskContext: { title: task.title },
              },
            ],
          });
        }
      } catch (docError) {
        // Non-blocking: Continue workflow even if documentation analysis fails
        console.warn('[refinementOrchestrator] Documentation analysis failed:', docError);
      }
    }

    // Step 8: Generate refinement (AI)
    const result = await executeChild(generateRefinementWorkflow, {
      workflowId: `generate-refinement-${input.taskId}-${Date.now()}`,
      args: [
        {
          task: {
            title: task.title,
            description: task.description,
            priority: task.priority,
            labels: task.labels,
          },
          projectId: input.projectId,
          externalLinks: task.externalLinks,
          poAnswers: poAnswersResult.answers.length > 0 ? poAnswersResult.answers : undefined,
          ragContext,
          documentationContext,
          aiModel: automation.aiModel,
          enableFigmaContext: features.enableFigmaContext,
          enableSentryContext: features.enableSentryContext,
          enableGitHubIssueContext: features.enableGitHubIssueContext,
        },
      ],
    });

    // Step 9: Add task type label (non-blocking)
    if (task.teamId) {
      try {
        await executeChild(addTaskTypeLabelWorkflow, {
          workflowId: `add-label-${input.taskId}-${Date.now()}`,
          args: [
            {
              projectId: input.projectId,
              issueId: task.linearId,
              teamId: task.teamId,
              taskType: result.refinement.taskType,
            },
          ],
        });
      } catch (labelError) {
        // Non-blocking: Continue workflow even if labeling fails
        console.warn('[refinementOrchestrator] Failed to add label:', labelError);
      }
    }

    // Step 10: Save external context documents (conditional)
    if (features.enableContextDocuments && result.externalContext) {
      const shouldSaveFigma = features.enableFigmaContext && result.externalContext.figma;
      const shouldSaveSentry = features.enableSentryContext && result.externalContext.sentry;
      const shouldSaveGitHub =
        features.enableGitHubIssueContext && result.externalContext.githubIssue;

      if (shouldSaveFigma || shouldSaveSentry || shouldSaveGitHub) {
        try {
          await executeChild(saveExternalContextWorkflow, {
            workflowId: `save-external-${input.taskId}-${Date.now()}`,
            args: [
              {
                projectId: input.projectId,
                linearId: task.linearId,
                context: {
                  figma: shouldSaveFigma ? result.externalContext.figma : undefined,
                  sentry: shouldSaveSentry ? result.externalContext.sentry : undefined,
                  githubIssue: shouldSaveGitHub ? result.externalContext.githubIssue : undefined,
                },
                taskContext: { title: task.title, identifier: task.identifier },
              },
            ],
          });
        } catch (externalError) {
          // Non-blocking: Continue workflow even if external context save fails
          console.warn('[refinementOrchestrator] Failed to save external context:', externalError);
        }
      }
    }

    // Step 11: Update title and description
    if (result.refinement.suggestedTitle || result.refinement.reformulatedDescription) {
      await executeChild(updateTaskContentWorkflow, {
        workflowId: `update-content-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            title: result.refinement.suggestedTitle || undefined,
            description: result.refinement.reformulatedDescription || undefined,
          },
        ],
      });
    }

    // Step 12: Append refinement to Linear issue
    await executeChild(appendRefinementWorkflow, {
      workflowId: `append-refinement-${input.taskId}-${Date.now()}`,
      args: [
        {
          projectId: input.projectId,
          linearId: task.linearId,
          refinement: result.refinement,
        },
      ],
    });

    // Step 13: Create subtasks (conditional, blocking)
    let subtasksCreated: { total: number; created: number; failed: number } | undefined;
    const enableSubtasks =
      features.enableSubtaskCreation ?? config.linear.features?.enableSubtaskCreation ?? true;

    if (
      enableSubtasks &&
      result.refinement.suggestedSplit &&
      (result.refinement.complexityEstimate === 'L' || result.refinement.complexityEstimate === 'XL')
    ) {
      const subtaskResult = await executeChild(createSubtasksWorkflow, {
        workflowId: `create-subtasks-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            parentIssueId: task.linearId,
            proposedStories: result.refinement.suggestedSplit.proposedStories,
          },
        ],
      });

      if (subtaskResult.failed.length > 0) {
        const errorMsg = `Failed to create ${subtaskResult.failed.length}/${result.refinement.suggestedSplit.proposedStories.length} sub-issues`;
        throw new Error(errorMsg);
      }

      subtasksCreated = {
        total: result.refinement.suggestedSplit.proposedStories.length,
        created: subtaskResult.created.length,
        failed: 0,
      };
    }

    // Step 14: Check for PO questions (conditional)
    const questions = result.refinement.questionsForPO || [];
    if (features.enablePOQuestions && questions.length > 0) {
      await executeChild(postPOQuestionsWorkflow, {
        workflowId: `post-questions-${input.taskId}-${Date.now()}`,
        args: [
          {
            taskId: task.id,
            projectId: input.projectId,
            linearIssueId: task.linearId,
            questions,
          },
        ],
      });

      // Return blocked - don't update status to Ready
      return {
        success: true,
        phase: 'refinement',
        message: `Refinement blocked - ${questions.length} question(s) pending PO response`,
        refinement: result.refinement,
        subtasksCreated,
        blocked: true,
        waitingForAnswers: true,
        questionsCount: questions.length,
      };
    }

    // Step 15: Update status to Refinement Ready (conditional)
    if (features.enableAutoStatusUpdate) {
      await executeChild(updateLinearStatusWorkflow, {
        workflowId: `status-ready-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            status: LINEAR_STATUSES.refinementReady,
          },
        ],
      });
    }

    const previouslyAnsweredCount = poAnswersResult.answers.length;

    return {
      success: true,
      phase: 'refinement',
      message:
        previouslyAnsweredCount > 0
          ? `Refinement complete for task ${task.identifier} (${previouslyAnsweredCount} PO answer(s) integrated)`
          : `Refinement complete for task ${task.identifier}`,
      refinement: result.refinement,
      subtasksCreated,
    };
  } catch (error) {
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
              status: LINEAR_STATUSES.refinementFailed,
            },
          ],
        });
      } catch (updateError) {
        console.error('[refinementOrchestrator] Failed to update status to Failed:', updateError);
      }
    }

    throw ApplicationFailure.create({
      message: `Refinement orchestrator failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'RefinementOrchestratorFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
