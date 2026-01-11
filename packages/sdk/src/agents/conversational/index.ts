/**
 * Conversational Agent - Main exports
 *
 * SDK-first conversational agent with tool calling support.
 * Provider-agnostic design allows switching between OpenRouter, Ollama, etc.
 */

// Core agent
export {
  ConversationalAgent,
  createConversationalAgent,
} from './conversational-agent';

// Context and response types
export * from './agent-context.types';
export * from './agent-response.types';

// LLM Provider interface
export * from './llm-provider.interface';

// Tool types and registry
export * from './tools';
export {
  ToolRegistry,
  createToolRegistry,
  defineTool,
} from './tool-registry';

// Tool executor
export {
  ToolExecutor,
  createToolExecutor,
  type ToolExecutorOptions,
} from './tool-executor';

// Providers
export * from './providers';
