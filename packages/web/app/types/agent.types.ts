/**
 * Agent Types - TypeScript definitions for the conversational agent
 */

// ============================================
// Tool Categories
// ============================================

export type ToolCategory = 'linear' | 'github' | 'rag' | 'workflow' | 'project'

// ============================================
// Tool Call Types
// ============================================

export interface ToolCall {
  id: string
  name: string
  category: ToolCategory
  args: Record<string, unknown>
  result?: unknown
  success?: boolean
  status: 'executing' | 'completed' | 'failed'
}

// ============================================
// Message Types
// ============================================

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
  isStreaming?: boolean
}

// ============================================
// Connection Status
// ============================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// ============================================
// Usage Stats
// ============================================

export interface UsageStats {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalCost?: number
  llmCalls: number
  toolCalls: number
}

// ============================================
// WebSocket Response Types (from API)
// ============================================

export interface AgentDeltaResponse {
  type: 'delta'
  content: string
}

export interface AgentToolCallResponse {
  type: 'tool_call'
  name: string
  args: Record<string, unknown>
}

export interface AgentToolResultResponse {
  type: 'tool_result'
  name: string
  result: unknown
  success: boolean
}

export interface AgentDoneResponse {
  type: 'done'
  conversationId: string
  usage: UsageStats
}

export interface AgentErrorResponse {
  type: 'error'
  message: string
  code?: string
}

export type AgentResponse =
  | AgentDeltaResponse
  | AgentToolCallResponse
  | AgentToolResultResponse
  | AgentDoneResponse
  | AgentErrorResponse

// ============================================
// Chat Event (Client → Server)
// ============================================

export interface AgentChatEvent {
  projectId: string
  message: string
  conversationId?: string
}

// ============================================
// Store State
// ============================================

export interface AgentState {
  // Connection
  connectionStatus: ConnectionStatus
  connectionError: string | null

  // Conversation
  conversationId: string | null
  messages: Message[]

  // Streaming
  isStreaming: boolean
  streamingContent: string
  activeToolCalls: Map<string, ToolCall>

  // Stats
  totalTokens: number
  totalCost: number
}

// ============================================
// Prompt Suggestions
// ============================================

export interface PromptSuggestion {
  icon: string
  label: string
  prompt: string
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the category of a tool from its name
 */
export function getToolCategory(toolName: string): ToolCategory {
  if (toolName.startsWith('linear_')) return 'linear'
  if (toolName.startsWith('github_')) return 'github'
  if (toolName.startsWith('rag_')) return 'rag'
  if (toolName.startsWith('workflow_')) return 'workflow'
  if (toolName.startsWith('project_')) return 'project'
  return 'project' // default
}

/**
 * Get display info for a tool category
 */
export function getToolCategoryInfo(category: ToolCategory): { icon: string; color: string; bgColor: string } {
  switch (category) {
    case 'linear':
      return { icon: '📋', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' }
    case 'github':
      return { icon: '🐙', color: 'text-gray-900 dark:text-gray-100', bgColor: 'bg-gray-100 dark:bg-gray-800' }
    case 'rag':
      return { icon: '🔍', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' }
    case 'workflow':
      return { icon: '🚀', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' }
    case 'project':
      return { icon: '📁', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' }
  }
}
