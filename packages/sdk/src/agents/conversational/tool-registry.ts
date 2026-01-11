/**
 * Tool Registry - Register and manage tools for the conversational agent
 */

import { createLogger } from '@devflow/common';
import {
  ToolDefinition,
  RegisteredTool,
  ToolHandler,
  ToolCategory,
} from './tools/tool.types';

const logger = createLogger('ToolRegistry');

/**
 * Tool Registry
 *
 * Manages registration and lookup of tools available to the conversational agent.
 * Tools are registered with their OpenAI-compatible definitions and handlers.
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private toolsByCategory: Map<ToolCategory, string[]> = new Map();

  /**
   * Register a single tool
   */
  register(tool: RegisteredTool): void {
    const name = tool.definition.function.name;

    if (this.tools.has(name)) {
      logger.warn(`Tool "${name}" is already registered, overwriting`);
    }

    this.tools.set(name, tool);

    // Update category index
    const categoryTools = this.toolsByCategory.get(tool.category) || [];
    if (!categoryTools.includes(name)) {
      categoryTools.push(name);
      this.toolsByCategory.set(tool.category, categoryTools);
    }

    logger.debug(`Registered tool: ${name} (category: ${tool.category})`);
  }

  /**
   * Register multiple tools at once
   */
  registerAll(tools: RegisteredTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
    logger.info(`Registered ${tools.length} tools`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get a tool handler by name
   */
  getHandler(name: string): ToolHandler | undefined {
    return this.tools.get(name)?.handler;
  }

  /**
   * Get all registered tools
   */
  getAllTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool definitions (for LLM)
   */
  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): RegisteredTool[] {
    const names = this.toolsByCategory.get(category) || [];
    return names.map((name) => this.tools.get(name)!).filter(Boolean);
  }

  /**
   * Get tool definitions by category
   */
  getDefinitionsByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getToolsByCategory(category).map((t) => t.definition);
  }

  /**
   * Get tool definitions by multiple categories
   */
  getDefinitionsByCategories(categories: ToolCategory[]): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];
    for (const category of categories) {
      definitions.push(...this.getDefinitionsByCategory(category));
    }
    return definitions;
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all categories with registered tools
   */
  getCategories(): ToolCategory[] {
    return Array.from(this.toolsByCategory.keys());
  }

  /**
   * Get tool count
   */
  get count(): number {
    return this.tools.size;
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    this.tools.delete(name);

    // Update category index
    const categoryTools = this.toolsByCategory.get(tool.category);
    if (categoryTools) {
      const index = categoryTools.indexOf(name);
      if (index !== -1) {
        categoryTools.splice(index, 1);
      }
    }

    logger.debug(`Unregistered tool: ${name}`);
    return true;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.toolsByCategory.clear();
    logger.debug('Cleared all registered tools');
  }

  /**
   * Create a filtered registry with only specified categories
   */
  filter(categories: ToolCategory[]): ToolRegistry {
    const filtered = new ToolRegistry();
    for (const category of categories) {
      for (const tool of this.getToolsByCategory(category)) {
        filtered.register(tool);
      }
    }
    return filtered;
  }

  /**
   * Get a summary of registered tools for logging
   */
  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const [category, names] of this.toolsByCategory) {
      summary[category] = names.length;
    }
    return summary;
  }
}

/**
 * Create a new tool registry
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}

/**
 * Helper to create a tool definition
 */
export function defineTool(
  name: string,
  description: string,
  parameters: RegisteredTool['definition']['function']['parameters'],
  handler: ToolHandler,
  category: ToolCategory
): RegisteredTool {
  return {
    definition: {
      type: 'function',
      function: {
        name,
        description,
        parameters,
      },
    },
    handler,
    category,
  };
}
