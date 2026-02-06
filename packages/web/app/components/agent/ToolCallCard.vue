<script setup lang="ts">
/**
 * ToolCallCard - Displays a tool call with its status and result
 */

import type { ToolCall, ToolCategory } from '~/types/agent.types'
import { getToolCategoryInfo } from '~/types/agent.types'

const props = defineProps<{
  toolCall: ToolCall
}>()

const isExpanded = ref(false)

/**
 * Get category display info
 */
const categoryInfo = computed(() => getToolCategoryInfo(props.toolCall.category))

/**
 * Format tool name for display
 */
const displayName = computed(() => {
  // Remove category prefix and format
  const name = props.toolCall.name
    .replace(/^(linear|github|rag|workflow|project)_/, '')
    .replace(/_/g, ' ')
  return name.charAt(0).toUpperCase() + name.slice(1)
})

/**
 * Format args for compact display
 */
const compactArgs = computed(() => {
  const args = props.toolCall.args
  const entries = Object.entries(args).slice(0, 2)
  return entries.map(([k, v]) => {
    const value = typeof v === 'string' ? v : JSON.stringify(v)
    const truncated = value.length > 30 ? value.slice(0, 30) + '...' : value
    return `${k}: ${truncated}`
  }).join(', ')
})

/**
 * Format result for display
 */
const formattedResult = computed(() => {
  if (!props.toolCall.result) return null
  return JSON.stringify(props.toolCall.result, null, 2)
})

/**
 * Status indicator
 */
const statusIcon = computed(() => {
  switch (props.toolCall.status) {
    case 'executing':
      return 'spinner'
    case 'completed':
      return props.toolCall.success ? 'check' : 'error'
    case 'failed':
      return 'error'
  }
})
</script>

<template>
  <div
    class="rounded-lg border transition-colors"
    :class="[
      categoryInfo.bgColor,
      isExpanded ? 'border-gray-300 dark:border-gray-600' : 'border-transparent',
    ]"
  >
    <!-- Header - always visible -->
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      @click="isExpanded = !isExpanded"
    >
      <!-- Category icon -->
      <span class="text-base">{{ categoryInfo.icon }}</span>

      <!-- Tool name -->
      <span class="font-medium" :class="categoryInfo.color">
        {{ displayName }}
      </span>

      <!-- Compact args -->
      <span class="flex-1 truncate text-xs text-gray-500 dark:text-gray-400">
        {{ compactArgs }}
      </span>

      <!-- Status indicator -->
      <span class="shrink-0">
        <!-- Spinner -->
        <svg
          v-if="statusIcon === 'spinner'"
          class="h-4 w-4 animate-spin text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <!-- Check -->
        <svg
          v-else-if="statusIcon === 'check'"
          class="h-4 w-4 text-green-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <!-- Error -->
        <svg
          v-else-if="statusIcon === 'error'"
          class="h-4 w-4 text-red-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </span>

      <!-- Expand chevron -->
      <svg
        class="h-4 w-4 shrink-0 text-gray-400 transition-transform"
        :class="{ 'rotate-180': isExpanded }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Expanded details -->
    <div v-if="isExpanded" class="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
      <!-- Arguments -->
      <div class="mb-2">
        <div class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Arguments</div>
        <pre class="overflow-x-auto rounded bg-gray-100 p-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">{{ JSON.stringify(toolCall.args, null, 2) }}</pre>
      </div>

      <!-- Result -->
      <div v-if="toolCall.result !== undefined">
        <div class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Résultat</div>
        <pre class="max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">{{ formattedResult }}</pre>
      </div>
    </div>
  </div>
</template>
