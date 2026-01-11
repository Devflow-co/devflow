/**
 * OpenRouter Provider - ILLMProvider implementation for OpenRouter API
 *
 * OpenRouter provides access to multiple LLM providers (Claude, GPT-4, etc.)
 * with a unified API.
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '@devflow/common';
import { ConversationMessage } from '../agent-context.types';
import {
  ILLMProvider,
  LLMProviderCapabilities,
  LLMGenerationOptions,
  LLMResponse,
  LLMTokenUsage,
  OpenRouterProviderConfig,
} from '../llm-provider.interface';
import { ToolDefinition, ToolCall } from '../tools/tool.types';

const logger = createLogger('OpenRouterConversationalProvider');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

/**
 * OpenRouter API message format
 */
interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * OpenRouter API response format
 */
interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cost?: number;
    completion_cost?: number;
    total_cost?: number;
    cache_hit?: boolean;
  };
}

/**
 * OpenRouter Provider for Conversational Agent
 */
export class OpenRouterConversationalProvider implements ILLMProvider {
  readonly name = 'openrouter';
  readonly model: string;

  private apiKey: string;
  private client: AxiosInstance;
  private siteUrl: string;
  private siteName: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(config: OpenRouterProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODEL;
    this.siteUrl = config.siteUrl || 'https://devflow.dev';
    this.siteName = config.siteName || 'DevFlow';
    this.defaultTemperature = config.defaultTemperature ?? 0.7;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;

    this.client = axios.create({
      baseURL: OPENROUTER_ENDPOINT,
      timeout: config.timeout || 120000, // 2 minutes default
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName,
      },
    });
  }

  /**
   * Generate a response with tool support
   */
  async generateWithTools(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    options?: LLMGenerationOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    logger.debug('Generating with tools', {
      messageCount: messages.length,
      toolCount: tools.length,
      model: this.model,
    });

    // Convert messages to OpenRouter format
    const openRouterMessages = this.convertMessages(messages);

    // Build request body
    const body: Record<string, unknown> = {
      model: this.model,
      messages: openRouterMessages,
      max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaultTemperature,
      usage: { include: true },
    };

    // Add tools if provided
    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = this.mapToolChoice(options?.toolChoice);
    }

    // Add stop sequences
    if (options?.stop && options.stop.length > 0) {
      body.stop = options.stop;
    }

    try {
      const response = await this.client.post<OpenRouterResponse>('', body);
      const data = response.data;
      const latencyMs = Date.now() - startTime;

      const choice = data.choices[0];
      const toolCalls = this.extractToolCalls(choice.message.tool_calls, options?.onToolCall);

      // Call onDelta for content if streaming callback provided
      if (options?.onDelta && choice.message.content) {
        options.onDelta(choice.message.content);
      }

      const usage = this.extractUsage(data.usage);

      logger.debug('Generation complete', {
        latencyMs,
        toolCallCount: toolCalls.length,
        finishReason: choice.finish_reason,
        usage,
      });

      return {
        content: choice.message.content || '',
        toolCalls,
        usage,
        model: data.model,
        finishReason: choice.finish_reason,
        requestId: data.id,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      logger.error('OpenRouter API error', error as Error, { latencyMs });
      throw this.handleError(error);
    }
  }

  /**
   * Generate a simple text response (no tools)
   */
  async generate(
    messages: ConversationMessage[],
    options?: Omit<LLMGenerationOptions, 'toolChoice' | 'onToolCall'>
  ): Promise<LLMResponse> {
    return this.generateWithTools(messages, [], {
      ...options,
      toolChoice: 'none',
    });
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Simple test request with minimal tokens
      const response = await this.client.post('', {
        model: this.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Provider availability check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): LLMProviderCapabilities {
    return {
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: this.model.includes('claude') || this.model.includes('gpt-4'),
      maxContextLength: this.getContextLength(),
      maxOutputTokens: 4096,
      supportedModels: [
        'anthropic/claude-sonnet-4',
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-opus',
        'openai/gpt-4-turbo',
        'openai/gpt-4o',
        'google/gemini-pro',
        'meta-llama/llama-3.1-405b-instruct',
      ],
    };
  }

  /**
   * Convert internal messages to OpenRouter format
   */
  private convertMessages(messages: ConversationMessage[]): OpenRouterMessage[] {
    return messages.map((msg) => {
      const converted: OpenRouterMessage = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.tool_call_id) {
        converted.tool_call_id = msg.tool_call_id;
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        converted.tool_calls = msg.tool_calls;
        // OpenRouter expects null content when there are tool calls
        if (!msg.content) {
          converted.content = null;
        }
      }

      return converted;
    });
  }

  /**
   * Extract tool calls from response
   */
  private extractToolCalls(
    toolCalls: OpenRouterResponse['choices'][0]['message']['tool_calls'],
    onToolCall?: (call: ToolCall) => void
  ): ToolCall[] {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    return toolCalls.map((tc) => {
      const call: ToolCall = {
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      };

      if (onToolCall) {
        onToolCall(call);
      }

      return call;
    });
  }

  /**
   * Extract usage metrics from response
   */
  private extractUsage(usage?: OpenRouterResponse['usage']): LLMTokenUsage {
    return {
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      inputCost: usage?.prompt_cost,
      outputCost: usage?.completion_cost,
      totalCost: usage?.total_cost,
      cached: usage?.cache_hit || false,
    };
  }

  /**
   * Map tool choice to OpenRouter format
   */
  private mapToolChoice(
    toolChoice?: LLMGenerationOptions['toolChoice']
  ): string | { type: 'function'; function: { name: string } } | undefined {
    if (!toolChoice) {
      return 'auto';
    }

    if (typeof toolChoice === 'string') {
      return toolChoice;
    }

    return toolChoice;
  }

  /**
   * Get context length based on model
   */
  private getContextLength(): number {
    if (this.model.includes('claude-3')) {
      return 200000;
    }
    if (this.model.includes('gpt-4-turbo') || this.model.includes('gpt-4o')) {
      return 128000;
    }
    if (this.model.includes('gpt-4')) {
      return 8192;
    }
    if (this.model.includes('llama-3.1')) {
      return 128000;
    }
    return 16384; // Default
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as { error?: { message?: string } } | undefined;
      const message = data?.error?.message || error.message;

      if (status === 401) {
        return new Error('OpenRouter authentication failed. Check your API key.');
      }
      if (status === 429) {
        return new Error('OpenRouter rate limit exceeded. Please try again later.');
      }
      if (status === 400) {
        return new Error(`OpenRouter request error: ${message}`);
      }
      if (status === 500 || status === 502 || status === 503) {
        return new Error('OpenRouter service temporarily unavailable.');
      }

      return new Error(`OpenRouter API error (${status}): ${message}`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Create an OpenRouter provider for conversational agent
 */
export function createOpenRouterConversationalProvider(
  config: OpenRouterProviderConfig
): OpenRouterConversationalProvider {
  return new OpenRouterConversationalProvider(config);
}
