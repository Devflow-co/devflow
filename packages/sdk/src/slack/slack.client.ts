/**
 * Slack API Client
 *
 * Provides methods to interact with Slack API for:
 * - Listing channels
 * - Joining channels
 * - Sending messages/notifications
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  SlackChannel,
  SlackTeam,
  SlackBlock,
  SlackConversationsListResponse,
  SlackConversationsJoinResponse,
  SlackPostMessageResponse,
  SlackTeamInfoResponse,
} from './slack.types';

export class SlackClient {
  private readonly client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: 'https://slack.com/api',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  /**
   * Handle Slack API errors
   * Slack returns 200 OK with ok: false for errors
   */
  private handleResponse<T extends { ok: boolean; error?: string }>(
    response: T,
    operation: string,
  ): T {
    if (!response.ok) {
      throw new Error(`Slack API error (${operation}): ${response.error || 'Unknown error'}`);
    }
    return response;
  }

  /**
   * List public channels the bot can access
   * @param cursor - Pagination cursor for next page
   * @param limit - Number of results per page (max 1000, default 200)
   */
  async listChannels(cursor?: string, limit: number = 200): Promise<SlackChannel[]> {
    const allChannels: SlackChannel[] = [];
    let nextCursor = cursor;

    do {
      const response = await this.client.get<SlackConversationsListResponse>(
        '/conversations.list',
        {
          params: {
            types: 'public_channel',
            exclude_archived: true,
            limit,
            cursor: nextCursor,
          },
        },
      );

      const data = this.handleResponse(response.data, 'conversations.list');
      allChannels.push(...data.channels);

      nextCursor = data.response_metadata?.next_cursor;
    } while (nextCursor);

    return allChannels;
  }

  /**
   * Join a channel (bot needs channels:join scope)
   * @param channelId - Channel ID to join (C...)
   */
  async joinChannel(channelId: string): Promise<SlackChannel> {
    const response = await this.client.post<SlackConversationsJoinResponse>(
      '/conversations.join',
      { channel: channelId },
    );

    const data = this.handleResponse(response.data, 'conversations.join');
    return data.channel;
  }

  /**
   * Send a message to a channel
   * @param channelId - Channel ID (C...)
   * @param text - Fallback text (shown in notifications)
   * @param blocks - Optional Block Kit blocks for rich formatting
   */
  async postMessage(
    channelId: string,
    text: string,
    blocks?: SlackBlock[],
  ): Promise<{ channel: string; ts: string }> {
    const response = await this.client.post<SlackPostMessageResponse>('/chat.postMessage', {
      channel: channelId,
      text,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    });

    const data = this.handleResponse(response.data, 'chat.postMessage');
    return {
      channel: data.channel,
      ts: data.ts,
    };
  }

  /**
   * Get team/workspace information
   */
  async getTeamInfo(): Promise<SlackTeam> {
    const response = await this.client.get<SlackTeamInfoResponse>('/team.info');

    const data = this.handleResponse(response.data, 'team.info');
    return data.team;
  }

  /**
   * Test authentication and get bot info
   */
  async testAuth(): Promise<{
    ok: boolean;
    url: string;
    team: string;
    user: string;
    team_id: string;
    user_id: string;
    bot_id?: string;
  }> {
    const response = await this.client.post('/auth.test');
    return this.handleResponse(response.data, 'auth.test');
  }
}

/**
 * Create a Slack client instance
 */
export function createSlackClient(accessToken: string): SlackClient {
  return new SlackClient(accessToken);
}
