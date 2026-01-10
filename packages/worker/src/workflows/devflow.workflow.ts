/**
 * Main DevFlow Orchestration Workflow - Four-Phase Agile Router
 *
 * Routes to appropriate orchestrator based on Linear task status:
 * - To Refinement → Refinement Orchestrator (Phase 1)
 * - To User Story / Refinement Ready → User Story Orchestrator (Phase 2)
 * - To Plan / UserStory Ready → Technical Plan Orchestrator (Phase 3)
 * - To Code / Plan Ready → Code Generation Orchestrator (Phase 4)
 *
 * Uses atomic workflow architecture where each orchestrator coordinates
 * multiple step workflows for better observability and retry isolation.
 */

import { executeChild, proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowInput, WorkflowResult } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';

// Import orchestrators (replace old phase workflows)
import { refinementOrchestrator } from './orchestrators/refinement.orchestrator';
import { userStoryOrchestrator } from './orchestrators/user-story.orchestrator';
import { technicalPlanOrchestrator } from './orchestrators/technical-plan.orchestrator';
import { codeGenerationOrchestrator } from './orchestrators/code-generation.orchestrator';

// Import activity types
import type * as activities from '@/activities';

// Simple activity proxy for syncing Linear tasks (used for routing decision)
const { syncLinearTask } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

/**
 * Main DevFlow Workflow Router
 * Routes to appropriate sub-workflow based on Linear task status
 */
export async function devflowWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  try {
    // Sync task from Linear to get current status
    const task = await syncLinearTask({
      taskId: input.taskId,
      projectId: input.projectId,
    });

    // DEBUG: Log task status and expected status
    console.log('[devflowWorkflow] Task status:', task.status);
    console.log('[devflowWorkflow] Expected toRefinement:', LINEAR_STATUSES.toRefinement);
    console.log('[devflowWorkflow] Status match:', task.status === LINEAR_STATUSES.toRefinement);

    // Route to appropriate orchestrator based on status
    // Phase 1: Refinement (also accepts "In Progress" for PO answer re-triggers)
    if (
      task.status === LINEAR_STATUSES.toRefinement ||
      task.status === LINEAR_STATUSES.refinementInProgress
    ) {
      const result = await executeChild(refinementOrchestrator, {
        workflowId: `refinement-${input.taskId}-${Date.now()}`,
        args: [
          {
            taskId: input.taskId,
            projectId: input.projectId,
            config,
          },
        ],
      });

      return {
        success: true,
        stage: 'refinement' as any,
        data: result,
        timestamp: new Date(),
      };
    }

    // Phase 2: User Story (also accepts "In Progress" for PO answer re-triggers)
    if (
      task.status === LINEAR_STATUSES.toUserStory ||
      task.status === LINEAR_STATUSES.userStoryInProgress
    ) {
      const result = await executeChild(userStoryOrchestrator, {
        workflowId: `user-story-${input.taskId}-${Date.now()}`,
        args: [
          {
            taskId: input.taskId,
            projectId: input.projectId,
            config,
          },
        ],
      });

      return {
        success: true,
        stage: 'user_story' as any,
        data: result,
        timestamp: new Date(),
      };
    }

    // Phase 3: Technical Plan (also accepts "In Progress" for PO answer re-triggers)
    if (
      task.status === LINEAR_STATUSES.toPlan ||
      task.status === LINEAR_STATUSES.planInProgress
    ) {
      const result = await executeChild(technicalPlanOrchestrator, {
        workflowId: `technical-plan-${input.taskId}-${Date.now()}`,
        args: [
          {
            taskId: input.taskId,
            projectId: input.projectId,
            config,
          },
        ],
      });

      return {
        success: true,
        stage: 'technical_plan' as any,
        data: result,
        timestamp: new Date(),
      };
    }

    // Phase 4: Code Generation (Ollama - local LLM, no cloud fallback)
    if (
      task.status === LINEAR_STATUSES.toCode ||
      task.status === LINEAR_STATUSES.codeInProgress
    ) {
      const result = await executeChild(codeGenerationOrchestrator, {
        workflowId: `code-generation-${input.taskId}-${Date.now()}`,
        args: [
          {
            taskId: input.taskId,
            projectId: input.projectId,
            config,
          },
        ],
      });

      return {
        success: true,
        stage: 'code_generation' as any,
        data: result,
        timestamp: new Date(),
      };
    }

    // No matching workflow trigger found
    throw ApplicationFailure.create({
      message:
        `Status "${task.status}" is not a valid workflow trigger for the four-phase Agile system. ` +
        `Expected one of: ` +
        `"${LINEAR_STATUSES.toRefinement}" (Phase 1), ` +
        `"${LINEAR_STATUSES.toUserStory}" (Phase 2), ` +
        `"${LINEAR_STATUSES.toPlan}" (Phase 3), ` +
        `"${LINEAR_STATUSES.toCode}" (Phase 4)`,
      type: 'InvalidWorkflowTrigger',
    });
  } catch (error) {
    return {
      success: false,
      stage: 'routing' as any,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { error },
      timestamp: new Date(),
    };
  }
}
