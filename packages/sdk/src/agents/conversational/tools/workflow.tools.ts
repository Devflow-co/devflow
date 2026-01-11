/**
 * Workflow Tools - Tools for triggering and managing DevFlow workflows
 */

import { RegisteredTool, WorkflowPhase } from './tool.types';
import { defineTool } from '../tool-registry';

/**
 * Start refinement workflow
 */
const workflowStartRefinement = defineTool(
  'workflow_start_refinement',
  'Start the Refinement workflow (Phase 1) for a task. This analyzes the task description and generates business context, objectives, and preliminary acceptance criteria.',
  {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The Linear issue/task ID to refine',
      },
    },
    required: ['taskId'],
  },
  async (args, context) => {
    const { taskId } = args as { taskId: string };

    if (!context.services.workflow?.start) {
      throw new Error('Workflow service not available');
    }

    const result = await context.services.workflow.start(taskId, 'refinement');

    return {
      success: true,
      workflowId: result.workflowId,
      phase: 'refinement',
      status: result.status,
      message: `Refinement workflow started for task ${taskId}`,
    };
  },
  'workflow'
);

/**
 * Start user story workflow
 */
const workflowStartUserStory = defineTool(
  'workflow_start_user_story',
  'Start the User Story workflow (Phase 2) for a task. This generates a formal user story with acceptance criteria and definition of done. The task should have completed refinement first.',
  {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The Linear issue/task ID',
      },
    },
    required: ['taskId'],
  },
  async (args, context) => {
    const { taskId } = args as { taskId: string };

    if (!context.services.workflow?.start) {
      throw new Error('Workflow service not available');
    }

    const result = await context.services.workflow.start(taskId, 'user_story');

    return {
      success: true,
      workflowId: result.workflowId,
      phase: 'user_story',
      status: result.status,
      message: `User Story workflow started for task ${taskId}`,
    };
  },
  'workflow'
);

/**
 * Start technical plan workflow
 */
const workflowStartTechnicalPlan = defineTool(
  'workflow_start_technical_plan',
  'Start the Technical Plan workflow (Phase 3) for a task. This generates architecture decisions, implementation steps, and testing strategy. The task should have a completed user story first.',
  {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The Linear issue/task ID',
      },
    },
    required: ['taskId'],
  },
  async (args, context) => {
    const { taskId } = args as { taskId: string };

    if (!context.services.workflow?.start) {
      throw new Error('Workflow service not available');
    }

    const result = await context.services.workflow.start(taskId, 'technical_plan');

    return {
      success: true,
      workflowId: result.workflowId,
      phase: 'technical_plan',
      status: result.status,
      message: `Technical Plan workflow started for task ${taskId}`,
    };
  },
  'workflow'
);

/**
 * Start code generation workflow
 */
const workflowStartCodeGeneration = defineTool(
  'workflow_start_code_generation',
  'Start the Code Generation workflow (Phase 4) for a task. This generates code implementation based on the technical plan and creates a draft PR. The task should have a completed technical plan first.',
  {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The Linear issue/task ID',
      },
    },
    required: ['taskId'],
  },
  async (args, context) => {
    const { taskId } = args as { taskId: string };

    if (!context.services.workflow?.start) {
      throw new Error('Workflow service not available');
    }

    const result = await context.services.workflow.start(taskId, 'code_generation');

    return {
      success: true,
      workflowId: result.workflowId,
      phase: 'code_generation',
      status: result.status,
      message: `Code Generation workflow started for task ${taskId}`,
    };
  },
  'workflow'
);

/**
 * Get workflow status
 */
const workflowGetStatus = defineTool(
  'workflow_get_status',
  'Get the current status and progress of a running or completed workflow.',
  {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'The workflow ID returned when starting a workflow',
      },
    },
    required: ['workflowId'],
  },
  async (args, context) => {
    const { workflowId } = args as { workflowId: string };

    if (!context.services.workflow?.getStatus) {
      throw new Error('Workflow service not available');
    }

    const status = await context.services.workflow.getStatus(workflowId);

    return {
      workflowId,
      phase: status.phase,
      status: status.status,
      progress: status.progress,
      error: status.error,
    };
  },
  'workflow'
);

/**
 * Cancel a workflow
 */
const workflowCancel = defineTool(
  'workflow_cancel',
  'Cancel a running workflow. Use this to stop a workflow that is stuck or no longer needed.',
  {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'The workflow ID to cancel',
      },
    },
    required: ['workflowId'],
  },
  async (args, context) => {
    const { workflowId } = args as { workflowId: string };

    if (!context.services.workflow?.cancel) {
      throw new Error('Workflow service not available');
    }

    await context.services.workflow.cancel(workflowId);

    return {
      success: true,
      workflowId,
      message: `Workflow ${workflowId} has been cancelled`,
    };
  },
  'workflow'
);

/**
 * All Workflow tools
 */
export const workflowTools: RegisteredTool[] = [
  workflowStartRefinement,
  workflowStartUserStory,
  workflowStartTechnicalPlan,
  workflowStartCodeGeneration,
  workflowGetStatus,
  workflowCancel,
];

export {
  workflowStartRefinement,
  workflowStartUserStory,
  workflowStartTechnicalPlan,
  workflowStartCodeGeneration,
  workflowGetStatus,
  workflowCancel,
};
