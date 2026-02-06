<script setup lang="ts">
/**
 * AgentChat - Main container for the conversational agent interface
 */

const agentStore = useAgentStore()
const projectsStore = useProjectsStore()
const { connect, disconnect, sendMessage } = useAgentSocket()

// Refs for scrolling
const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

/**
 * Auto-scroll to bottom when messages change
 */
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Watch for new messages and scroll
watch(
  () => agentStore.allMessages.length,
  () => scrollToBottom()
)

// Watch streaming content for scroll
watch(
  () => agentStore.streamingContent,
  () => scrollToBottom()
)

/**
 * Connect when project is selected
 */
watch(
  () => projectsStore.selectedProjectId,
  (newProjectId) => {
    if (newProjectId) {
      connect()
    } else {
      disconnect()
    }
  },
  { immediate: true }
)

/**
 * Handle send message
 */
function handleSend(message: string) {
  if (!projectsStore.selectedProjectId) {
    return
  }
  sendMessage(message)
}

/**
 * Handle prompt selection from welcome screen
 */
function handlePromptSelect(prompt: string) {
  // Focus input and set the prompt (user can complete it)
  // For a better UX, just send it directly
  handleSend(prompt)
}

/**
 * Start a new conversation
 */
function handleNewChat() {
  agentStore.clearConversation()
}

// Cleanup on unmount
onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
    <!-- Header -->
    <AgentHeader
      :connection-status="agentStore.connectionStatus"
      @new-chat="handleNewChat"
    />

    <!-- Main content -->
    <main class="relative flex flex-1 flex-col overflow-hidden">
      <!-- No project selected warning -->
      <div
        v-if="!projectsStore.selectedProjectId"
        class="flex flex-1 items-center justify-center"
      >
        <div class="text-center">
          <div class="mb-4 text-5xl">📁</div>
          <h2 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            Aucun projet sélectionné
          </h2>
          <p class="mb-4 text-gray-500 dark:text-gray-400">
            Sélectionnez un projet pour commencer à discuter avec l'agent.
          </p>
          <NuxtLink
            to="/projects"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Voir mes projets
          </NuxtLink>
        </div>
      </div>

      <!-- Chat interface -->
      <template v-else>
        <!-- Messages area -->
        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto"
        >
          <!-- Welcome screen when no messages -->
          <AgentWelcomeScreen
            v-if="!agentStore.hasMessages"
            @select="handlePromptSelect"
          />

          <!-- Messages list -->
          <div
            v-else
            class="mx-auto max-w-3xl space-y-4 px-4 py-6"
          >
            <AgentMessageBubble
              v-for="message in agentStore.allMessages"
              :key="message.id"
              :message="message"
            />
          </div>
        </div>

        <!-- Input area (fixed at bottom) -->
        <div class="shrink-0 border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div class="mx-auto max-w-3xl">
            <!-- Error message -->
            <div
              v-if="agentStore.connectionError"
              class="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              {{ agentStore.connectionError }}
            </div>

            <!-- Chat input -->
            <AgentChatInput
              :disabled="agentStore.isStreaming || agentStore.connectionStatus !== 'connected'"
              :placeholder="
                agentStore.connectionStatus !== 'connected'
                  ? 'Connexion en cours...'
                  : 'Envoyer un message...'
              "
              @send="handleSend"
            />

            <!-- Usage stats (subtle) -->
            <div
              v-if="agentStore.totalTokens > 0"
              class="mt-2 text-center text-xs text-gray-400"
            >
              {{ agentStore.totalTokens.toLocaleString() }} tokens utilisés
              <span v-if="agentStore.totalCost > 0">
                · ${{ agentStore.totalCost.toFixed(4) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
