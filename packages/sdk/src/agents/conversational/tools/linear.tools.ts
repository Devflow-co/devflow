/**
 * Linear Tools - Tools for interacting with Linear issues
 */

import { RegisteredTool, ToolExecutionContext } from './tool.types';
import { defineTool } from '../tool-registry';

/**
 * Get a Linear issue by ID
 */
const linearGetIssue = defineTool(
  'linear_get_issue',
  'Get detailed information about a Linear issue by its ID. Returns issue title, description, status, assignee, labels, and other metadata.',
  {
    type: 'object',
    properties: {
      issueId: {
        type: 'string',
        description: 'The Linear issue ID (UUID format, e.g., "abc123-def456-...")',
      },
    },
    required: ['issueId'],
  },
  async (args, context) => {
    const { issueId } = args as { issueId: string };

    if (!context.services.linear?.getIssue) {
      throw new Error('Linear service not available');
    }

    const issue = await context.services.linear.getIssue(issueId);
    return issue;
  },
  'linear'
);

/**
 * Create a new Linear issue
 */
const linearCreateIssue = defineTool(
  'linear_create_issue',
  'Create a new Linear issue with title, description, and optional team/labels. Returns the created issue details.',
  {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The issue title (clear, concise, actionable)',
      },
      description: {
        type: 'string',
        description: 'Detailed description of the issue (markdown supported)',
      },
      teamId: {
        type: 'string',
        description: 'The team ID to create the issue in',
      },
      labels: {
        type: 'array',
        description: 'Array of label names to apply',
        items: { type: 'string' },
      },
      priority: {
        type: 'number',
        description: 'Priority level (0=none, 1=urgent, 2=high, 3=normal, 4=low)',
      },
      assigneeId: {
        type: 'string',
        description: 'User ID to assign the issue to',
      },
    },
    required: ['title', 'teamId'],
  },
  async (args, context) => {
    const { title, description, teamId, labels, priority, assigneeId } = args as {
      title: string;
      description?: string;
      teamId: string;
      labels?: string[];
      priority?: number;
      assigneeId?: string;
    };

    if (!context.services.linear?.createIssue) {
      throw new Error('Linear service not available');
    }

    const issue = await context.services.linear.createIssue({
      title,
      description,
      teamId,
      labels,
      priority,
      assigneeId,
    });

    return issue;
  },
  'linear'
);

/**
 * Update issue status
 */
const linearUpdateStatus = defineTool(
  'linear_update_status',
  'Update the status of a Linear issue. Common statuses: "Backlog", "To Do", "In Progress", "In Review", "Done", "Canceled".',
  {
    type: 'object',
    properties: {
      issueId: {
        type: 'string',
        description: 'The Linear issue ID',
      },
      status: {
        type: 'string',
        description: 'The new status name (e.g., "In Progress", "Done")',
      },
    },
    required: ['issueId', 'status'],
  },
  async (args, context) => {
    const { issueId, status } = args as { issueId: string; status: string };

    if (!context.services.linear?.updateStatus) {
      throw new Error('Linear service not available');
    }

    await context.services.linear.updateStatus(issueId, status);
    return { success: true, issueId, newStatus: status };
  },
  'linear'
);

/**
 * Add comment to issue
 */
const linearAddComment = defineTool(
  'linear_add_comment',
  'Add a comment to a Linear issue. Supports markdown formatting.',
  {
    type: 'object',
    properties: {
      issueId: {
        type: 'string',
        description: 'The Linear issue ID',
      },
      body: {
        type: 'string',
        description: 'The comment body (markdown supported)',
      },
    },
    required: ['issueId', 'body'],
  },
  async (args, context) => {
    const { issueId, body } = args as { issueId: string; body: string };

    if (!context.services.linear?.addComment) {
      throw new Error('Linear service not available');
    }

    const commentId = await context.services.linear.addComment(issueId, body);
    return { success: true, issueId, commentId };
  },
  'linear'
);

/**
 * Query Linear issues
 */
const linearQueryIssues = defineTool(
  'linear_query_issues',
  'Search and filter Linear issues by team, status, assignee, or labels. Returns a list of matching issues.',
  {
    type: 'object',
    properties: {
      teamId: {
        type: 'string',
        description: 'Filter by team ID',
      },
      status: {
        type: 'string',
        description: 'Filter by status name (e.g., "In Progress")',
      },
      assigneeId: {
        type: 'string',
        description: 'Filter by assignee user ID',
      },
      labels: {
        type: 'array',
        description: 'Filter by label names',
        items: { type: 'string' },
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 20)',
      },
    },
    required: [],
  },
  async (args, context) => {
    const { teamId, status, assigneeId, labels, limit } = args as {
      teamId?: string;
      status?: string;
      assigneeId?: string;
      labels?: string[];
      limit?: number;
    };

    if (!context.services.linear?.queryIssues) {
      throw new Error('Linear service not available');
    }

    const issues = await context.services.linear.queryIssues({
      teamId,
      status,
      assigneeId,
      labels,
      limit: limit ?? 20,
    });

    return {
      count: issues.length,
      issues: issues.slice(0, limit ?? 20),
    };
  },
  'linear'
);

/**
 * All Linear tools
 */
export const linearTools: RegisteredTool[] = [
  linearGetIssue,
  linearCreateIssue,
  linearUpdateStatus,
  linearAddComment,
  linearQueryIssues,
];

export {
  linearGetIssue,
  linearCreateIssue,
  linearUpdateStatus,
  linearAddComment,
  linearQueryIssues,
};
