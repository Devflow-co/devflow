/**
 * Tool Executor - Execute tools and map results for the conversational agent
 */

import { createLogger } from '@devflow/common';
import {
  ToolCall,
  ParsedToolCall,
  ToolResult,
  ToolExecutionContext,
} from './tools/tool.types';
import { ToolExecutionRecord } from './agent-response.types';
import { ToolRegistry } from './tool-registry';

const logger = createLogger('ToolExecutor');

/**
 * Tool Executor Options
 */
export interface ToolExecutorOptions {
  /** Timeout for individual tool execution (ms) */
  timeout?: number;
  /** Maximum concurrent tool executions */
  maxConcurrent?: number;
  /** Whether to continue on tool errors */
  continueOnError?: boolean;
}

const DEFAULT_OPTIONS: Required<ToolExecutorOptions> = {
  timeout: 30000, // 30 seconds
  maxConcurrent: 5,
  continueOnError: true,
};

/**
 * Tool Executor
 *
 * Executes tools from LLM responses and maps results back for the next turn.
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private options: Required<ToolExecutorOptions>;

  constructor(registry: ToolRegistry, options: ToolExecutorOptions = {}) {
    this.registry = registry;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse a tool call from LLM response
   */
  parseToolCall(toolCall: ToolCall): ParsedToolCall {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      return {
        id: toolCall.id,
        name: toolCall.function.name,
        args,
      };
    } catch (error) {
      logger.error(
        `Failed to parse tool call arguments for ${toolCall.function.name}`,
        error as Error,
        { arguments: toolCall.function.arguments }
      );
      throw new Error(`Invalid JSON in tool call arguments: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a single tool
   */
  async execute(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<ToolExecutionRecord> {
    const startTime = Date.now();
    const parsed = this.parseToolCall(toolCall);

    logger.info(`Executing tool: ${parsed.name}`, {
      callId: parsed.id,
      projectId: context.projectId,
    });

    const handler = this.registry.getHandler(parsed.name);

    if (!handler) {
      logger.warn(`Unknown tool: ${parsed.name}`);
      return {
        name: parsed.name,
        callId: parsed.id,
        args: parsed.args,
        result: {
          success: false,
          error: `Unknown tool: ${parsed.name}`,
          suggestion: 'Available tools: ' + this.registry.getToolNames().join(', '),
        },
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        handler(parsed.args, context),
        this.options.timeout,
        parsed.name
      );

      const durationMs = Date.now() - startTime;
      logger.info(`Tool executed successfully: ${parsed.name}`, {
        durationMs,
        callId: parsed.id,
      });

      return {
        name: parsed.name,
        callId: parsed.id,
        args: parsed.args,
        result: {
          success: true,
          data: result,
        },
        durationMs,
        timestamp: new Date(),
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`Tool execution failed: ${parsed.name}`, error as Error, {
        durationMs,
        callId: parsed.id,
      });

      return {
        name: parsed.name,
        callId: parsed.id,
        args: parsed.args,
        result: {
          success: false,
          error: errorMessage,
          suggestion: this.getSuggestionForError(parsed.name, error),
        },
        durationMs,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Execute multiple tool calls
   */
  async executeAll(
    toolCalls: ToolCall[],
    context: ToolExecutionContext
  ): Promise<ToolExecutionRecord[]> {
    logger.info(`Executing ${toolCalls.length} tool calls`);

    // Execute in batches to respect concurrency limit
    const results: ToolExecutionRecord[] = [];
    const batches = this.batchArray(toolCalls, this.options.maxConcurrent);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((tc) => this.execute(tc, context))
      );
      results.push(...batchResults);

      // Check if we should stop on error
      if (!this.options.continueOnError) {
        const failed = batchResults.find((r) => !r.result.success);
        if (failed) {
          logger.warn(`Stopping execution due to tool failure: ${failed.name}`);
          break;
        }
      }
    }

    return results;
  }

  /**
   * Format tool results for LLM consumption
   */
  formatResultForLLM(record: ToolExecutionRecord): string {
    if (record.result.success) {
      return JSON.stringify(record.result.data, null, 2);
    }

    const errorResponse: Record<string, unknown> = {
      error: record.result.error,
    };

    if (record.result.suggestion) {
      errorResponse.suggestion = record.result.suggestion;
    }

    return JSON.stringify(errorResponse, null, 2);
  }

  /**
   * Convert tool execution record to conversation message
   */
  toToolMessage(record: ToolExecutionRecord): {
    role: 'tool';
    tool_call_id: string;
    content: string;
  } {
    return {
      role: 'tool',
      tool_call_id: record.callId,
      content: this.formatResultForLLM(record),
    };
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    toolName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool "${toolName}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get error-specific suggestions
   */
  private getSuggestionForError(toolName: string, error: unknown): string | undefined {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerError = errorMessage.toLowerCase();

    // Common error patterns and suggestions
    if (lowerError.includes('not found') || lowerError.includes('404')) {
      return 'The requested resource was not found. Check the ID or create a new one.';
    }

    if (lowerError.includes('unauthorized') || lowerError.includes('401')) {
      return 'Authentication failed. The OAuth token may be expired or missing.';
    }

    if (lowerError.includes('forbidden') || lowerError.includes('403')) {
      return 'Permission denied. The user may not have access to this resource.';
    }

    if (lowerError.includes('rate limit') || lowerError.includes('429')) {
      return 'Rate limit exceeded. Try again in a few moments.';
    }

    if (lowerError.includes('timeout')) {
      return 'The operation timed out. The service may be slow or unavailable.';
    }

    if (lowerError.includes('network') || lowerError.includes('econnrefused')) {
      return 'Network error. The service may be unavailable.';
    }

    return undefined;
  }

  /**
   * Batch an array into chunks
   */
  private batchArray<T>(array: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  }
}

/**
 * Create a new tool executor
 */
export function createToolExecutor(
  registry: ToolRegistry,
  options?: ToolExecutorOptions
): ToolExecutor {
  return new ToolExecutor(registry, options);
}
