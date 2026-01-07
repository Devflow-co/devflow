import { ITokenResolver } from '../auth/token-resolver.interface';
import { createSlackClient } from './slack.client';
import {
  SlackChannel,
  SlackTeam,
  SlackBlock,
  SlackNotification,
  SlackHeaderBlock,
  SlackSectionBlock,
  SlackDividerBlock,
  SlackContextBlock,
} from './slack.types';

/**
 * Slack Integration Service
 *
 * Unified service that combines token resolution and Slack API calls.
 * This service is testable by injecting a mock ITokenResolver.
 *
 * Pattern: tokenResolver.getAccessToken() → createSlackClient() → client.method()
 */
export class SlackIntegrationService {
  constructor(private readonly tokenResolver: ITokenResolver) {}

  /**
   * List all public channels in the workspace
   *
   * @param projectId - Project ID for token resolution
   */
  async listChannels(projectId: string): Promise<SlackChannel[]> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SLACK');
    const client = createSlackClient(token);
    return await client.listChannels();
  }

  /**
   * Join a channel (bot needs channels:join scope)
   *
   * @param projectId - Project ID for token resolution
   * @param channelId - Channel ID to join (C...)
   */
  async joinChannel(projectId: string, channelId: string): Promise<SlackChannel> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SLACK');
    const client = createSlackClient(token);
    return await client.joinChannel(channelId);
  }

  /**
   * Get team/workspace information
   *
   * @param projectId - Project ID for token resolution
   */
  async getTeamInfo(projectId: string): Promise<SlackTeam> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SLACK');
    const client = createSlackClient(token);
    return await client.getTeamInfo();
  }

  /**
   * Test authentication (used for connection testing)
   *
   * @param projectId - Project ID for token resolution
   */
  async testAuth(projectId: string): Promise<{
    ok: boolean;
    team: string;
    user: string;
  }> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SLACK');
    const client = createSlackClient(token);
    return await client.testAuth();
  }

  /**
   * Send a notification to the configured channel
   *
   * @param projectId - Project ID for token resolution
   * @param channelId - Channel ID to send to
   * @param notification - Notification payload
   */
  async sendNotification(
    projectId: string,
    channelId: string,
    notification: SlackNotification,
  ): Promise<{ channel: string; ts: string }> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SLACK');
    const client = createSlackClient(token);

    const blocks = this.buildNotificationBlocks(notification);
    const fallbackText = `${notification.title}: ${notification.message}`;

    return await client.postMessage(channelId, fallbackText, blocks);
  }

  /**
   * Send a raw message with custom blocks
   *
   * @param projectId - Project ID for token resolution
   * @param channelId - Channel ID to send to
   * @param text - Fallback text
   * @param blocks - Block Kit blocks
   */
  async sendMessage(
    projectId: string,
    channelId: string,
    text: string,
    blocks?: SlackBlock[],
  ): Promise<{ channel: string; ts: string }> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SLACK');
    const client = createSlackClient(token);
    return await client.postMessage(channelId, text, blocks);
  }

  /**
   * Build Block Kit blocks for a notification
   */
  private buildNotificationBlocks(notification: SlackNotification): SlackBlock[] {
    const blocks: SlackBlock[] = [];

    // Header with emoji based on type
    const emoji = this.getNotificationEmoji(notification.type, notification.color);
    const headerBlock: SlackHeaderBlock = {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${notification.title}`,
        emoji: true,
      },
    };
    blocks.push(headerBlock);

    // Main message section
    let messageText = notification.message;

    // Add issue link if provided
    if (notification.issueId && notification.issueUrl) {
      messageText += `\n\n*Issue:* <${notification.issueUrl}|${notification.issueId}>`;
      if (notification.issueTitle) {
        messageText += ` - ${notification.issueTitle}`;
      }
    }

    // Add status if provided
    if (notification.status) {
      messageText += `\n*Status:* ${notification.status}`;
    }

    const sectionBlock: SlackSectionBlock = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: messageText,
      },
    };
    blocks.push(sectionBlock);

    // Divider
    const dividerBlock: SlackDividerBlock = { type: 'divider' };
    blocks.push(dividerBlock);

    // Footer context
    const contextBlock: SlackContextBlock = {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent by DevFlow | ${new Date().toISOString()}`,
        },
      ],
    };
    blocks.push(contextBlock);

    return blocks;
  }

  /**
   * Get emoji based on notification type
   */
  private getNotificationEmoji(
    type: SlackNotification['type'],
    color?: SlackNotification['color'],
  ): string {
    if (color === 'danger') return ':red_circle:';
    if (color === 'warning') return ':warning:';
    if (color === 'good') return ':white_check_mark:';

    switch (type) {
      case 'workflow_status':
        return ':arrows_counterclockwise:';
      case 'error':
        return ':x:';
      case 'info':
      default:
        return ':information_source:';
    }
  }
}

/**
 * Factory function to create a SlackIntegrationService
 *
 * @param tokenResolver - Token resolver instance
 */
export function createSlackIntegrationService(
  tokenResolver: ITokenResolver,
): SlackIntegrationService {
  return new SlackIntegrationService(tokenResolver);
}
