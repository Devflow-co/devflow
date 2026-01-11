/**
 * Agent Types - WebSocket protocol and internal types
 */

import { ConversationMessage } from '@devflow/sdk';

/**
 * WebSocket events from client
 */
export interface AgentChatEvent {
  projectId: string;
  message: string;
  conversationId?: string;
}

export interface AgentCancelEvent {
  conversationId: string;
}

/**
 * WebSocket response types
 */
export type AgentResponseType =
  | 'delta'
  | 'tool_call'
  | 'tool_result'
  | 'thinking'
  | 'done'
  | 'error';

export interface AgentDeltaResponse {
  type: 'delta';
  content: string;
}

export interface AgentToolCallResponse {
  type: 'tool_call';
  name: string;
  args: Record<string, unknown>;
}

export interface AgentToolResultResponse {
  type: 'tool_result';
  name: string;
  result: unknown;
  success: boolean;
}

export interface AgentDoneResponse {
  type: 'done';
  conversationId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCost?: number;
    llmCalls: number;
    toolCalls: number;
  };
}

export interface AgentErrorResponse {
  type: 'error';
  message: string;
  code?: string;
}

export type AgentResponse =
  | AgentDeltaResponse
  | AgentToolCallResponse
  | AgentToolResultResponse
  | AgentDoneResponse
  | AgentErrorResponse;

/**
 * Conversation stored in Redis
 */
export interface StoredConversation {
  id: string;
  projectId: string;
  userId: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
  totalTokens: number;
  totalCost: number;
}

/**
 * Agent configuration from environment
 */
export interface AgentConfig {
  provider: 'openrouter' | 'ollama';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  conversationTtlHours: number;
  maxMessagesPerConversation: number;
  maxToolCallsPerMessage: number;
  rateLimitPerHour: number;
}
