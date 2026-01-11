/**
 * Agent Context Types - Context passed to the conversational agent
 */

import { ToolServices } from './tools/tool.types';

/**
 * Message role in conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Single message in conversation history
 */
export interface ConversationMessage {
  role: MessageRole;
  content: string;
  /** Tool call ID (for tool messages) */
  tool_call_id?: string;
  /** Tool calls made by assistant */
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  /** Timestamp of the message */
  timestamp?: Date;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Conversation state
 */
export interface ConversationState {
  id: string;
  projectId: string;
  userId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  /** Total tokens used in this conversation */
  totalTokens?: number;
  /** Total cost of this conversation (USD) */
  totalCost?: number;
}

/**
 * Agent context passed to ConversationalAgent.processMessage()
 */
export interface AgentContext {
  /** Project ID for this conversation */
  projectId: string;

  /** User ID (optional) */
  userId?: string;

  /** Available services for tool execution */
  services: ToolServices;

  /** Project-specific context */
  projectContext?: {
    name: string;
    description?: string;
    language?: string;
    framework?: string;
    repository?: {
      owner: string;
      repo: string;
      defaultBranch: string;
    };
  };

  /** Custom system prompt additions */
  additionalSystemPrompt?: string;

  /** Rate limiting settings */
  rateLimits?: {
    maxToolCallsPerMessage?: number;
    maxTokensPerConversation?: number;
    maxMessagesPerConversation?: number;
  };

  /** Feature flags */
  features?: {
    enableWorkflowTools?: boolean;
    enableCodeExecution?: boolean;
    enableFileModification?: boolean;
  };
}

/**
 * Callbacks for streaming responses
 */
export interface AgentCallbacks {
  /** Called when a text chunk is received */
  onDelta?: (chunk: string) => void;

  /** Called when a tool is about to be executed */
  onToolCall?: (name: string, args: Record<string, unknown>) => void;

  /** Called when a tool execution completes */
  onToolResult?: (name: string, result: unknown, success: boolean) => void;

  /** Called when the agent starts thinking (optional) */
  onThinking?: (thought: string) => void;

  /** Called on error during processing */
  onError?: (error: Error) => void;
}

/**
 * Options for agent message processing
 */
export interface ProcessMessageOptions {
  /** Maximum number of tool call iterations */
  maxIterations?: number;

  /** Force a specific tool to be used */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

  /** Temperature for LLM generation */
  temperature?: number;

  /** Maximum tokens for response */
  maxTokens?: number;

  /** Enable streaming */
  stream?: boolean;
}
