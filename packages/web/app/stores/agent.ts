/**
 * Agent Store - Pinia store for conversational agent state
 */

import { defineStore } from 'pinia'
import type {
  Message,
  ToolCall,
  ConnectionStatus,
  UsageStats,
  AgentState,
} from '~/types/agent.types'
import { getToolCategory } from '~/types/agent.types'

// Re-export getToolCategory helper
export { getToolCategory } from '~/types/agent.types'

export const useAgentStore = defineStore('agent', {
  state: (): AgentState => ({
    // Connection
    connectionStatus: 'disconnected',
    connectionError: null,

    // Conversation
    conversationId: null,
    messages: [],

    // Streaming
    isStreaming: false,
    streamingContent: '',
    activeToolCalls: new Map(),

    // Stats
    totalTokens: 0,
    totalCost: 0,
  }),

  getters: {
    /**
     * Check if connected to agent
     */
    isConnected: (state) => state.connectionStatus === 'connected',

    /**
     * Check if there are any messages
     */
    hasMessages: (state) => state.messages.length > 0,

    /**
     * Get current streaming message (assistant typing)
     */
    currentStreamingMessage: (state): Message | null => {
      if (!state.isStreaming) return null
      return {
        id: 'streaming',
        role: 'assistant',
        content: state.streamingContent,
        timestamp: new Date(),
        toolCalls: Array.from(state.activeToolCalls.values()),
        isStreaming: true,
      }
    },

    /**
     * All messages including current streaming
     */
    allMessages(): Message[] {
      const messages = [...this.messages]
      const streaming = this.currentStreamingMessage
      if (streaming) {
        messages.push(streaming)
      }
      return messages
    },

    /**
     * Get active tool calls as array
     */
    activeToolCallsArray: (state) => Array.from(state.activeToolCalls.values()),
  },

  actions: {
    /**
     * Set connection status
     */
    setConnectionStatus(status: ConnectionStatus, error?: string) {
      this.connectionStatus = status
      this.connectionError = error ?? null
    },

    /**
     * Add a user message
     */
    addUserMessage(content: string) {
      const message: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      }
      this.messages.push(message)

      // Start streaming state for assistant response
      this.isStreaming = true
      this.streamingContent = ''
      this.activeToolCalls.clear()
    },

    /**
     * Append content to streaming message
     */
    appendDelta(content: string) {
      this.streamingContent += content
    },

    /**
     * Add a tool call
     */
    addToolCall(name: string, args: Record<string, unknown>) {
      const toolCall: ToolCall = {
        id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        category: getToolCategory(name),
        args,
        status: 'executing',
      }
      this.activeToolCalls.set(toolCall.id, toolCall)
    },

    /**
     * Update tool call with result
     */
    updateToolResult(name: string, result: unknown, success: boolean) {
      // Find the tool call by name (most recent one)
      const entries = Array.from(this.activeToolCalls.entries())
      const entry = entries.reverse().find(([_, tc]) => tc.name === name && tc.status === 'executing')

      if (entry) {
        const [id, toolCall] = entry
        toolCall.result = result
        toolCall.success = success
        toolCall.status = success ? 'completed' : 'failed'
        this.activeToolCalls.set(id, toolCall)
      }
    },

    /**
     * Finish the current streaming message
     */
    finishMessage(conversationId: string, usage: UsageStats) {
      if (!this.isStreaming) return

      // Create final assistant message
      const message: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: this.streamingContent,
        timestamp: new Date(),
        toolCalls: Array.from(this.activeToolCalls.values()),
      }
      this.messages.push(message)

      // Update conversation ID
      this.conversationId = conversationId

      // Update stats
      this.totalTokens += usage.totalTokens
      if (usage.totalCost) {
        this.totalCost += usage.totalCost
      }

      // Reset streaming state
      this.isStreaming = false
      this.streamingContent = ''
      this.activeToolCalls.clear()
    },

    /**
     * Set error state
     */
    setError(message: string) {
      this.connectionError = message

      // If we were streaming, finish with error indicator
      if (this.isStreaming) {
        this.streamingContent += `\n\n**Erreur:** ${message}`
        this.finishMessage(this.conversationId || '', {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          llmCalls: 0,
          toolCalls: 0,
        })
      }
    },

    /**
     * Clear conversation and start fresh
     */
    clearConversation() {
      this.conversationId = null
      this.messages = []
      this.isStreaming = false
      this.streamingContent = ''
      this.activeToolCalls.clear()
      this.connectionError = null
    },

    /**
     * Reset all state
     */
    reset() {
      this.connectionStatus = 'disconnected'
      this.connectionError = null
      this.conversationId = null
      this.messages = []
      this.isStreaming = false
      this.streamingContent = ''
      this.activeToolCalls.clear()
      this.totalTokens = 0
      this.totalCost = 0
    },
  },
})
