/**
 * Agent WebSocket Composable - Manages Socket.IO connection to the agent
 */

import { io, Socket } from 'socket.io-client'
import type { AgentResponse, AgentChatEvent } from '~/types/agent.types'
import { useAgentStore } from '~/stores/agent'
import { useProjectsStore } from '~/stores/projects'

export function useAgentSocket() {
  const config = useRuntimeConfig()
  const agentStore = useAgentStore()
  const projectsStore = useProjectsStore()

  // Socket instance (kept in closure, not reactive to avoid serialization issues)
  let socket: Socket | null = null

  /**
   * Connect to the agent WebSocket
   */
  function connect() {
    if (socket?.connected) {
      return
    }

    agentStore.setConnectionStatus('connecting')

    // Build WebSocket URL from API base
    const apiBase = config.public.apiBase as string
    const wsUrl = apiBase.replace('/api/v1', '')

    socket = io(`${wsUrl}/agent`, {
      withCredentials: true, // Send session cookie
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })

    // Connection events
    socket.on('connect', () => {
      console.log('[Agent] WebSocket connected')
    })

    socket.on('connected', (data: { userId: string }) => {
      console.log('[Agent] Authenticated as', data.userId)
      agentStore.setConnectionStatus('connected')
    })

    socket.on('disconnect', (reason) => {
      console.log('[Agent] WebSocket disconnected:', reason)
      agentStore.setConnectionStatus('disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('[Agent] Connection error:', error.message)
      agentStore.setConnectionStatus('error', error.message)
    })

    // Response events
    socket.on('response', handleResponse)

    // Error events
    socket.on('error', (data: { message: string; code?: string }) => {
      console.error('[Agent] Error:', data)
      agentStore.setError(data.message)
    })

    // Pong for keep-alive
    socket.on('pong', () => {
      // Connection is alive
    })
  }

  /**
   * Disconnect from the agent WebSocket
   */
  function disconnect() {
    if (socket) {
      socket.disconnect()
      socket = null
      agentStore.setConnectionStatus('disconnected')
    }
  }

  /**
   * Send a chat message
   */
  function sendMessage(message: string) {
    if (!socket?.connected) {
      agentStore.setError('Non connecté au serveur')
      return
    }

    const projectId = projectsStore.selectedProjectId
    if (!projectId) {
      agentStore.setError('Aucun projet sélectionné')
      return
    }

    // Add user message to store and start streaming state
    agentStore.addUserMessage(message)

    // Send to server
    const event: AgentChatEvent = {
      projectId,
      message,
      conversationId: agentStore.conversationId || undefined,
    }

    socket.emit('chat', event)
  }

  /**
   * Handle incoming response from agent
   */
  function handleResponse(data: AgentResponse) {
    switch (data.type) {
      case 'delta':
        agentStore.appendDelta(data.content)
        break

      case 'tool_call':
        agentStore.addToolCall(data.name, data.args)
        break

      case 'tool_result':
        agentStore.updateToolResult(data.name, data.result, data.success)
        break

      case 'done':
        agentStore.finishMessage(data.conversationId, data.usage)
        break

      case 'error':
        agentStore.setError(data.message)
        break
    }
  }

  /**
   * Send ping to keep connection alive
   */
  function ping() {
    socket?.emit('ping')
  }

  /**
   * Check if socket is connected
   */
  function isConnected(): boolean {
    return socket?.connected ?? false
  }

  // Auto-cleanup on component unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    connect,
    disconnect,
    sendMessage,
    ping,
    isConnected,
  }
}
