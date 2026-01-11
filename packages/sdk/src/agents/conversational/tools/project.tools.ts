/**
 * Project Tools - Tools for project context and task management
 */

import { RegisteredTool } from './tool.types';
import { defineTool } from '../tool-registry';

/**
 * Get project context
 */
const projectGetContext = defineTool(
  'project_get_context',
  'Get the current project context including name, description, language, framework, and repository information.',
  {
    type: 'object',
    properties: {},
    required: [],
  },
  async (_args, context) => {
    // The project context is available directly from the agent context
    // This tool provides it in a structured way for the LLM
    return {
      projectId: context.projectId,
      // Additional context would be populated from project settings
      message: 'Project context retrieved. Use other tools to get more specific information about the codebase.',
    };
  },
  'project'
);

/**
 * List recent tasks
 */
const projectListTasks = defineTool(
  'project_list_tasks',
  'List recent tasks/issues for the current project. Combines data from Linear with project context.',
  {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status (e.g., "In Progress", "To Do")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of tasks to return (default: 10)',
      },
    },
    required: [],
  },
  async (args, context) => {
    const { status, limit } = args as { status?: string; limit?: number };

    // Use Linear tools internally if available
    if (context.services.linear?.queryIssues) {
      const issues = await context.services.linear.queryIssues({
        status,
        limit: limit ?? 10,
      });

      return {
        projectId: context.projectId,
        count: issues.length,
        tasks: issues,
      };
    }

    return {
      projectId: context.projectId,
      count: 0,
      tasks: [],
      message: 'Linear service not available. Configure Linear OAuth to list tasks.',
    };
  },
  'project'
);

/**
 * Get task details
 */
const projectGetTask = defineTool(
  'project_get_task',
  'Get detailed information about a specific task including its Linear issue data, refinement status, and workflow progress.',
  {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The task/issue ID',
      },
    },
    required: ['taskId'],
  },
  async (args, context) => {
    const { taskId } = args as { taskId: string };

    // Use Linear tools internally if available
    if (context.services.linear?.getIssue) {
      const issue = await context.services.linear.getIssue(taskId);

      return {
        projectId: context.projectId,
        task: issue,
      };
    }

    return {
      projectId: context.projectId,
      taskId,
      message: 'Linear service not available. Configure Linear OAuth to get task details.',
    };
  },
  'project'
);

/**
 * All Project tools
 */
export const projectTools: RegisteredTool[] = [
  projectGetContext,
  projectListTasks,
  projectGetTask,
];

export {
  projectGetContext,
  projectListTasks,
  projectGetTask,
};
