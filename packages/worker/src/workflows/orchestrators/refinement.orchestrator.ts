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

import { executeChild, ApplicationFailure, proxyActivities, workflowInfo } from '@temporalio/workflow';
import type { WorkflowConfig, RefinementPhaseConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';
import type * as progressActivities from '../../activities/workflow-progress.activities';

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

  // Configure progress logging activity
  const { logWorkflowProgress, logWorkflowFailure, logWorkflowCompletion } = proxyActivities<typeof progressActivities>({
    startToCloseTimeout: '10 seconds',
    retry: { maximumAttempts: 3 },
  });

  const workflowId = workflowInfo().workflowId;
  const TOTAL_STEPS = 15;
  const PHASE = 'refinement' as const;
  const workflowStartTime = new Date();

  try {
    // Step 1: Sync task from Linear
    await logWorkflowProgress({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      stepName: 'Sync Linear Task',
      stepNumber: 1,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const stepStartTime = Date.now();
    const task = await executeChild(syncLinearTaskWorkflow, {
      workflowId: `sync-task-${input.taskId}-${Date.now()}`,
      args: [{ taskId: input.taskId, projectId: input.projectId }],
    });

    await logWorkflowProgress({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      stepName: 'Sync Linear Task',
      stepNumber: 1,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(stepStartTime),
      completedAt: new Date(),
      metadata: { taskId: task.id, linearId: task.linearId },
    });

    // Step 2: Update status to Refinement In Progress (conditional)
    if (features.enableAutoStatusUpdate) {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Status to In Progress',
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step2StartTime = Date.now();
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

      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Status to In Progress',
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step2StartTime),
        completedAt: new Date(),
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Status to In Progress (disabled)',
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    // Step 3: Get existing PO answers
    await logWorkflowProgress({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      stepName: 'Get PO Answers',
      stepNumber: 3,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step3StartTime = Date.now();
    const poAnswersResult = await executeChild(getPOAnswersWorkflow, {
      workflowId: `get-po-answers-${input.taskId}-${Date.now()}`,
      args: [{ linearIssueId: task.linearId, projectId: input.projectId }],
    });

    await logWorkflowProgress({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      stepName: 'Get PO Answers',
      stepNumber: 3,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step3StartTime),
      completedAt: new Date(),
      metadata: { answersCount: poAnswersResult.answers.length },
    });

    // Step 4: Retrieve RAG context (conditional)
    let ragContext: any = null;
    if (features.enableRagContext) {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Retrieve RAG Context',
        stepNumber: 4,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step4StartTime = Date.now();
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

      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Retrieve RAG Context',
        stepNumber: 4,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step4StartTime),
        completedAt: new Date(),
        metadata: { chunksCount: ragContext?.chunks?.length || 0 },
      });

      // Step 5: Save codebase context document (conditional)
      if (features.enableContextDocuments && ragContext?.chunks?.length > 0) {
        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Save Codebase Context',
          stepNumber: 5,
          totalSteps: TOTAL_STEPS,
          status: 'in_progress',
          startedAt: new Date(),
        });

        const step5StartTime = Date.now();
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

        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Save Codebase Context',
          stepNumber: 5,
          totalSteps: TOTAL_STEPS,
          status: 'completed',
          startedAt: new Date(step5StartTime),
          completedAt: new Date(),
        });
      } else {
        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Save Codebase Context (disabled or no chunks)',
          stepNumber: 5,
          totalSteps: TOTAL_STEPS,
          status: 'skipped',
        });
      }
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Retrieve RAG Context (disabled)',
        stepNumber: 4,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Save Codebase Context (RAG disabled)',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    // Step 6: Analyze documentation (conditional)
    let documentationContext: any;
    if (features.enableDocumentationAnalysis) {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Analyze Documentation',
        stepNumber: 6,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step6StartTime = Date.now();
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

        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Analyze Documentation',
          stepNumber: 6,
          totalSteps: TOTAL_STEPS,
          status: 'completed',
          startedAt: new Date(step6StartTime),
          completedAt: new Date(),
        });

        // Step 7: Save documentation context (conditional)
        if (features.enableContextDocuments && documentationContext) {
          await logWorkflowProgress({
            workflowId,
            projectId: input.projectId,
            taskId: input.taskId,
            phase: PHASE,
            stepName: 'Save Documentation Context',
            stepNumber: 7,
            totalSteps: TOTAL_STEPS,
            status: 'in_progress',
            startedAt: new Date(),
          });

          const step7StartTime = Date.now();
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

          await logWorkflowProgress({
            workflowId,
            projectId: input.projectId,
            taskId: input.taskId,
            phase: PHASE,
            stepName: 'Save Documentation Context',
            stepNumber: 7,
            totalSteps: TOTAL_STEPS,
            status: 'completed',
            startedAt: new Date(step7StartTime),
            completedAt: new Date(),
          });
        } else {
          await logWorkflowProgress({
            workflowId,
            projectId: input.projectId,
            taskId: input.taskId,
            phase: PHASE,
            stepName: 'Save Documentation Context (disabled or no context)',
            stepNumber: 7,
            totalSteps: TOTAL_STEPS,
            status: 'skipped',
          });
        }
      } catch (docError) {
        // Non-blocking: Continue workflow even if documentation analysis fails
        console.warn('[refinementOrchestrator] Documentation analysis failed:', docError);
        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Analyze Documentation',
          stepNumber: 6,
          totalSteps: TOTAL_STEPS,
          status: 'failed',
          startedAt: new Date(step6StartTime),
          completedAt: new Date(),
          error: docError instanceof Error ? docError.message : 'Unknown error',
        });
        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Save Documentation Context (analysis failed)',
          stepNumber: 7,
          totalSteps: TOTAL_STEPS,
          status: 'skipped',
        });
      }
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Analyze Documentation (disabled)',
        stepNumber: 6,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Save Documentation Context (disabled)',
        stepNumber: 7,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    // Step 8: Generate refinement (AI)
    await logWorkflowProgress({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      stepName: 'Generate Refinement (AI)',
      stepNumber: 8,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step8StartTime = Date.now();
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
          taskId: input.taskId, // Pass for LLM usage tracking aggregation
          workflowId, // Pass for LLM usage tracking
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

    await logWorkflowProgress({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      stepName: 'Generate Refinement (AI)',
      stepNumber: 8,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step8StartTime),
      completedAt: new Date(),
      metadata: {
        taskType: result.refinement.taskType,
        ai: result.aiMetrics,
        result: result.resultSummary,
      },
    });

    // Step 9: Add task type label (non-blocking)
    if (task.teamId) {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Add Task Type Label',
        stepNumber: 9,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step9StartTime = Date.now();
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

        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Add Task Type Label',
          stepNumber: 9,
          totalSteps: TOTAL_STEPS,
          status: 'completed',
          startedAt: new Date(step9StartTime),
          completedAt: new Date(),
        });
      } catch (labelError) {
        // Non-blocking: Continue workflow even if labeling fails
        console.warn('[refinementOrchestrator] Failed to add label:', labelError);
        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Add Task Type Label',
          stepNumber: 9,
          totalSteps: TOTAL_STEPS,
          status: 'failed',
          startedAt: new Date(step9StartTime),
          completedAt: new Date(),
          error: labelError instanceof Error ? labelError.message : 'Unknown error',
        });
      }
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Add Task Type Label (no team)',
        stepNumber: 9,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    // Step 10: Save external context documents (conditional)
    if (features.enableContextDocuments && result.externalContext) {
      const shouldSaveFigma = features.enableFigmaContext && result.externalContext.figma;
      const shouldSaveSentry = features.enableSentryContext && result.externalContext.sentry;
      const shouldSaveGitHub =
        features.enableGitHubIssueContext && result.externalContext.githubIssue;

      if (shouldSaveFigma || shouldSaveSentry || shouldSaveGitHub) {
        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Save External Context',
          stepNumber: 10,
          totalSteps: TOTAL_STEPS,
          status: 'in_progress',
          startedAt: new Date(),
        });

        const step10StartTime = Date.now();
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

          await logWorkflowProgress({
            workflowId,
            projectId: input.projectId,
            taskId: input.taskId,
            phase: PHASE,
            stepName: 'Save External Context',
            stepNumber: 10,
            totalSteps: TOTAL_STEPS,
            status: 'completed',
            startedAt: new Date(step10StartTime),
            completedAt: new Date(),
          });
        } catch (externalError) {
          // Non-blocking: Continue workflow even if external context save fails
          console.warn('[refinementOrchestrator] Failed to save external context:', externalError);
          await logWorkflowProgress({
            workflowId,
            projectId: input.projectId,
            taskId: input.taskId,
            phase: PHASE,
            stepName: 'Save External Context',
            stepNumber: 10,
            totalSteps: TOTAL_STEPS,
            status: 'failed',
            startedAt: new Date(step10StartTime),
            completedAt: new Date(),
            error: externalError instanceof Error ? externalError.message : 'Unknown error',
          });
        }
      } else {
        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Save External Context (no context to save)',
          stepNumber: 10,
          totalSteps: TOTAL_STEPS,
          status: 'skipped',
        });
      }
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Save External Context (disabled)',
        stepNumber: 10,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    // Step 11: Update title and description
    if (result.refinement.suggestedTitle || result.refinement.reformulatedDescription) {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Task Title/Description',
        stepNumber: 11,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step11StartTime = Date.now();
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

      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Task Title/Description',
        stepNumber: 11,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step11StartTime),
        completedAt: new Date(),
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Task Title/Description (no changes)',
        stepNumber: 11,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    // Step 12: Append refinement to Linear issue
    await logWorkflowProgress({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      stepName: 'Append Refinement to Issue',
      stepNumber: 12,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step12StartTime = Date.now();
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

    await logWorkflowProgress({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      stepName: 'Append Refinement to Issue',
      stepNumber: 12,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step12StartTime),
      completedAt: new Date(),
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
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Create Subtasks',
        stepNumber: 13,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step13StartTime = Date.now();
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
        await logWorkflowProgress({
          workflowId,
          projectId: input.projectId,
          taskId: input.taskId,
          phase: PHASE,
          stepName: 'Create Subtasks',
          stepNumber: 13,
          totalSteps: TOTAL_STEPS,
          status: 'failed',
          startedAt: new Date(step13StartTime),
          completedAt: new Date(),
          error: errorMsg,
        });
        throw new Error(errorMsg);
      }

      subtasksCreated = {
        total: result.refinement.suggestedSplit.proposedStories.length,
        created: subtaskResult.created.length,
        failed: 0,
      };

      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Create Subtasks',
        stepNumber: 13,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step13StartTime),
        completedAt: new Date(),
        metadata: { subtasksCreated: subtaskResult.created.length },
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Create Subtasks (not needed)',
        stepNumber: 13,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    // Step 14: Check for PO questions (conditional)
    const questions = result.refinement.questionsForPO || [];
    if (features.enablePOQuestions && questions.length > 0) {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Post PO Questions',
        stepNumber: 14,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step14StartTime = Date.now();
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

      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Post PO Questions',
        stepNumber: 14,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step14StartTime),
        completedAt: new Date(),
        metadata: { questionsCount: questions.length },
      });

      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Status to Ready (blocked)',
        stepNumber: 15,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });

      // Mark workflow as completed (even when blocked, it's a successful completion)
      await logWorkflowCompletion({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        startedAt: workflowStartTime,
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
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Post PO Questions (no questions)',
        stepNumber: 14,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    // Step 15: Update status to Refinement Ready (conditional)
    if (features.enableAutoStatusUpdate) {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Status to Ready',
        stepNumber: 15,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step15StartTime = Date.now();
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

      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Status to Ready',
        stepNumber: 15,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step15StartTime),
        completedAt: new Date(),
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId: input.projectId,
        taskId: input.taskId,
        phase: PHASE,
        stepName: 'Update Status to Ready (disabled)',
        stepNumber: 15,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
      });
    }

    const previouslyAnsweredCount = poAnswersResult.answers.length;

    // Mark workflow as completed with duration
    await logWorkflowCompletion({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      startedAt: workflowStartTime,
    });

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
    // Log workflow failure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logWorkflowFailure({
      workflowId,
      projectId: input.projectId,
      taskId: input.taskId,
      phase: PHASE,
      error: errorMessage,
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
              status: LINEAR_STATUSES.refinementFailed,
            },
          ],
        });
      } catch (updateError) {
        console.error('[refinementOrchestrator] Failed to update status to Failed:', updateError);
      }
    }

    throw ApplicationFailure.create({
      message: `Refinement orchestrator failed: ${errorMessage}`,
      type: 'RefinementOrchestratorFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
