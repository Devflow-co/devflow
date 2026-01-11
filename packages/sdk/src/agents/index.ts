/**
 * Code Agents - Multi-provider support
 */

export * from '@/agents/agent.interface';
export * from '@/agents/anthropic.provider';
export * from '@/agents/openrouter.provider';
export * from '@/agents/ollama.provider';
export * from '@/agents/prompts/prompt-loader';
export * from '@/agents/council';

// Conversational Agent (Tool-calling agent for interactive use)
export * from '@/agents/conversational';

// Agent Factory
import { CodeAgentDriver, AgentConfig } from '@/agents/agent.interface';
import { AnthropicProvider } from '@/agents/anthropic.provider';
import { OpenRouterProvider } from '@/agents/openrouter.provider';
import { OllamaProvider, OllamaConfig } from '@/agents/ollama.provider';

/**
 * Extended config for Ollama provider (local LLM)
 */
export interface OllamaAgentConfig {
  provider: 'ollama';
  baseUrl?: string;
  model?: string;
  timeout?: number;
  keepAlive?: string;
  numCtx?: number;
  temperature?: number;
}

export type ExtendedAgentConfig = AgentConfig | OllamaAgentConfig;

/**
 * Create a code agent driver based on configuration
 */
export function createCodeAgentDriver(config: ExtendedAgentConfig): CodeAgentDriver {
  switch (config.provider) {
    case 'openrouter':
      return new OpenRouterProvider((config as AgentConfig).apiKey, config.model);
    case 'anthropic':
      return new AnthropicProvider((config as AgentConfig).apiKey, config.model);
    case 'ollama':
      const ollamaConfig = config as OllamaAgentConfig;
      return new OllamaProvider({
        baseUrl: ollamaConfig.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: ollamaConfig.model || process.env.OLLAMA_CODE_MODEL || 'deepseek-coder:6.7b',
        timeout: ollamaConfig.timeout || parseInt(process.env.OLLAMA_TIMEOUT || '300000'),
        keepAlive: ollamaConfig.keepAlive || process.env.OLLAMA_KEEP_ALIVE || '5m',
        numCtx: ollamaConfig.numCtx || parseInt(process.env.OLLAMA_NUM_CTX || '8192'),
        temperature: ollamaConfig.temperature ?? parseFloat(process.env.OLLAMA_TEMPERATURE || '0.1'),
      });
    default:
      throw new Error(`Unsupported provider: ${config.provider}. Use 'openrouter', 'anthropic', or 'ollama'.`);
  }
}
