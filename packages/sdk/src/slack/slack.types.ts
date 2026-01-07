/**
 * Slack API Types
 *
 * Types for Slack API responses used in notifications and channel selection.
 */

/**
 * Slack channel from conversations.list
 */
export interface SlackChannel {
  id: string; // C01234567
  name: string; // general
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_member: boolean;
  num_members?: number;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
}

/**
 * Slack team/workspace information
 */
export interface SlackTeam {
  id: string; // T01234567
  name: string; // My Workspace
  domain: string; // myworkspace
  icon?: {
    image_34?: string;
    image_44?: string;
    image_68?: string;
    image_88?: string;
    image_102?: string;
    image_132?: string;
    image_default?: boolean;
  };
}

/**
 * Slack OAuth v2 response
 * @see https://api.slack.com/methods/oauth.v2.access
 */
export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string; // xoxb-...
  token_type: 'bot';
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  is_enterprise_install?: boolean;
  // Note: Slack bot tokens do NOT have refresh_token - they don't expire
}

/**
 * Slack API generic response wrapper
 */
export interface SlackApiResponse<T = unknown> {
  ok: boolean;
  error?: string;
  warning?: string;
  response_metadata?: {
    next_cursor?: string;
    scopes?: string[];
    acceptedScopes?: string[];
  };
  data?: T;
}

/**
 * Slack conversations.list response
 */
export interface SlackConversationsListResponse extends SlackApiResponse {
  channels: SlackChannel[];
  response_metadata?: {
    next_cursor?: string;
  };
}

/**
 * Slack conversations.join response
 */
export interface SlackConversationsJoinResponse extends SlackApiResponse {
  channel: SlackChannel;
}

/**
 * Slack chat.postMessage response
 */
export interface SlackPostMessageResponse extends SlackApiResponse {
  channel: string;
  ts: string;
  message: {
    type: string;
    subtype?: string;
    text: string;
    ts: string;
    username?: string;
    bot_id?: string;
  };
}

/**
 * Slack team.info response
 */
export interface SlackTeamInfoResponse extends SlackApiResponse {
  team: SlackTeam;
}

/**
 * Slack Block Kit block types (simplified)
 * @see https://api.slack.com/reference/block-kit/blocks
 */
export type SlackBlock =
  | SlackHeaderBlock
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackContextBlock
  | SlackActionsBlock;

export interface SlackHeaderBlock {
  type: 'header';
  text: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
}

export interface SlackSectionBlock {
  type: 'section';
  text: {
    type: 'mrkdwn' | 'plain_text';
    text: string;
  };
  accessory?: SlackBlockElement;
  fields?: Array<{
    type: 'mrkdwn' | 'plain_text';
    text: string;
  }>;
}

export interface SlackDividerBlock {
  type: 'divider';
}

export interface SlackContextBlock {
  type: 'context';
  elements: Array<{
    type: 'mrkdwn' | 'plain_text' | 'image';
    text?: string;
    image_url?: string;
    alt_text?: string;
  }>;
}

export interface SlackActionsBlock {
  type: 'actions';
  elements: SlackBlockElement[];
}

export interface SlackBlockElement {
  type: 'button' | 'static_select' | 'overflow';
  text?: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
  url?: string;
  value?: string;
  action_id?: string;
  style?: 'primary' | 'danger';
}

/**
 * Notification payload for DevFlow
 */
export interface SlackNotification {
  type: 'workflow_status' | 'error' | 'info';
  title: string;
  message: string;
  issueId?: string;
  issueTitle?: string;
  issueUrl?: string;
  status?: string;
  color?: 'good' | 'warning' | 'danger'; // Attachment color
}

/**
 * Slack channel selection saved in database
 */
export interface SlackChannelSelection {
  teamId: string | null;
  teamName: string | null;
  channelId: string | null;
  channelName: string | null;
}
