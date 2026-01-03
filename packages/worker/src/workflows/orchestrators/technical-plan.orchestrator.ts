/**
 * Technical Plan Orchestrator - Phase 3 of Three-Phase Agile Workflow
 *
 * Coordinates all technical plan step workflows:
 * 1. Sync task from Linear
 * 2. Update status to In Progress (conditional)
 * 3. Get codebase context document (conditional)
 * 4. Parse codebase context (local function)
 * 5. Get documentation context document (conditional)
 * 6. Get user story document
 * 7. Parse user story (local function)
 * 8. Fetch best practices (conditional)
 * 9. Save best practices document (conditional)
 * 10. Generate technical plan (AI)
 * 11. Append technical plan to issue
 * 12. Update status to Ready (conditional)
 */

import { executeChild, ApplicationFailure, proxyActivities, workflowInfo } from '@temporalio/workflow';
import type { WorkflowConfig, TechnicalPlanPhaseConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';
import type * as progressActivities from '../../activities/workflow-progress.activities';

// Import step workflows
import { syncLinearTaskWorkflow } from '../steps/common/sync-linear-task.workflow';
import { updateLinearStatusWorkflow } from '../steps/common/update-linear-status.workflow';
import { getPhaseDocumentWorkflow } from '../steps/common/get-phase-document.workflow';
import { fetchBestPracticesWorkflow } from '../steps/technical-plan/fetch-best-practices.workflow';
import { saveBestPracticesWorkflow } from '../steps/technical-plan/save-best-practices.workflow';
import { generateTechnicalPlanWorkflow } from '../steps/technical-plan/generate-technical-plan.workflow';
import { appendTechnicalPlanWorkflow } from '../steps/technical-plan/append-technical-plan.workflow';

export interface TechnicalPlanOrchestratorInput {
  taskId: string;
  projectId: string;
  config?: WorkflowConfig;
}

export interface TechnicalPlanOrchestratorResult {
  success: boolean;
  phase: 'technical_plan';
  message: string;
  plan?: any;
}

/**
 * Parse user story from Linear Document content
 */
function parseUserStoryFromDocument(documentContent: string): any {
  const actorMatch = documentContent.match(/\*\*As a\*\* ([^,\n]+)/);
  const goalMatch = documentContent.match(/\*\*I want\*\* ([^,\n]+)/);
  const benefitMatch = documentContent.match(/\*\*So that\*\* ([^.\n]+)/);

  const actor = actorMatch ? actorMatch[1].trim() : 'user';
  const goal = goalMatch ? goalMatch[1].trim() : '';
  const benefit = benefitMatch ? benefitMatch[1].trim() : '';

  const criteriaMatch = documentContent.match(/## Acceptance Criteria\n\n([\s\S]*?)(?=\n---|\n## |$)/);
  const acceptanceCriteria = criteriaMatch
    ? criteriaMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  const dodMatch = documentContent.match(/## Definition of Done\n\n([\s\S]*?)(?=\n---|\n## |$)/);
  const definitionOfDone = dodMatch
    ? dodMatch[1]
        .split('\n')
        .filter((line) => line.match(/^-/))
        .map((line) => line.replace(/^-\s*(\[[ x]\]\s*)?/, '').trim())
    : [];

  const businessValueMatch = documentContent.match(/## Business Value\n\n([\s\S]*?)(?=\n---|\n## |$)/);
  const businessValue = businessValueMatch ? businessValueMatch[1].trim() : '';

  const storyPointsMatch = documentContent.match(/\*\*Story Points:\*\* (\d+)/);
  const storyPoints = storyPointsMatch ? parseInt(storyPointsMatch[1], 10) : 5;

  return {
    userStory: {
      actor,
      goal,
      benefit,
    },
    acceptanceCriteria,
    definitionOfDone,
    businessValue,
    storyPoints,
  };
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
    startLine?: number;
    endLine?: number;
    chunkType?: string;
  }>;
  retrievalTimeMs: number;
  totalChunks: number;
} | null {
  if (!documentContent) return null;

  const chunks: Array<{
    filePath: string;
    content: string;
    score: number;
    language: string;
    startLine?: number;
    endLine?: number;
    chunkType?: string;
  }> = [];

  const sectionRegex =
    /###\s*\d+\.\s*`([^`]+)`\n\n\*\*Score:\*\*\s*([\d.]+)%\s*\|\s*\*\*Language:\*\*\s*(\w+)(?:\n\*\*Lines:\*\*\s*(\d+)-(\d+))?(?:\n\*\*Type:\*\*\s*(\w+))?[\s\S]*?```\w*\n([\s\S]*?)```/g;

  let match;
  while ((match = sectionRegex.exec(documentContent)) !== null) {
    const [, filePath, scoreStr, language, startLineStr, endLineStr, chunkType, content] = match;

    chunks.push({
      filePath,
      content: content.trim(),
      score: parseFloat(scoreStr) / 100,
      language,
      startLine: startLineStr ? parseInt(startLineStr, 10) : undefined,
      endLine: endLineStr ? parseInt(endLineStr, 10) : undefined,
      chunkType: chunkType || undefined,
    });
  }

  if (chunks.length === 0) return null;

  return {
    chunks,
    retrievalTimeMs: 0,
    totalChunks: chunks.length,
  };
}

/**
 * Extract user story from Linear issue description (legacy format)
 */
function extractUserStoryFromDescription(description: string): any {
  const userStoryMatch = description.match(/# User Story[\s\S]*?(?=\n# |$)/);
  if (!userStoryMatch) {
    const phaseMatch = description.match(/## 2️⃣ Phase 2: User Story[\s\S]*?(?=\n## [123]️⃣|$)/);
    if (phaseMatch) {
      return parseUserStoryFromDocument(phaseMatch[0]);
    }

    return {
      userStory: {
        actor: 'user',
        goal: description.split('\n')[0] || 'Complete the task',
        benefit: 'improve the application',
      },
      acceptanceCriteria: [],
      definitionOfDone: [],
      businessValue: '',
      storyPoints: 5,
    };
  }

  const userStoryText = userStoryMatch[0];

  const actorMatch = userStoryText.match(/\*\*As a\*\* ([^,\n]+)/);
  const goalMatch = userStoryText.match(/\*\*I want\*\* ([^,\n]+)/);
  const benefitMatch = userStoryText.match(/\*\*So that\*\* ([^.\n]+)/);

  const actor = actorMatch ? actorMatch[1].trim() : 'user';
  const goal = goalMatch ? goalMatch[1].trim() : '';
  const benefit = benefitMatch ? benefitMatch[1].trim() : '';

  const criteriaMatch = userStoryText.match(/## Acceptance Criteria\n\n([\s\S]*?)(?=\n## |$)/);
  const acceptanceCriteria = criteriaMatch
    ? criteriaMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  const dodMatch = userStoryText.match(/## Definition of Done\n\n([\s\S]*?)(?=\n## |$)/);
  const definitionOfDone = dodMatch
    ? dodMatch[1]
        .split('\n')
        .filter((line) => line.match(/^-/))
        .map((line) => line.replace(/^-\s*/, '').trim())
    : [];

  const businessValueMatch = userStoryText.match(/## Business Value\n\n([\s\S]*?)(?=\n## |$)/);
  const businessValue = businessValueMatch ? businessValueMatch[1].trim() : '';

  const storyPointsMatch = userStoryText.match(/\*\*Story Points:\*\* (\d+)/);
  const storyPoints = storyPointsMatch ? parseInt(storyPointsMatch[1], 10) : 5;

  return {
    userStory: {
      actor,
      goal,
      benefit,
    },
    acceptanceCriteria,
    definitionOfDone,
    businessValue,
    storyPoints,
  };
}

export async function technicalPlanOrchestrator(
  input: TechnicalPlanOrchestratorInput
): Promise<TechnicalPlanOrchestratorResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  // Get automation config with defaults
  const automation: TechnicalPlanPhaseConfig =
    config.automation?.phases?.technicalPlan || DEFAULT_AUTOMATION_CONFIG.phases.technicalPlan;
  const features = automation.features;

  // Configure progress logging activities
  const { logWorkflowProgress, logWorkflowFailure } = proxyActivities<typeof progressActivities>({
    startToCloseTimeout: '10 seconds',
    retry: { maximumAttempts: 3 },
  });

  const workflowId = workflowInfo().workflowId;
  const TOTAL_STEPS = 12;
  const PHASE = 'technical_plan' as const;
  const projectId = input.projectId;
  const taskId = input.taskId;

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

    // Step 2: Update status to Plan In Progress (conditional)
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
            status: LINEAR_STATUSES.planInProgress,
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
        metadata: { status: LINEAR_STATUSES.planInProgress },
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

    // Step 3: Get codebase context document (conditional)
    let ragContext: ReturnType<typeof parseCodebaseContextDocument> = null;
    if (features.reuseCodebaseContext) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Codebase Context Document',
        stepNumber: 3,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step3Start = Date.now();
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

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Codebase Context Document',
        stepNumber: 3,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step3Start),
        completedAt: new Date(),
        metadata: { hasContext: !!codebaseContextDoc.content, contentLength: codebaseContextDoc.content?.length || 0 },
      });

      // Step 4: Parse codebase context (local function)
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Parse Codebase Context',
        stepNumber: 4,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step4Start = Date.now();
      ragContext = codebaseContextDoc.content
        ? parseCodebaseContextDocument(codebaseContextDoc.content)
        : null;

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Parse Codebase Context',
        stepNumber: 4,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step4Start),
        completedAt: new Date(),
        metadata: { chunksCount: ragContext?.chunks?.length || 0, hasParsedContext: !!ragContext },
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Codebase Context Document (disabled)',
        stepNumber: 3,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Parse Codebase Context (disabled)',
        stepNumber: 4,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Step 5: Get documentation context document (conditional)
    let documentationContext: string | undefined;
    if (features.reuseDocumentationContext) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Documentation Context Document',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step5Start = Date.now();
      const documentationContextDoc = await executeChild(getPhaseDocumentWorkflow, {
        workflowId: `get-docs-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            phase: 'documentation_context' as const,
          },
        ],
      });

      if (documentationContextDoc.content) {
        documentationContext = documentationContextDoc.content;
      }

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Documentation Context Document',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step5Start),
        completedAt: new Date(),
        metadata: { hasContext: !!documentationContext, contentLength: documentationContext?.length || 0 },
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Get Documentation Context Document (disabled)',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Step 6: Get user story document
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Get User Story Document',
      stepNumber: 6,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step6Start = Date.now();
    let userStory: any;
    const userStoryDoc = await executeChild(getPhaseDocumentWorkflow, {
      workflowId: `get-user-story-${input.taskId}-${Date.now()}`,
      args: [
        {
          projectId: input.projectId,
          linearId: task.linearId,
          phase: 'user_story' as const,
        },
      ],
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Get User Story Document',
      stepNumber: 6,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step6Start),
      completedAt: new Date(),
      metadata: { hasDocument: !!userStoryDoc.content, contentLength: userStoryDoc.content?.length || 0 },
    });

    // Step 7: Parse user story (local function)
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Parse User Story',
      stepNumber: 7,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step7Start = Date.now();
    if (userStoryDoc.content) {
      userStory = parseUserStoryFromDocument(userStoryDoc.content);
    } else {
      // Fallback to description extraction
      userStory = extractUserStoryFromDescription(task.description);
    }

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Parse User Story',
      stepNumber: 7,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step7Start),
      completedAt: new Date(),
      metadata: {
        hasUserStory: !!userStory,
        storyPoints: userStory?.storyPoints,
        criteriaCount: userStory?.acceptanceCriteria?.length || 0,
      },
    });

    // Step 8: Fetch best practices (conditional)
    const taskLanguage = ragContext?.chunks?.[0]?.language;
    let bestPracticesResult: any | undefined;

    if (features.enableBestPracticesQuery) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Fetch Best Practices',
        stepNumber: 8,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step8Start = Date.now();
      bestPracticesResult = await executeChild(fetchBestPracticesWorkflow, {
        workflowId: `fetch-best-practices-${input.taskId}-${Date.now()}`,
        args: [
          {
            task: {
              title: task.title,
              description: task.description,
            },
            projectId: input.projectId,
            context: taskLanguage
              ? {
                  language: taskLanguage,
                  framework: undefined,
                }
              : undefined,
          },
        ],
      });

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Fetch Best Practices',
        stepNumber: 8,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step8Start),
        completedAt: new Date(),
        metadata: {
          language: taskLanguage,
          hasBestPractices: !!bestPracticesResult?.bestPractices,
        },
      });

      // Step 9: Save best practices document (conditional)
      if (
        bestPracticesResult.bestPractices &&
        bestPracticesResult.bestPractices !== 'Unable to fetch best practices at this time.'
      ) {
        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Save Best Practices Document',
          stepNumber: 9,
          totalSteps: TOTAL_STEPS,
          status: 'in_progress',
          startedAt: new Date(),
        });

        const step9Start = Date.now();
        await executeChild(saveBestPracticesWorkflow, {
          workflowId: `save-best-practices-${input.taskId}-${Date.now()}`,
          args: [
            {
              projectId: input.projectId,
              linearId: task.linearId,
              bestPractices: bestPracticesResult,
              taskContext: {
                title: task.title,
                language: taskLanguage,
                framework: undefined,
              },
            },
          ],
        });

        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Save Best Practices Document',
          stepNumber: 9,
          totalSteps: TOTAL_STEPS,
          status: 'completed',
          startedAt: new Date(step9Start),
          completedAt: new Date(),
        });
      } else {
        await logWorkflowProgress({
          workflowId,
          projectId,
          taskId,
          phase: PHASE,
          stepName: 'Save Best Practices Document (no practices to save)',
          stepNumber: 9,
          totalSteps: TOTAL_STEPS,
          status: 'skipped',
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Fetch Best Practices (disabled)',
        stepNumber: 8,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Save Best Practices Document (disabled)',
        stepNumber: 9,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Step 10: Generate technical plan (AI)
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Generate Technical Plan (AI)',
      stepNumber: 10,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step10Start = Date.now();
    const result = await executeChild(generateTechnicalPlanWorkflow, {
      workflowId: `generate-technical-plan-${input.taskId}-${Date.now()}`,
      args: [
        {
          task,
          projectId: input.projectId,
          userStory,
          ragContext,
          bestPractices: bestPracticesResult,
          documentationContext,
          aiModel: automation.aiModel,
          enableCouncilAI: features.enableCouncilAI,
          councilModels: automation.councilModels,
          councilChairmanModel: automation.councilChairmanModel,
        },
      ],
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Generate Technical Plan (AI)',
      stepNumber: 10,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step10Start),
      completedAt: new Date(),
      metadata: {
        aiModel: automation.aiModel,
        enableCouncilAI: features.enableCouncilAI,
        hasRagContext: !!ragContext,
        hasBestPractices: !!bestPracticesResult,
        hasDocContext: !!documentationContext,
      },
    });

    // Step 11: Append technical plan to issue
    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Append Technical Plan to Issue',
      stepNumber: 11,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const step11Start = Date.now();
    await executeChild(appendTechnicalPlanWorkflow, {
      workflowId: `append-technical-plan-${input.taskId}-${Date.now()}`,
      args: [
        {
          projectId: input.projectId,
          linearId: task.linearId,
          plan: result.plan,
          contextUsed: result.contextUsed,
          council: result.council,
          bestPractices: bestPracticesResult,
        },
      ],
    });

    await logWorkflowProgress({
      workflowId,
      projectId,
      taskId,
      phase: PHASE,
      stepName: 'Append Technical Plan to Issue',
      stepNumber: 11,
      totalSteps: TOTAL_STEPS,
      status: 'completed',
      startedAt: new Date(step11Start),
      completedAt: new Date(),
    });

    // Step 12: Update status to Plan Ready (conditional)
    if (features.enableAutoStatusUpdate) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Ready',
        stepNumber: 12,
        totalSteps: TOTAL_STEPS,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const step12Start = Date.now();
      await executeChild(updateLinearStatusWorkflow, {
        workflowId: `status-ready-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            status: LINEAR_STATUSES.planReady,
          },
        ],
      });

      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Ready',
        stepNumber: 12,
        totalSteps: TOTAL_STEPS,
        status: 'completed',
        startedAt: new Date(step12Start),
        completedAt: new Date(),
        metadata: { status: LINEAR_STATUSES.planReady },
      });
    } else {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase: PHASE,
        stepName: 'Update Status to Ready (disabled)',
        stepNumber: 12,
        totalSteps: TOTAL_STEPS,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    return {
      success: true,
      phase: 'technical_plan',
      message: `Technical plan generated for task ${task.identifier}`,
      plan: result.plan,
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
              status: LINEAR_STATUSES.planFailed,
            },
          ],
        });
      } catch (updateError) {
        console.error('[technicalPlanOrchestrator] Failed to update status to Failed:', updateError);
      }
    }

    throw ApplicationFailure.create({
      message: `Technical plan orchestrator failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'TechnicalPlanOrchestratorFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
