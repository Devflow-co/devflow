/**
 * Conversational Agent - Core agent that orchestrates tool calling and LLM interactions
 *
 * This agent follows the Claude Code style: reason, loop on tools, and retry until success.
 */

import { createLogger } from '@devflow/common';
import {
  AgentContext,
  AgentCallbacks,
  ConversationMessage,
  ProcessMessageOptions,
} from './agent-context.types';
import {
  ConversationalAgentResponse,
  ConversationalAgentUsage,
  ToolExecutionRecord,
} from './agent-response.types';
import { ILLMProvider, LLMResponse } from './llm-provider.interface';
import { ToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { ToolDefinition, ToolExecutionContext } from './tools/tool.types';

const logger = createLogger('ConversationalAgent');

/**
 * Default options for message processing
 */
const DEFAULT_OPTIONS: Required<ProcessMessageOptions> = {
  maxIterations: 10,
  toolChoice: 'auto',
  temperature: 0.7,
  maxTokens: 4096,
  stream: true,
};

/**
 * Default system prompt for the conversational agent
 */
const DEFAULT_SYSTEM_PROMPT = `You are DevFlow Assistant, an AI agent that helps developers manage their projects and automate development workflows.

You have access to tools that allow you to:
- Search and analyze codebases using RAG (Retrieval-Augmented Generation)
- Manage Linear issues (create, update, query, comment)
- Interact with GitHub repositories (view files, create branches, commit code, open PRs)
- Trigger and monitor DevFlow workflows (refinement, user story, technical plan, code generation)

## Guidelines

1. **Be helpful and proactive**: Anticipate what the user needs and offer relevant suggestions.
2. **Use tools effectively**: When you need information, use the appropriate tool. Don't guess.
3. **Iterate when needed**: If a tool returns unexpected results, try alternative approaches.
4. **Be concise**: Keep responses focused and actionable.
5. **Handle errors gracefully**: If a tool fails, explain what happened and suggest alternatives.

## Tool Usage

- Always verify the result of tool calls before proceeding
- If you're unsure which tool to use, search the codebase first for context
- For complex operations, break them down into smaller steps
- When creating issues or PRs, use clear, descriptive titles and descriptions

Remember: You're helping developers be more productive. Focus on delivering value.`;

/**
 * Conversational Agent
 *
 * Core agent that processes user messages, calls tools, and generates responses.
 * Implements a tool calling loop similar to Claude Code.
 */
export class ConversationalAgent {
  private provider: ILLMProvider;
  private registry: ToolRegistry;
  private executor: ToolExecutor;

  constructor(
    provider: ILLMProvider,
    registry: ToolRegistry,
    executor: ToolExecutor
  ) {
    this.provider = provider;
    this.registry = registry;
    this.executor = executor;
  }

  /**
   * Process a user message and generate a response
   *
   * This is the main entry point for the agent. It:
   * 1. Builds the message history with system prompt
   * 2. Calls the LLM with available tools
   * 3. Executes any tool calls
   * 4. Loops back to the LLM with tool results
   * 5. Returns the final response
   */
  async processMessage(
    message: string,
    history: ConversationMessage[],
    context: AgentContext,
    callbacks?: AgentCallbacks,
    options?: ProcessMessageOptions
  ): Promise<ConversationalAgentResponse> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    // Build initial messages
    const messages = this.buildMessages(message, history, context);

    // Get tool definitions
    const tools = this.getEnabledTools(context);

    // Track metrics
    const usage: ConversationalAgentUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      llmCalls: 0,
      toolCalls: 0,
    };

    // Track tool executions
    const toolExecutions: ToolExecutionRecord[] = [];

    // Track new messages for history
    const newMessages: ConversationMessage[] = [];

    // Add user message to new messages
    newMessages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Build execution context for tools
    const toolContext: ToolExecutionContext = {
      projectId: context.projectId,
      userId: context.userId,
      services: context.services,
    };

    let iteration = 0;
    let lastResponse: LLMResponse | null = null;
    let finalContent = '';

    try {
      // Tool calling loop
      while (iteration < opts.maxIterations) {
        iteration++;
        logger.debug(`Processing iteration ${iteration}/${opts.maxIterations}`);

        // Call LLM
        const response = await this.provider.generateWithTools(
          messages,
          tools,
          {
            temperature: opts.temperature,
            maxTokens: opts.maxTokens,
            toolChoice: opts.toolChoice,
            onDelta: callbacks?.onDelta,
            onToolCall: (call) => {
              callbacks?.onToolCall?.(
                call.function.name,
                JSON.parse(call.function.arguments)
              );
            },
          }
        );

        lastResponse = response;
        usage.llmCalls++;
        usage.inputTokens += response.usage.inputTokens;
        usage.outputTokens += response.usage.outputTokens;
        usage.totalTokens += response.usage.totalTokens;
        if (response.usage.totalCost) {
          usage.totalCost = (usage.totalCost || 0) + response.usage.totalCost;
        }

        // Handle response based on finish reason
        if (response.finishReason === 'stop' || response.toolCalls.length === 0) {
          // No more tool calls, we're done
          finalContent = response.content;

          // Add assistant message to history
          newMessages.push({
            role: 'assistant',
            content: response.content,
            timestamp: new Date(),
          });

          break;
        }

        // Process tool calls
        if (response.toolCalls.length > 0) {
          logger.info(`Processing ${response.toolCalls.length} tool calls`);

          // Check rate limits
          if (context.rateLimits?.maxToolCallsPerMessage) {
            const totalToolCalls = usage.toolCalls + response.toolCalls.length;
            if (totalToolCalls > context.rateLimits.maxToolCallsPerMessage) {
              logger.warn('Tool call limit exceeded');
              finalContent = "I've reached the maximum number of tool calls for this message. Please try again with a simpler request.";
              break;
            }
          }

          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content,
            tool_calls: response.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          });

          newMessages.push({
            role: 'assistant',
            content: response.content,
            tool_calls: response.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
            timestamp: new Date(),
          });

          // Execute tools
          const results = await this.executor.executeAll(response.toolCalls, toolContext);
          toolExecutions.push(...results);
          usage.toolCalls += results.length;

          // Notify callbacks
          for (const result of results) {
            callbacks?.onToolResult?.(
              result.name,
              result.result.data ?? result.result.error,
              result.result.success
            );
          }

          // Add tool results to messages
          for (const result of results) {
            const toolMessage = this.executor.toToolMessage(result);
            messages.push(toolMessage);
            newMessages.push({
              ...toolMessage,
              timestamp: new Date(),
            });
          }
        }
      }

      // Check if we hit iteration limit
      if (iteration >= opts.maxIterations && !finalContent) {
        logger.warn(`Hit max iterations (${opts.maxIterations})`);
        finalContent = "I've been working on this for a while but haven't completed it. Let me summarize what I've done so far and you can guide me on next steps.";
      }

      const latencyMs = Date.now() - startTime;
      usage.latencyMs = latencyMs;

      logger.info('Message processing complete', {
        iterations: iteration,
        toolCalls: usage.toolCalls,
        llmCalls: usage.llmCalls,
        latencyMs,
      });

      return {
        content: finalContent,
        success: true,
        usage,
        model: this.provider.model,
        provider: this.provider.name,
        toolExecutions,
        newMessages,
        finishReason: lastResponse?.finishReason as ConversationalAgentResponse['finishReason'],
        requestId: lastResponse?.requestId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error processing message', error as Error);

      callbacks?.onError?.(error instanceof Error ? error : new Error(errorMessage));

      return {
        content: `I encountered an error: ${errorMessage}`,
        success: false,
        error: errorMessage,
        usage,
        model: this.provider.model,
        provider: this.provider.name,
        toolExecutions,
        newMessages,
        finishReason: 'error',
      };
    }
  }

  /**
   * Build message array with system prompt and history
   */
  private buildMessages(
    message: string,
    history: ConversationMessage[],
    context: AgentContext
  ): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    // Add system prompt
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;

    // Add project context if available
    if (context.projectContext) {
      systemPrompt += `\n\n## Current Project\n\n`;
      systemPrompt += `- **Name**: ${context.projectContext.name}\n`;
      if (context.projectContext.description) {
        systemPrompt += `- **Description**: ${context.projectContext.description}\n`;
      }
      if (context.projectContext.language) {
        systemPrompt += `- **Language**: ${context.projectContext.language}\n`;
      }
      if (context.projectContext.framework) {
        systemPrompt += `- **Framework**: ${context.projectContext.framework}\n`;
      }
      if (context.projectContext.repository) {
        systemPrompt += `- **Repository**: ${context.projectContext.repository.owner}/${context.projectContext.repository.repo}\n`;
      }
    }

    // Add custom system prompt additions
    if (context.additionalSystemPrompt) {
      systemPrompt += `\n\n${context.additionalSystemPrompt}`;
    }

    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // Add history (excluding the system message if present)
    for (const msg of history) {
      if (msg.role !== 'system') {
        messages.push(msg);
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message,
    });

    return messages;
  }

  /**
   * Get enabled tools based on context features
   */
  private getEnabledTools(context: AgentContext): ToolDefinition[] {
    const features = context.features || {};
    const enabledCategories: string[] = [];

    // Always enable these
    enabledCategories.push('linear', 'github', 'rag', 'project');

    // Conditionally enable workflow tools
    if (features.enableWorkflowTools !== false) {
      enabledCategories.push('workflow');
    }

    // Get all tools from enabled categories
    const allTools = this.registry.getAllDefinitions();

    // Filter by category if needed
    if (enabledCategories.length > 0) {
      const enabledSet = new Set(enabledCategories);
      return allTools.filter((tool) => {
        const registeredTool = this.registry.getTool(tool.function.name);
        return registeredTool && enabledSet.has(registeredTool.category);
      });
    }

    return allTools;
  }

  /**
   * Get the provider being used
   */
  getProvider(): ILLMProvider {
    return this.provider;
  }

  /**
   * Get the tool registry
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * Check if the agent is properly configured
   */
  async isReady(): Promise<boolean> {
    try {
      const providerAvailable = await this.provider.isAvailable();
      const hasTools = this.registry.count > 0;
      return providerAvailable && hasTools;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new conversational agent
 */
export function createConversationalAgent(
  provider: ILLMProvider,
  registry: ToolRegistry,
  executor: ToolExecutor
): ConversationalAgent {
  return new ConversationalAgent(provider, registry, executor);
}
