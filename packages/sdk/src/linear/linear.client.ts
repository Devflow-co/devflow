/**
 * Linear Client - SDK implementation using @linear/sdk
 */

import { LinearClient as LinearSDK, Issue, WorkflowState } from '@linear/sdk';
import { createLogger } from '@devflow/common';
import { LinearConfig, LinearIssue, LinearLabel, LinearQueryOptions, LinearTask } from '@/linear/linear.types';
import { LinearMapper } from '@/linear/linear.mapper';

export class LinearClient {
  private client: LinearSDK;
  private config: LinearConfig;
  private mapper: LinearMapper;
  private logger = createLogger('LinearClient');

  constructor(config: LinearConfig) {
    this.config = config;
    this.client = new LinearSDK({ apiKey: config.apiKey });
    this.mapper = new LinearMapper();
  }

  // ============================================
  // Issue Operations
  // ============================================

  /**
   * Get an issue by ID
   */
  async getIssue(issueId: string): Promise<Issue> {
    this.logger.info('Getting issue', { issueId });
    return this.client.issue(issueId);
  }

  /**
   * Get full issue details as LinearTask
   */
  async getTask(issueId: string): Promise<LinearTask> {
    this.logger.info('Getting task from Linear', { issueId });

    try {
      const issue = await this.client.issue(issueId);
      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();

      const linearIssue: LinearIssue = {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        priorityLabel: this.mapper.mapPriorityToLabel(issue.priority),
        state: state ? { id: state.id, name: state.name, color: state.color, type: state.type } : undefined,
        assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : undefined,
        labels: labels.nodes.map(l => ({ id: l.id, name: l.name, color: l.color })),
        url: issue.url,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
      };

      return this.mapper.issueToTask(linearIssue);
    } catch (error) {
      this.logger.error('Failed to get task', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Query issues by team and optional filters
   */
  async queryIssues(options?: LinearQueryOptions): Promise<LinearTask[]> {
    this.logger.info('Querying issues', options);

    try {
      const filter: any = {};

      if (options?.teamId) {
        filter.team = { id: { eq: options.teamId } };
      }

      if (options?.states && options.states.length > 0) {
        filter.state = { name: { in: options.states } };
      }

      if (options?.assigneeId) {
        filter.assignee = { id: { eq: options.assigneeId } };
      }

      if (options?.priority !== undefined) {
        filter.priority = { eq: options.priority };
      }

      const issues = await this.client.issues({
        filter,
        first: options?.first || 50,
        after: options?.after,
      });

      const tasks: LinearTask[] = [];
      for (const issue of issues.nodes) {
        const state = await issue.state;
        const assignee = await issue.assignee;
        const labels = await issue.labels();

        const linearIssue: LinearIssue = {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          priorityLabel: this.mapper.mapPriorityToLabel(issue.priority),
          state: state ? { id: state.id, name: state.name, color: state.color, type: state.type } : undefined,
          assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : undefined,
          labels: labels.nodes.map(l => ({ id: l.id, name: l.name, color: l.color })),
          url: issue.url,
          createdAt: issue.createdAt.toISOString(),
          updatedAt: issue.updatedAt.toISOString(),
        };

        tasks.push(this.mapper.issueToTask(linearIssue));
      }

      this.logger.info('Issues queried', { count: tasks.length });
      return tasks;
    } catch (error) {
      this.logger.error('Failed to query issues', error as Error);
      throw error;
    }
  }

  /**
   * Query issues by status name
   */
  async queryIssuesByStatus(statusName: string): Promise<LinearTask[]> {
    return this.queryIssues({ states: [statusName] });
  }

  // ============================================
  // Update Operations
  // ============================================

  /**
   * Update issue title
   */
  async updateTitle(issueId: string, title: string): Promise<void> {
    this.logger.info('Updating issue title', { issueId });

    try {
      await this.client.updateIssue(issueId, { title });
      this.logger.info('Title updated', { issueId });
    } catch (error) {
      this.logger.error('Failed to update title', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Update issue description (replace)
   */
  async updateDescription(issueId: string, description: string): Promise<void> {
    this.logger.info('Updating issue description', { issueId });

    try {
      await this.client.updateIssue(issueId, { description });
      this.logger.info('Description updated', { issueId });
    } catch (error) {
      this.logger.error('Failed to update description', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Update issue title and description in a single API call
   */
  async updateTitleAndDescription(issueId: string, title: string, description: string): Promise<void> {
    this.logger.info('Updating issue title and description', { issueId });

    try {
      await this.client.updateIssue(issueId, { title, description });
      this.logger.info('Title and description updated', { issueId });
    } catch (error) {
      this.logger.error('Failed to update title and description', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Append content to existing description
   */
  async appendToDescription(issueId: string, content: string): Promise<void> {
    this.logger.info('Appending to issue description', { issueId });

    try {
      const issue = await this.getIssue(issueId);
      const currentDescription = issue.description || '';
      const newDescription = currentDescription + '\n\n---\n\n' + content;

      await this.updateDescription(issueId, newDescription);
    } catch (error) {
      this.logger.error('Failed to append to description', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Update issue status by status name
   */
  async updateStatus(issueId: string, statusName: string): Promise<void> {
    this.logger.info('Updating issue status', { issueId, statusName });

    try {
      const issue = await this.getIssue(issueId);
      const team = await issue.team;

      if (!team) {
        throw new Error(`Issue ${issueId} has no team`);
      }

      const states = await team.states();
      const targetState = states.nodes.find(
        (s: WorkflowState) => s.name.toLowerCase() === statusName.toLowerCase()
      );

      if (!targetState) {
        throw new Error(`Status "${statusName}" not found in team workflow`);
      }

      await this.client.updateIssue(issueId, { stateId: targetState.id });
      this.logger.info('Status updated', { issueId, statusName });
    } catch (error) {
      this.logger.error('Failed to update status', error as Error, { issueId, statusName });
      throw error;
    }
  }

  // ============================================
  // Create Operations
  // ============================================

  /**
   * Create a new issue
   */
  async createIssue(input: {
    teamId: string;
    title: string;
    description?: string;
    stateId?: string;
    parentId?: string;
    priority?: number;
    assigneeId?: string;
    labelIds?: string[];
    subIssueSortOrder?: number;
  }): Promise<Issue> {
    this.logger.info('Creating issue', {
      teamId: input.teamId,
      title: input.title,
      parentId: input.parentId,
    });

    try {
      const issueInput: any = {
        teamId: input.teamId,
        title: input.title,
      };

      if (input.description) issueInput.description = input.description;
      if (input.stateId) issueInput.stateId = input.stateId;
      if (input.parentId) issueInput.parentId = input.parentId;
      if (input.priority !== undefined) issueInput.priority = input.priority;
      if (input.assigneeId) issueInput.assigneeId = input.assigneeId;
      if (input.labelIds) issueInput.labelIds = input.labelIds;
      if (input.subIssueSortOrder !== undefined) {
        issueInput.subIssueSortOrder = input.subIssueSortOrder;
      }

      const result = await this.client.createIssue(issueInput);
      const issue = await result.issue;

      if (!issue) {
        throw new Error('Issue creation returned null');
      }

      this.logger.info('Issue created', {
        issueId: issue.id,
        identifier: issue.identifier,
      });

      return issue;
    } catch (error) {
      this.logger.error('Failed to create issue', error as Error, input);
      throw error;
    }
  }

  // ============================================
  // Comment Operations
  // ============================================

  /**
   * Add a comment to an issue
   * @returns The created comment ID
   */
  async addComment(issueId: string, body: string): Promise<string> {
    this.logger.info('Adding comment to issue', { issueId });

    try {
      const result = await this.client.createComment({ issueId, body });
      const comment = await result.comment;
      const commentId = comment?.id || '';
      this.logger.info('Comment added', { issueId, commentId });
      return commentId;
    } catch (error) {
      this.logger.error('Failed to add comment', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Add a warning comment to an issue (for AI-generated content)
   */
  async addWarningComment(issueId: string, message?: string): Promise<void> {
    const warningMessage = message || process.env.LINEAR_SPEC_WARNING_MESSAGE ||
      '⚠️ This specification was generated by DevFlow. Please review before implementation.';

    await this.addComment(issueId, warningMessage);
  }

  /**
   * Get all comments for an issue
   */
  async getComments(issueId: string): Promise<LinearComment[]> {
    this.logger.info('Getting comments for issue', { issueId });

    try {
      const issue = await this.client.issue(issueId);
      const comments = await issue.comments();

      const result: LinearComment[] = [];

      for (const comment of comments.nodes) {
        const user = await comment.user;

        result.push({
          id: comment.id,
          body: comment.body,
          authorId: user?.id,
          authorName: user?.name,
          authorEmail: user?.email || undefined,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
        });
      }

      this.logger.info('Comments retrieved', { issueId, count: result.length });
      return result;
    } catch (error) {
      this.logger.error('Failed to get comments', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Get a single comment by ID
   */
  async getComment(commentId: string): Promise<LinearComment | null> {
    this.logger.info('Getting comment', { commentId });

    try {
      const comment = await this.client.comment({ id: commentId });

      if (!comment) {
        return null;
      }

      const user = await comment.user;

      return {
        id: comment.id,
        body: comment.body,
        authorId: user?.id,
        authorName: user?.name,
        authorEmail: user?.email || undefined,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get comment', error as Error, { commentId });
      return null;
    }
  }

  // ============================================
  // Utility Operations
  // ============================================

  /**
   * Test connection to Linear
   */
  async testConnection(): Promise<boolean> {
    try {
      const viewer = await this.client.viewer;
      this.logger.info('Connected to Linear', { user: viewer.name });
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Linear', error as Error);
      return false;
    }
  }

  /**
   * Get available workflow states for a team
   */
  async getWorkflowStates(teamId: string): Promise<Array<{ id: string; name: string; type: string; color?: string }>> {
    const team = await this.client.team(teamId);
    const states = await team.states();

    return states.nodes.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      color: s.color,
    }));
  }

  /**
   * Create a workflow state in a team
   * @param teamId - The team ID
   * @param name - State name (e.g., "To Refinement")
   * @param type - Linear workflow state type (triage, backlog, unstarted, started, completed, canceled)
   * @param color - Optional hex color for the state
   */
  async createWorkflowState(
    teamId: string,
    name: string,
    type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
    color?: string
  ): Promise<{ id: string; name: string; type: string }> {
    this.logger.info('Creating workflow state', { teamId, name, type });

    try {
      const mutation = `
        mutation WorkflowStateCreate($input: WorkflowStateCreateInput!) {
          workflowStateCreate(input: $input) {
            success
            workflowState {
              id
              name
              type
              color
            }
          }
        }
      `;

      const result = await this.client.client.rawRequest(mutation, {
        input: {
          teamId,
          name,
          type,
          color: color || undefined,
        },
      });

      const data = result.data as any;
      const workflowState = data?.workflowStateCreate?.workflowState;

      if (!workflowState) {
        throw new Error('Workflow state creation failed');
      }

      this.logger.info('Workflow state created', { teamId, name, id: workflowState.id });

      return {
        id: workflowState.id,
        name: workflowState.name,
        type: workflowState.type,
      };
    } catch (error) {
      this.logger.error('Failed to create workflow state', error as Error, { teamId, name });
      throw error;
    }
  }

  /**
   * Get teams accessible to the user
   */
  async getTeams(): Promise<Array<{ id: string; key: string; name: string }>> {
    const teams = await this.client.teams();

    return teams.nodes.map(t => ({
      id: t.id,
      key: t.key,
      name: t.name,
    }));
  }

  // ============================================
  // Label Operations
  // ============================================

  /**
   * Get all labels for a team
   */
  async getTeamLabels(teamId: string): Promise<LinearLabel[]> {
    this.logger.info('Getting labels for team', { teamId });

    try {
      const team = await this.client.team(teamId);
      const labels = await team.labels();

      const result = labels.nodes.map(l => ({
        id: l.id,
        name: l.name,
        color: l.color,
      }));

      this.logger.info('Team labels retrieved', { teamId, count: result.length });
      return result;
    } catch (error) {
      this.logger.error('Failed to get team labels', error as Error, { teamId });
      throw error;
    }
  }

  /**
   * Create a new label in a team
   */
  async createLabel(teamId: string, name: string, color?: string): Promise<LinearLabel> {
    this.logger.info('Creating label', { teamId, name, color });

    try {
      const result = await this.client.createIssueLabel({
        teamId,
        name,
        color: color || undefined,
      });

      const label = await result.issueLabel;

      if (!label) {
        throw new Error('Label creation returned null');
      }

      this.logger.info('Label created', { id: label.id, name: label.name });

      return {
        id: label.id,
        name: label.name,
        color: label.color,
      };
    } catch (error) {
      this.logger.error('Failed to create label', error as Error, { teamId, name });
      throw error;
    }
  }

  /**
   * Add labels to an existing issue (preserves existing labels)
   */
  async addLabelsToIssue(issueId: string, labelIds: string[]): Promise<void> {
    this.logger.info('Adding labels to issue', { issueId, labelIds });

    try {
      // Get current labels to preserve them
      const issue = await this.getIssue(issueId);
      const currentLabels = await issue.labels();
      const currentLabelIds = currentLabels.nodes.map(l => l.id);

      // Merge: keep existing + add new (avoid duplicates)
      const allLabelIds = [...new Set([...currentLabelIds, ...labelIds])];

      await this.client.updateIssue(issueId, { labelIds: allLabelIds });

      this.logger.info('Labels added to issue', {
        issueId,
        newCount: labelIds.length,
        totalCount: allLabelIds.length,
      });
    } catch (error) {
      this.logger.error('Failed to add labels to issue', error as Error, { issueId });
      throw error;
    }
  }

  // ============================================
  // Custom Fields Operations
  // ============================================

  /**
   * Get custom fields available for a team
   */
  async getCustomFields(teamId: string): Promise<LinearCustomField[]> {
    this.logger.info('Getting custom fields for team', { teamId });

    try {
      // Use GraphQL to get custom fields for a team
      const query = `
        query TeamCustomFields($teamId: String!) {
          team(id: $teamId) {
            customFields {
              nodes {
                id
                name
                type
              }
            }
          }
        }
      `;

      const result = await this.client.client.rawRequest(query, { teamId });
      const data = result.data as any;
      const customFields = data?.team?.customFields?.nodes || [];

      this.logger.info('Custom fields retrieved', { teamId, count: customFields.length });

      return customFields.map((field: any) => ({
        id: field.id,
        name: field.name,
        type: field.type?.toLowerCase() || 'text',
        teamId,
      }));
    } catch (error) {
      this.logger.error('Failed to get custom fields', error as Error, { teamId });
      throw error;
    }
  }

  /**
   * Create a custom field for a team
   */
  async createCustomField(teamId: string, name: string, type: string = 'text'): Promise<LinearCustomField> {
    this.logger.info('Creating custom field', { teamId, name, type });

    try {
      const mutation = `
        mutation CreateCustomField($input: CustomFieldCreateInput!) {
          customFieldCreate(input: $input) {
            success
            customField {
              id
              name
              type
            }
          }
        }
      `;

      const result = await this.client.client.rawRequest(mutation, {
        input: {
          teamId,
          name,
          type: type.toUpperCase(),
        },
      });

      const data = result.data as any;
      const customField = data?.customFieldCreate?.customField;

      if (!customField) {
        throw new Error('Custom field creation failed');
      }

      this.logger.info('Custom field created', { teamId, name, id: customField.id });

      return {
        id: customField.id,
        name: customField.name,
        type: customField.type?.toLowerCase() || 'text',
        teamId,
      };
    } catch (error) {
      this.logger.error('Failed to create custom field', error as Error, { teamId, name });
      throw error;
    }
  }

  /**
   * Get custom field values for an issue
   *
   * NOTE: Temporarily disabled - Linear API 'customFields' field is not available on Issue type.
   * The correct field name needs to be determined from Linear's current GraphQL schema.
   * Custom fields are optional for DevFlow workflows, so this returns an empty Map.
   *
   * TODO: Re-enable once we find the correct GraphQL field for issue custom field values.
   * Possible fields: customFieldValues, issueCustomFields, or via a separate query.
   */
  async getIssueCustomFields(issueId: string): Promise<Map<string, string>> {
    this.logger.debug('Custom fields query disabled - returning empty map', { issueId });
    // Return empty map - custom fields are optional
    return new Map();
  }

  /**
   * Update a custom field value on an issue
   */
  async updateIssueCustomField(issueId: string, fieldId: string, value: string): Promise<void> {
    this.logger.info('Updating custom field on issue', { issueId, fieldId });

    try {
      const mutation = `
        mutation UpdateIssueCustomField($issueId: String!, $customFieldId: String!, $value: String!) {
          issueUpdate(id: $issueId, input: {
            customFieldValues: [{ customFieldId: $customFieldId, value: $value }]
          }) {
            success
          }
        }
      `;

      await this.client.client.rawRequest(mutation, {
        issueId,
        customFieldId: fieldId,
        value,
      });

      this.logger.info('Custom field updated', { issueId, fieldId });
    } catch (error) {
      this.logger.error('Failed to update custom field', error as Error, { issueId, fieldId });
      throw error;
    }
  }

  // ============================================
  // Sub-Issue Operations
  // ============================================

  /**
   * Get children (sub-issues) of an issue
   */
  async getIssueChildren(issueId: string): Promise<Array<{
    id: string;
    identifier: string;
    title: string;
    state: { id: string; name: string } | null;
  }>> {
    this.logger.info('Getting issue children', { issueId });

    try {
      const issue = await this.client.issue(issueId);
      const children = await issue.children();

      const result = await Promise.all(
        children.nodes.map(async (child) => {
          const state = await child.state;
          return {
            id: child.id,
            identifier: child.identifier,
            title: child.title,
            state: state ? { id: state.id, name: state.name } : null,
          };
        })
      );

      this.logger.info('Issue children retrieved', { issueId, count: result.length });
      return result;
    } catch (error) {
      this.logger.error('Failed to get issue children', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Update status of multiple issues in parallel
   * Returns results for each issue (success or error)
   */
  async updateMultipleIssuesStatus(
    issueIds: string[],
    statusName: string
  ): Promise<Array<{ issueId: string; success: boolean; error?: string }>> {
    this.logger.info('Updating multiple issues status', { count: issueIds.length, statusName });

    const results = await Promise.all(
      issueIds.map(async (issueId) => {
        try {
          await this.updateStatus(issueId, statusName);
          return { issueId, success: true };
        } catch (error) {
          return {
            issueId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.info('Multiple issues status updated', {
      total: issueIds.length,
      success: successCount,
      failed: issueIds.length - successCount,
    });

    return results;
  }

  // ============================================
  // Document Operations
  // ============================================

  /**
   * Create a document linked to an issue
   * Note: issueId is not in SDK types but is supported by the API
   */
  async createIssueDocument(input: {
    issueId: string;
    title: string;
    content: string;
  }): Promise<{ id: string; url: string }> {
    this.logger.info('Creating document for issue', { issueId: input.issueId, title: input.title });

    try {
      const result = await this.client.createDocument({
        title: input.title,
        content: input.content,
        issueId: input.issueId,
      } as any); // issueId not in SDK types but supported by API

      if (!result.success) {
        throw new Error('Failed to create document');
      }

      const doc = await result.document;

      if (!doc) {
        throw new Error('Document creation returned null');
      }

      this.logger.info('Document created', { documentId: doc.id, url: doc.url });

      return { id: doc.id, url: doc.url };
    } catch (error) {
      this.logger.error('Failed to create document', error as Error, { issueId: input.issueId });
      throw error;
    }
  }

  /**
   * Update document content
   */
  async updateDocument(documentId: string, content: string): Promise<void> {
    this.logger.info('Updating document', { documentId });

    try {
      const result = await this.client.updateDocument(documentId, { content });

      if (!result.success) {
        throw new Error('Failed to update document');
      }

      this.logger.info('Document updated', { documentId });
    } catch (error) {
      this.logger.error('Failed to update document', error as Error, { documentId });
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<LinearDocument | null> {
    this.logger.info('Getting document', { documentId });

    try {
      const doc = await this.client.document(documentId);

      return {
        id: doc.id,
        title: doc.title,
        content: doc.content || '',
        url: doc.url,
      };
    } catch (error) {
      this.logger.error('Failed to get document', error as Error, { documentId });
      return null;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    this.logger.info('Deleting document', { documentId });

    try {
      await this.client.deleteDocument(documentId);
      this.logger.info('Document deleted', { documentId });
    } catch (error) {
      this.logger.error('Failed to delete document', error as Error, { documentId });
      throw error;
    }
  }
}

// ============================================
// Types
// ============================================

export interface LinearCustomField {
  id: string;
  name: string;
  type: string;
  teamId?: string;
}

export interface LinearComment {
  id: string;
  body: string;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinearDocument {
  id: string;
  title: string;
  content: string;
  url: string;
}

/**
 * Create a LinearClient instance
 * @param apiKey - OAuth token or API key (required)
 */
export function createLinearClient(apiKey: string): LinearClient {
  if (!apiKey) {
    throw new Error('apiKey is required for LinearClient');
  }

  return new LinearClient({
    apiKey,
    webhookSecret: process.env.LINEAR_WEBHOOK_SECRET,
    triggerStatus: process.env.LINEAR_TRIGGER_STATUS,
    nextStatus: process.env.LINEAR_NEXT_STATUS,
  });
}
