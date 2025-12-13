/**
 * Webhooks Service
 */

import { Injectable, Optional } from '@nestjs/common';
import { createLogger } from '@devflow/common';
import { WorkflowsService } from '@/workflows/workflows.service';
import { LinearSyncApiService, CommentContext } from '@/linear/linear-sync-api.service';

@Injectable()
export class WebhooksService {
  private logger = createLogger('WebhooksService');

  /** Auto-sync Linear issues to database on every webhook event */
  private autoSyncEnabled: boolean;

  constructor(
    private workflowsService: WorkflowsService,
    @Optional() private linearSyncService?: LinearSyncApiService,
  ) {
    // Enable auto-sync by default, can be disabled via env var
    this.autoSyncEnabled = process.env.LINEAR_AUTO_SYNC !== 'false';
    this.logger.info('WebhooksService initialized', { autoSyncEnabled: this.autoSyncEnabled });
  }

  /**
   * Auto-sync an issue from Linear to database
   * Non-blocking: errors are logged but don't fail the webhook
   */
  private async autoSyncIssue(issueId: string, context: string): Promise<void> {
    if (!this.autoSyncEnabled || !this.linearSyncService) {
      return;
    }

    const projectId = process.env.DEFAULT_PROJECT_ID;
    if (!projectId) {
      this.logger.debug('Auto-sync skipped: no DEFAULT_PROJECT_ID');
      return;
    }

    try {
      this.logger.info('Auto-syncing issue', { issueId, context });
      const result = await this.linearSyncService.syncIssueToDatabase(projectId, issueId);

      this.logger.info('Auto-sync completed', {
        issueId,
        identifier: result.identifier,
        action: result.action,
        changes: result.changes,
        context,
      });
    } catch (error) {
      // Non-blocking: log error but don't fail the webhook
      this.logger.error('Auto-sync failed', error as Error, { issueId, context });
    }
  }

  async handleGitHub(event: string, payload: any) {
    this.logger.info('GitHub webhook received', { event });

    // TODO: Handle different GitHub events (push, pull_request, etc.)
    return { received: true, event };
  }

  async handleLinear(signature: string, payload: any) {
    this.logger.info('Linear webhook received', { action: payload?.action, type: payload?.type });

    // TODO: Verify webhook signature

    // Handle Issue events (create, update)
    if (payload?.type === 'Issue') {
      const issue = payload.data;
      const action = payload?.action;
      const stateName = issue?.state?.name;

      this.logger.info('Issue event received', {
        action,
        issueId: issue?.id,
        identifier: issue?.identifier,
        stateName,
      });

      // Auto-sync issue to database on any Issue event
      if (issue?.id) {
        await this.autoSyncIssue(issue.id, `issue:${action}`);
      }

      // Three-Phase Agile Workflow triggers (only on update)
      if (action !== 'update') {
        return {
          received: true,
          action,
          type: 'Issue',
          autoSynced: this.autoSyncEnabled,
        };
      }

      const triggerStatuses = [
        process.env.LINEAR_STATUS_TO_REFINEMENT || 'To Refinement',
        process.env.LINEAR_STATUS_TO_USER_STORY || 'Refinement Ready',
        process.env.LINEAR_STATUS_TO_PLAN || 'UserStory Ready',
      ];

      this.logger.info('Checking workflow triggers', {
        issueId: issue?.id,
        stateName,
        triggerStatuses,
      });

      // Check if the issue moved to any of the trigger statuses
      if (triggerStatuses.includes(stateName)) {
        this.logger.info('Issue moved to trigger status, starting workflow', {
          issueId: issue?.id,
          identifier: issue?.identifier,
          triggerStatus: stateName,
        });

        try {
          // Map Linear projectId to DevFlow projectId
          // TODO: Create a proper mapping table in database
          const projectId = process.env.DEFAULT_PROJECT_ID;

          this.logger.info('Using DevFlow projectId', {
            devflowProjectId: projectId,
            linearProjectId: issue.projectId,
          });

          // Start the DevFlow workflow (router will determine which phase)
          const result = await this.workflowsService.start({
            taskId: issue.id,
            projectId,
            userId: payload.actor?.id,
            workflowType: 'devflowWorkflow',
          });

          this.logger.info('Workflow started successfully', {
            workflowId: result.workflowId,
            issueId: issue.id,
            projectId,
            triggerStatus: stateName,
          });

          return {
            received: true,
            action: payload?.action,
            type: payload?.type,
            autoSynced: this.autoSyncEnabled,
            workflowStarted: true,
            workflowId: result.workflowId,
            triggerStatus: stateName,
          };
        } catch (error) {
          this.logger.error('Failed to start workflow', error as Error, { issueId: issue?.id });
          throw error;
        }
      }
    }

    // Handle Comment events
    if (payload?.type === 'Comment') {
      return this.handleLinearComment(payload);
    }

    return {
      received: true,
      action: payload?.action,
      type: payload?.type,
      autoSynced: false,
    };
  }

  /**
   * Auto-sync a comment from Linear to database
   * Non-blocking: errors are logged but don't fail the webhook
   */
  private async autoSyncComment(
    commentId: string,
    issueId: string,
    context: string,
  ): Promise<void> {
    if (!this.autoSyncEnabled || !this.linearSyncService) {
      return;
    }

    const projectId = process.env.DEFAULT_PROJECT_ID;
    if (!projectId) {
      this.logger.debug('Auto-sync comment skipped: no DEFAULT_PROJECT_ID');
      return;
    }

    try {
      this.logger.info('Auto-syncing comment', { commentId, issueId, context });
      const result = await this.linearSyncService.syncCommentToDatabase(
        projectId,
        commentId,
        issueId,
      );

      this.logger.info('Comment auto-sync completed', {
        commentId,
        action: result.action,
        localCommentId: result.commentId,
        context,
      });
    } catch (error) {
      // Non-blocking: log error but don't fail the webhook
      this.logger.error('Comment auto-sync failed', error as Error, { commentId, context });
    }
  }

  /**
   * Handle Linear Comment webhook
   * Auto-syncs the parent issue AND the comment itself
   */
  private async handleLinearComment(payload: any) {
    const action = payload?.action;
    const comment = payload?.data;

    // Extract issue ID from comment
    const issueId = comment?.issueId || comment?.issue?.id;
    const commentId = comment?.id;

    this.logger.info('Linear comment webhook received', {
      action,
      commentId,
      issueId,
    });

    // Auto-sync the parent issue on any comment event
    if (issueId) {
      await this.autoSyncIssue(issueId, `comment:${action}`);
    }

    // Auto-sync the comment itself (create or update)
    if (commentId && issueId && (action === 'create' || action === 'update')) {
      await this.autoSyncComment(commentId, issueId, `comment:${action}`);
    }

    // Only process create actions for commands
    if (action !== 'create') {
      return {
        received: true,
        action,
        type: 'Comment',
        issueSynced: this.autoSyncEnabled && !!issueId,
        commentSynced: this.autoSyncEnabled && !!commentId && !!issueId,
      };
    }

    // Check for @devflow commands in comment body
    const body = comment?.body || '';
    const hasDevflowCommand = body.toLowerCase().includes('@devflow');

    if (!hasDevflowCommand) {
      // No command, just auto-sync was enough
      return {
        received: true,
        action,
        type: 'Comment',
        issueSynced: this.autoSyncEnabled && !!issueId,
        commentSynced: this.autoSyncEnabled && !!commentId,
        processed: false,
      };
    }

    // Process @devflow command
    if (!this.linearSyncService) {
      this.logger.warn('LinearSyncApiService not available for command processing');
      return {
        received: true,
        action,
        type: 'Comment',
        issueSynced: this.autoSyncEnabled && !!issueId,
        commentSynced: this.autoSyncEnabled && !!commentId,
        processed: false,
        reason: 'LinearSyncApiService not configured',
      };
    }

    if (!issueId) {
      return {
        received: true,
        action,
        type: 'Comment',
        commentSynced: this.autoSyncEnabled && !!commentId,
        processed: false,
        reason: 'No issue ID in comment',
      };
    }

    const projectId = process.env.DEFAULT_PROJECT_ID;
    if (!projectId) {
      return {
        received: true,
        action,
        type: 'Comment',
        issueSynced: false,
        commentSynced: false,
        processed: false,
        reason: 'No project ID configured',
      };
    }

    // Build comment context for command processing
    const commentContext: CommentContext = {
      issueId,
      commentId: comment?.id,
      body,
      userId: comment?.user?.id || payload?.actor?.id,
      userName: comment?.user?.name || payload?.actor?.name,
      createdAt: comment?.createdAt || new Date().toISOString(),
    };

    try {
      const result = await this.linearSyncService.handleComment(projectId, commentContext);

      this.logger.info('Comment command processed', {
        commentId: comment?.id,
        actionType: result.action.type,
        message: result.message,
      });

      return {
        received: true,
        action,
        type: 'Comment',
        issueSynced: this.autoSyncEnabled,
        commentSynced: this.autoSyncEnabled,
        processed: result.action.type !== 'none',
        commandAction: result.action,
        result: result.result,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('Failed to process comment command', error as Error, {
        commentId,
        issueId,
      });

      return {
        received: true,
        action,
        type: 'Comment',
        issueSynced: this.autoSyncEnabled,
        commentSynced: this.autoSyncEnabled,
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

