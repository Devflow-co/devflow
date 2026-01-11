/**
 * Agent Response Types - Response types for the conversational agent
 */

import { ConversationMessage } from './agent-context.types';
import { ToolResult } from './tools/tool.types';

/**
 * Usage metrics for a single agent response
 */
export interface ConversationalAgentUsage {
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens used */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Cost in USD (if available) */
  totalCost?: number;
  /** Response latency in ms */
  latencyMs?: number;
  /** Number of LLM calls made */
  llmCalls: number;
  /** Number of tool calls made */
  toolCalls: number;
}

/**
 * Tool execution record for response
 */
export interface ToolExecutionRecord {
  /** Tool name */
  name: string;
  /** Tool call ID */
  callId: string;
  /** Arguments passed to tool */
  args: Record<string, unknown>;
  /** Result from tool execution */
  result: ToolResult;
  /** Execution time in ms */
  durationMs: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Response from ConversationalAgent.processMessage()
 */
export interface ConversationalAgentResponse {
  /** Final text response from the agent */
  content: string;

  /** Whether the response was successful */
  success: boolean;

  /** Error message if success is false */
  error?: string;

  /** Token and cost usage metrics */
  usage: ConversationalAgentUsage;

  /** Model used for generation */
  model: string;

  /** Provider used */
  provider: string;

  /** Tool executions performed */
  toolExecutions: ToolExecutionRecord[];

  /** Messages generated during this response (for conversation history) */
  newMessages: ConversationMessage[];

  /** Finish reason from LLM */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';

  /** Request ID for tracking */
  requestId?: string;
}

/**
 * Streaming chunk types sent via callbacks
 */
export type StreamChunkType =
  | 'delta'        // Text chunk
  | 'tool_call'    // Tool about to execute
  | 'tool_result'  // Tool execution result
  | 'thinking'     // Agent reasoning (optional)
  | 'done'         // Completion
  | 'error';       // Error

/**
 * Streaming chunk structure
 */
export interface StreamChunk {
  type: StreamChunkType;

  // For 'delta' type
  content?: string;

  // For 'tool_call' type
  toolName?: string;
  toolArgs?: Record<string, unknown>;

  // For 'tool_result' type
  toolResult?: unknown;
  toolSuccess?: boolean;

  // For 'thinking' type
  thought?: string;

  // For 'done' type
  usage?: ConversationalAgentUsage;

  // For 'error' type
  error?: string;
  errorCode?: string;
}

/**
 * WebSocket message format for agent gateway
 */
export interface AgentWebSocketMessage {
  /** Event type */
  event: 'chat' | 'cancel' | 'ping';

  /** Payload */
  data: {
    /** Project ID */
    projectId?: string;
    /** User message */
    message?: string;
    /** Conversation ID (to continue existing) */
    conversationId?: string;
  };
}

/**
 * WebSocket response format from agent gateway
 */
export interface AgentWebSocketResponse {
  /** Response type */
  type: StreamChunkType;

  // Type-specific fields
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  success?: boolean;
  conversationId?: string;
  usage?: ConversationalAgentUsage;
  message?: string;
  code?: string;
}
