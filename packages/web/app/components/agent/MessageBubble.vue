<script setup lang="ts">
/**
 * MessageBubble - Displays a chat message (user or assistant)
 */

import { marked } from 'marked'
import type { Message } from '~/types/agent.types'

const props = defineProps<{
  message: Message
}>()

/**
 * Parse markdown content to HTML
 */
const renderedContent = computed(() => {
  if (!props.message.content) return ''

  // Configure marked
  marked.setOptions({
    breaks: true,
    gfm: true,
  })

  return marked.parse(props.message.content) as string
})

/**
 * Format timestamp
 */
const formattedTime = computed(() => {
  const date = new Date(props.message.timestamp)
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
})

/**
 * Check if message is from user
 */
const isUser = computed(() => props.message.role === 'user')
</script>

<template>
  <div
    class="flex w-full"
    :class="isUser ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[85%] space-y-2 md:max-w-[75%]"
      :class="isUser ? 'items-end' : 'items-start'"
    >
      <!-- Message bubble -->
      <div
        class="rounded-2xl px-4 py-3"
        :class="
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
        "
      >
        <!-- Content -->
        <div
          class="prose prose-sm max-w-none"
          :class="
            isUser
              ? 'prose-invert'
              : 'dark:prose-invert'
          "
          v-html="renderedContent"
        />

        <!-- Streaming cursor -->
        <span
          v-if="message.isStreaming && !message.content"
          class="inline-block h-4 w-2 animate-pulse rounded-sm bg-current opacity-75"
        />
      </div>

      <!-- Tool calls (only for assistant messages) -->
      <div
        v-if="!isUser && message.toolCalls && message.toolCalls.length > 0"
        class="space-y-1"
      >
        <AgentToolCallCard
          v-for="toolCall in message.toolCalls"
          :key="toolCall.id"
          :tool-call="toolCall"
        />
      </div>

      <!-- Timestamp -->
      <div
        class="text-xs text-gray-400"
        :class="isUser ? 'text-right' : 'text-left'"
      >
        {{ formattedTime }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Markdown content styling */
.prose :deep(pre) {
  @apply rounded-lg bg-gray-900 p-3 text-sm;
  overflow-x: auto;
}

.prose :deep(code) {
  @apply rounded bg-gray-200 px-1 py-0.5 text-sm dark:bg-gray-700;
}

.prose :deep(pre code) {
  @apply bg-transparent p-0;
}

.prose :deep(a) {
  @apply text-indigo-500 hover:text-indigo-600 dark:text-indigo-400;
}

.prose :deep(ul) {
  @apply list-disc pl-5;
}

.prose :deep(ol) {
  @apply list-decimal pl-5;
}

.prose :deep(blockquote) {
  @apply border-l-4 border-gray-300 pl-4 italic dark:border-gray-600;
}

/* User message specific */
.prose-invert :deep(code) {
  @apply bg-indigo-500/30;
}
</style>
