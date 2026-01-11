/**
 * Tool Types - OpenAI-compatible tool definitions for conversational agent
 */

/**
 * JSON Schema for tool parameters (OpenAI-compatible)
 */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    enum?: string[];
    items?: { type: string };
    default?: unknown;
  }>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Tool definition (OpenAI function calling format)
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
}

/**
 * Tool call from LLM response
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Parsed tool call with typed arguments
 */
export interface ParsedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  suggestion?: string;
}

/**
 * Tool handler function type
 */
export type ToolHandler<TArgs = Record<string, unknown>, TResult = unknown> = (
  args: TArgs,
  context: ToolExecutionContext
) => Promise<TResult>;

/**
 * Registered tool with handler
 */
export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
  category: ToolCategory;
}

/**
 * Tool categories for organization
 */
export type ToolCategory =
  | 'linear'
  | 'github'
  | 'rag'
  | 'workflow'
  | 'project'
  | 'figma'
  | 'sentry';

/**
 * Context passed to tool handlers during execution
 * This is a subset of AgentContext needed for tool execution
 */
export interface ToolExecutionContext {
  projectId: string;
  userId?: string;
  services: ToolServices;
}

/**
 * Services available to tool handlers
 * These are passed through from the AgentContext
 */
export interface ToolServices {
  // Linear operations
  linear?: {
    getIssue: (issueId: string) => Promise<unknown>;
    createIssue: (data: CreateIssueInput) => Promise<unknown>;
    updateStatus: (issueId: string, status: string) => Promise<unknown>;
    addComment: (issueId: string, body: string) => Promise<unknown>;
    queryIssues: (filter: IssueFilter) => Promise<unknown[]>;
  };

  // GitHub operations
  github?: {
    getRepo: (owner: string, repo: string) => Promise<unknown>;
    getFile: (owner: string, repo: string, path: string) => Promise<unknown>;
    createBranch: (owner: string, repo: string, branch: string, base: string) => Promise<unknown>;
    commitFiles: (data: CommitFilesInput) => Promise<unknown>;
    createPR: (data: CreatePRInput) => Promise<unknown>;
    getPipelineStatus: (owner: string, repo: string, branch: string) => Promise<unknown>;
  };

  // RAG operations
  rag?: {
    searchCodebase: (query: string, limit?: number) => Promise<RagSearchResult[]>;
    getFile: (filepath: string) => Promise<string | null>;
    getDirectoryTree: (path: string) => Promise<DirectoryNode>;
  };

  // Workflow operations
  workflow?: {
    start: (taskId: string, phase: WorkflowPhase) => Promise<WorkflowStartResult>;
    getStatus: (workflowId: string) => Promise<WorkflowStatus>;
    cancel: (workflowId: string) => Promise<void>;
  };
}

// Input types for services
export interface CreateIssueInput {
  title: string;
  description?: string;
  teamId: string;
  labels?: string[];
  priority?: number;
  assigneeId?: string;
}

export interface IssueFilter {
  teamId?: string;
  status?: string;
  assigneeId?: string;
  labels?: string[];
  limit?: number;
}

export interface CommitFilesInput {
  owner: string;
  repo: string;
  branch: string;
  files: Array<{ path: string; content: string }>;
  message: string;
}

export interface CreatePRInput {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

export interface RagSearchResult {
  content: string;
  filepath: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
}

export type WorkflowPhase = 'refinement' | 'user_story' | 'technical_plan' | 'code_generation';

export interface WorkflowStartResult {
  workflowId: string;
  status: string;
}

export interface WorkflowStatus {
  workflowId: string;
  phase: WorkflowPhase;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  error?: string;
}
