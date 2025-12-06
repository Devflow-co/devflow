/**
 * Webhooks Service
 */

import { Injectable } from '@nestjs/common';
import { createLogger } from '@devflow/common';
import { WorkflowsService } from '../workflows/workflows.service';

@Injectable()
export class WebhooksService {
  private logger = createLogger('WebhooksService');

  constructor(private workflowsService: WorkflowsService) {}

  async handleGitHub(event: string, payload: any) {
    this.logger.info('GitHub webhook received', { event });

    // TODO: Handle different GitHub events (push, pull_request, etc.)
    return { received: true, event };
  }

  async handleLinear(signature: string, payload: any) {
    this.logger.info('Linear webhook received', { action: payload?.action, type: payload?.type });

    // TODO: Verify webhook signature

    // Handle Issue update events
    if (payload?.action === 'update' && payload?.type === 'Issue') {
      const issue = payload.data;
      const stateName = issue?.state?.name;
      const triggerStatus = process.env.LINEAR_TRIGGER_STATUS || 'To Spec';

      this.logger.info('Issue updated', {
        issueId: issue?.id,
        identifier: issue?.identifier,
        stateName,
        triggerStatus
      });

      // Check if the issue moved to the trigger status
      if (stateName === triggerStatus) {
        this.logger.info('Issue moved to trigger status, starting workflow', {
          issueId: issue?.id,
          identifier: issue?.identifier
        });

        try {
          // Start the DevFlow workflow
          const result = await this.workflowsService.start({
            taskId: issue.id,
            projectId: issue.projectId || 'default',
            userId: payload.actor?.id,
            workflowType: 'devflowWorkflow',
          });

          this.logger.info('Workflow started successfully', {
            workflowId: result.workflowId,
            issueId: issue.id
          });

          return {
            received: true,
            action: payload?.action,
            type: payload?.type,
            workflowStarted: true,
            workflowId: result.workflowId
          };
        } catch (error) {
          this.logger.error('Failed to start workflow', error as Error, { issueId: issue?.id });
          throw error;
        }
      }
    }

    return { received: true, action: payload?.action, type: payload?.type };
  }
}

