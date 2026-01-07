/**
 * Slack Integration Module
 *
 * Provides Slack API client and integration service for:
 * - OAuth authentication
 * - Channel listing and selection
 * - Notification sending
 */

export type {
  SlackChannel,
  SlackTeam,
  SlackOAuthResponse,
  SlackApiResponse,
  SlackConversationsListResponse,
  SlackConversationsJoinResponse,
  SlackPostMessageResponse,
  SlackTeamInfoResponse,
  SlackBlock,
  SlackHeaderBlock,
  SlackSectionBlock,
  SlackDividerBlock,
  SlackContextBlock,
  SlackActionsBlock,
  SlackBlockElement,
  SlackNotification,
  SlackChannelSelection,
} from './slack.types';

export { SlackClient, createSlackClient } from './slack.client';
export {
  SlackIntegrationService,
  createSlackIntegrationService,
} from './slack-integration.service';
