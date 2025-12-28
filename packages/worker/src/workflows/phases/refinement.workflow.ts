/**
 * Refinement Workflow - Phase 1 of Three-Phase Agile Workflow
 *
 * Generates backlog refinement to clarify business requirements.
 * Focus: Business context, objectives, questions for PO, complexity estimation
 */

import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowConfig, AutomationConfig, RefinementPhaseConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';
import type * as activities from '@/activities';

// Proxy activities with 5-minute timeout
const {
  syncLinearTask,
  updateLinearTask,
  generateRefinement,
  appendRefinementToLinearIssue,
  createLinearSubtasks,
  addTaskTypeLabel,
  postQuestionsAsComments,
  getPOAnswersForTask,
  // RAG context retrieval
  retrieveContext,
  saveCodebaseContextDocument,
  // Documentation context analysis
  analyzeProjectContext,
  saveDocumentationContextDocument,
  // External context documents (Figma, Sentry, GitHub Issue)
  saveExternalContextDocuments,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export interface RefinementWorkflowInput {
  taskId: string;
  projectId: string;
  config?: WorkflowConfig;
}

export interface RefinementWorkflowResult {
  success: boolean;
  phase: 'refinement';
  message: string;
  refinement?: any;
  subtasksCreated?: {
    total: number;
    created: number;
    failed: number;
  };
  /** True if workflow is blocked waiting for PO answers */
  blocked?: boolean;
  /** True if waiting for PO to answer questions */
  waitingForAnswers?: boolean;
  /** Number of questions pending answers */
  questionsCount?: number;
}

/**
 * Refinement Workflow
 * Phase 1: Clarify business requirements and prepare for user story generation
 */
export async function refinementWorkflow(
  input: RefinementWorkflowInput
): Promise<RefinementWorkflowResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  // Get automation config with defaults
  const automation: RefinementPhaseConfig = config.automation?.phases?.refinement ||
    DEFAULT_AUTOMATION_CONFIG.phases.refinement;
  const features = automation.features;

  try {
    // Step 1: Sync task from Linear
    const task = await syncLinearTask({
      taskId: input.taskId,
      projectId: input.projectId,
    });

    // Step 2: Update status to Refinement In Progress (conditional)
    if (features.enableAutoStatusUpdate) {
      await updateLinearTask({
        projectId: input.projectId,
        linearId: task.linearId,
        updates: { status: LINEAR_STATUSES.refinementInProgress },
      });
    }

    // Step 2.5: Get any existing PO answers (from previous workflow runs)
    const poAnswersResult = await getPOAnswersForTask({
      linearIssueId: task.linearId,
      projectId: input.projectId,
    });

    // Step 2.6: Retrieve RAG context for codebase analysis (conditional)
    let ragContext: Awaited<ReturnType<typeof retrieveContext>> | null = null;
    if (features.enableRagContext) {
      ragContext = await retrieveContext({
        projectId: input.projectId,
        query: `${task.title}\n${task.description}`,
        topK: 10,
        useReranking: true,
      });

      // Step 2.7: Save top 5 RAG chunks as Codebase Context document
      // This document will be reused in Phases 2 and 3
      if (features.enableContextDocuments && ragContext?.chunks?.length > 0) {
        const topChunks = ragContext.chunks.slice(0, 5);
        await saveCodebaseContextDocument({
          projectId: input.projectId,
          linearId: task.linearId,
          chunks: topChunks,
          taskContext: {
            title: task.title,
            query: `${task.title}\n${task.description}`,
          },
        });
        console.log('[refinementWorkflow] Codebase context document created with', topChunks.length, 'chunks');
      }
    } else {
      console.log('[refinementWorkflow] RAG context retrieval disabled');
    }

    // Step 2.8: Analyze project context (structure, dependencies, documentation) (conditional)
    // This document will be reused in Phases 2 and 3, and included in refinement prompt
    let documentationContext: Awaited<ReturnType<typeof analyzeProjectContext>> | undefined;
    if (features.enableDocumentationAnalysis) {
      try {
        documentationContext = await analyzeProjectContext({
          projectId: input.projectId,
          taskQuery: `${task.title}\n${task.description}`,
        });

        // Save documentation context as Linear document (if enabled)
        if (features.enableContextDocuments) {
          await saveDocumentationContextDocument({
            projectId: input.projectId,
            linearId: task.linearId,
            context: documentationContext,
            taskContext: { title: task.title },
          });
          console.log('[refinementWorkflow] Documentation context document created');
        }
      } catch (docContextError) {
        // Non-blocking: Log warning but continue workflow
        console.warn('[refinementWorkflow] Failed to analyze project context:', docContextError);
      }
    } else {
      console.log('[refinementWorkflow] Documentation analysis disabled');
    }

    // Step 3: Generate refinement (with external context, PO answers, RAG file names, and documentation context)
    // Pass aiModel from automation config
    const result = await generateRefinement({
      task: {
        title: task.title,
        description: task.description,
        priority: task.priority,
        labels: task.labels,
      },
      projectId: input.projectId,
      externalLinks: task.externalLinks,
      poAnswers: poAnswersResult.answers.length > 0 ? poAnswersResult.answers : undefined,
      ragContext: ragContext, // Pass RAG context for file name references
      documentationContext: documentationContext, // Pass documentation context for project info
      aiModel: automation.aiModel, // AI model from automation config
      // Feature flags for external context extraction
      enableFigmaContext: features.enableFigmaContext,
      enableSentryContext: features.enableSentryContext,
      enableGitHubIssueContext: features.enableGitHubIssueContext,
    });

    // Step 3.5: Add task type label based on detected type (non-blocking)
    // Automatically adds feature/bug/enhancement/chore label
    if (task.teamId) {
      await addTaskTypeLabel({
        projectId: input.projectId,
        issueId: task.linearId,
        teamId: task.teamId,
        taskType: result.refinement.taskType,
      });
    }

    // Step 3.55: Save external context as Linear Documents (non-blocking)
    // Creates separate documents for Figma, Sentry, GitHub Issue contexts
    // Only save if context documents feature is enabled
    if (features.enableContextDocuments && result.externalContext) {
      // Check which external contexts should be saved based on feature flags
      const shouldSaveFigma = features.enableFigmaContext && result.externalContext.figma;
      const shouldSaveSentry = features.enableSentryContext && result.externalContext.sentry;
      const shouldSaveGitHub = features.enableGitHubIssueContext && result.externalContext.githubIssue;

      if (shouldSaveFigma || shouldSaveSentry || shouldSaveGitHub) {
        try {
          const externalDocs = await saveExternalContextDocuments({
            projectId: input.projectId,
            linearId: task.linearId,
            context: {
              figma: shouldSaveFigma ? result.externalContext.figma : undefined,
              sentry: shouldSaveSentry ? result.externalContext.sentry : undefined,
              githubIssue: shouldSaveGitHub ? result.externalContext.githubIssue : undefined,
            },
            taskContext: { title: task.title, identifier: task.identifier },
          });

          console.log('[refinementWorkflow] External context documents created', {
            figma: !!externalDocs.figmaDocumentId,
            sentry: !!externalDocs.sentryDocumentId,
            githubIssue: !!externalDocs.githubIssueDocumentId,
          });
        } catch (externalContextError) {
          // Non-blocking: Log warning but continue workflow
          console.warn('[refinementWorkflow] Failed to save external context documents:', externalContextError);
        }
      }
    }

    // Step 3.6: Update title and description with reformulated versions (in English)
    // The reformulated description becomes the new base, and refinement markdown will be appended
    if (result.refinement.suggestedTitle || result.refinement.reformulatedDescription) {
      await updateLinearTask({
        projectId: input.projectId,
        linearId: task.linearId,
        updates: {
          title: result.refinement.suggestedTitle || undefined,
          description: result.refinement.reformulatedDescription || undefined,
        },
      });
      console.log('[refinementWorkflow] Title and description updated with English versions');
    }

    // Step 4: Append refinement to Linear issue
    await appendRefinementToLinearIssue({
      projectId: input.projectId,
      linearId: task.linearId,
      refinement: result.refinement,
    });

    // Step 4.5: Create sub-issues if complexity L or XL (BLOCKING)
    // Use automation config feature flag (fallback to legacy config)
    let subtasksCreated: { total: number; created: number; failed: number } | undefined;
    const enableSubtasks = features.enableSubtaskCreation ?? config.linear.features?.enableSubtaskCreation ?? true;

    if (
      enableSubtasks &&
      result.refinement.suggestedSplit &&
      (result.refinement.complexityEstimate === 'L' || result.refinement.complexityEstimate === 'XL')
    ) {
      // NOTE: No try-catch - let errors propagate to fail the workflow
      const subtaskResult = await createLinearSubtasks({
        projectId: input.projectId,
        parentIssueId: task.linearId,
        proposedStories: result.refinement.suggestedSplit.proposedStories,
      });

      // Check if any sub-issues failed to create
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

    // Step 4.6: Check for questions requiring PO answers (conditional)
    const questions = result.refinement.questionsForPO || [];
    const hasNewQuestions = questions.length > 0;
    const previouslyAnsweredCount = poAnswersResult.answers.length;

    // If there are new questions and we haven't gotten all answers yet
    // (new questions may appear even after some answers were provided)
    // Only post questions if PO questions feature is enabled
    if (features.enablePOQuestions && hasNewQuestions) {
      // Post questions as individual comments in Linear
      await postQuestionsAsComments({
        taskId: task.id,
        projectId: input.projectId,
        linearIssueId: task.linearId,
        questions: questions,
      });

      // Return blocked - don't update status to Refinement Ready
      // Status stays "Refinement In Progress" until PO answers all questions
      return {
        success: true,
        phase: 'refinement',
        message: `Refinement blocked - ${questions.length} question(s) en attente de réponse du Product Owner`,
        refinement: result.refinement,
        subtasksCreated,
        blocked: true,
        waitingForAnswers: true,
        questionsCount: questions.length,
      };
    }

    // No questions (or all answered) - proceed to Refinement Ready
    // Step 5: Update status to Refinement Ready (conditional)
    if (features.enableAutoStatusUpdate) {
      await updateLinearTask({
        projectId: input.projectId,
        linearId: task.linearId,
        updates: { status: LINEAR_STATUSES.refinementReady },
      });
    }

    return {
      success: true,
      phase: 'refinement',
      message: previouslyAnsweredCount > 0
        ? `Refinement complete for task ${task.identifier} (${previouslyAnsweredCount} réponse(s) PO intégrée(s))`
        : `Refinement complete for task ${task.identifier}`,
      refinement: result.refinement,
      subtasksCreated,
    };
  } catch (error) {
    // Update status to Refinement Failed (conditional)
    if (features.enableAutoStatusUpdate) {
      try {
        const task = await syncLinearTask({
          taskId: input.taskId,
          projectId: input.projectId,
        });

        await updateLinearTask({
          projectId: input.projectId,
          linearId: task.linearId,
          updates: { status: LINEAR_STATUSES.refinementFailed },
        });
      } catch (updateError) {
        // Log but don't throw - original error is more important
        console.error('Failed to update status to refinementFailed:', updateError);
      }
    }

    // Throw original error
    throw ApplicationFailure.create({
      message: `Refinement workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'RefinementWorkflowFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
