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

import { executeChild, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowConfig, TechnicalPlanPhaseConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';

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

  try {
    // Step 1: Sync task from Linear
    const task = await executeChild(syncLinearTaskWorkflow, {
      workflowId: `sync-task-${input.taskId}-${Date.now()}`,
      args: [{ taskId: input.taskId, projectId: input.projectId }],
    });

    // Step 2: Update status to Plan In Progress (conditional)
    if (features.enableAutoStatusUpdate) {
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
    }

    // Step 3: Get codebase context document (conditional)
    let ragContext: ReturnType<typeof parseCodebaseContextDocument> = null;
    if (features.reuseCodebaseContext) {
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

      // Step 4: Parse codebase context (local function)
      ragContext = codebaseContextDoc.content
        ? parseCodebaseContextDocument(codebaseContextDoc.content)
        : null;
    }

    // Step 5: Get documentation context document (conditional)
    let documentationContext: string | undefined;
    if (features.reuseDocumentationContext) {
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
    }

    // Step 6: Get user story document
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

    // Step 7: Parse user story (local function)
    if (userStoryDoc.content) {
      userStory = parseUserStoryFromDocument(userStoryDoc.content);
    } else {
      // Fallback to description extraction
      userStory = extractUserStoryFromDescription(task.description);
    }

    // Step 8: Fetch best practices (conditional)
    const taskLanguage = ragContext?.chunks?.[0]?.language;
    let bestPracticesResult: any | undefined;

    if (features.enableBestPracticesQuery) {
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

      // Step 9: Save best practices document (conditional)
      if (
        bestPracticesResult.bestPractices &&
        bestPracticesResult.bestPractices !== 'Unable to fetch best practices at this time.'
      ) {
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
      }
    }

    // Step 10: Generate technical plan (AI)
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

    // Step 11: Append technical plan to issue
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

    // Step 12: Update status to Plan Ready (conditional)
    if (features.enableAutoStatusUpdate) {
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
    }

    return {
      success: true,
      phase: 'technical_plan',
      message: `Technical plan generated for task ${task.identifier}`,
      plan: result.plan,
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
