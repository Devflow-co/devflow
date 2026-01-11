/**
 * LLM Provider Interface - Provider-agnostic abstraction for conversational agent
 *
 * This interface allows switching between LLM providers (OpenRouter, Ollama, etc.)
 * without changing the ConversationalAgent implementation.
 */

import { ConversationMessage } from './agent-context.types';
import { ToolDefinition, ToolCall } from './tools/tool.types';

/**
 * LLM generation options
 */
export interface LLMGenerationOptions {
  /** Temperature for generation (0-1) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Tool choice strategy */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

  /** Callback for streaming text chunks */
  onDelta?: (chunk: string) => void;

  /** Callback when a tool call is detected in the response */
  onToolCall?: (call: ToolCall) => void;

  /** Stop sequences */
  stop?: string[];
}

/**
 * Token usage from LLM response
 */
export interface LLMTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Cost in USD (provider-specific) */
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
  /** Whether response was cached */
  cached?: boolean;
}

/**
 * Response from LLM provider
 */
export interface LLMResponse {
  /** Text content of the response (may be empty if tool_calls) */
  content: string;

  /** Tool calls requested by the model */
  toolCalls: ToolCall[];

  /** Token usage metrics */
  usage: LLMTokenUsage;

  /** Model that was used */
  model: string;

  /** Finish reason */
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';

  /** Request ID for tracking */
  requestId?: string;

  /** Response latency in ms */
  latencyMs?: number;
}

/**
 * LLM Provider Interface
 *
 * Implement this interface to add support for a new LLM provider.
 * The interface is designed to be minimal and universal.
 */
export interface ILLMProvider {
  /**
   * Provider name for logging/identification
   */
  readonly name: string;

  /**
   * Model being used
   */
  readonly model: string;

  /**
   * Generate a response with tool support
   *
   * @param messages - Conversation history
   * @param tools - Available tools (OpenAI function format)
   * @param options - Generation options
   * @returns LLM response with optional tool calls
   */
  generateWithTools(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    options?: LLMGenerationOptions
  ): Promise<LLMResponse>;

  /**
   * Generate a simple text response (no tools)
   *
   * @param messages - Conversation history
   * @param options - Generation options (without tool-related options)
   * @returns LLM response
   */
  generate(
    messages: ConversationMessage[],
    options?: Omit<LLMGenerationOptions, 'toolChoice' | 'onToolCall'>
  ): Promise<LLMResponse>;

  /**
   * Check if the provider is available/configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider capabilities
   */
  getCapabilities(): LLMProviderCapabilities;
}

/**
 * Provider capabilities
 */
export interface LLMProviderCapabilities {
  /** Supports function/tool calling */
  supportsTools: boolean;

  /** Supports streaming responses */
  supportsStreaming: boolean;

  /** Supports vision/image inputs */
  supportsVision: boolean;

  /** Maximum context length in tokens */
  maxContextLength: number;

  /** Maximum output tokens */
  maxOutputTokens: number;

  /** Supported models */
  supportedModels: string[];
}

/**
 * Provider configuration base
 */
export interface LLMProviderConfig {
  /** API key (if required) */
  apiKey?: string;

  /** Base URL (for self-hosted) */
  baseUrl?: string;

  /** Model to use */
  model?: string;

  /** Default temperature */
  defaultTemperature?: number;

  /** Default max tokens */
  defaultMaxTokens?: number;

  /** Request timeout in ms */
  timeout?: number;
}

/**
 * OpenRouter-specific configuration
 */
export interface OpenRouterProviderConfig extends LLMProviderConfig {
  apiKey: string;
  model?: string; // Default: anthropic/claude-sonnet-4
  siteUrl?: string;
  siteName?: string;
}

/**
 * Ollama-specific configuration
 */
export interface OllamaProviderConfig extends LLMProviderConfig {
  baseUrl?: string; // Default: http://localhost:11434
  model?: string; // Default: llama3.2 or llama-3-groq-tool-use
  keepAlive?: string;
  numCtx?: number;
}

/**
 * Factory function type for creating providers
 */
export type LLMProviderFactory = (config: LLMProviderConfig) => ILLMProvider;
