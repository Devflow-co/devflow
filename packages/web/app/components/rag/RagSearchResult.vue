<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {{ result.filePath }}
        </span>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            {{ result.language }}
          </span>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {{ result.chunkType }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2 ml-4">
        <span
          :class="[
            'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold',
            scoreClass
          ]"
          :title="`Relevance score: ${(result.score * 100).toFixed(1)}%`"
        >
          {{ (result.score * 100).toFixed(0) }}%
        </span>
      </div>
    </div>

    <!-- Line numbers -->
    <div
      v-if="result.startLine && result.endLine"
      class="px-4 py-1.5 bg-gray-50 dark:bg-gray-750 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
    >
      Lines {{ result.startLine }} - {{ result.endLine }}
    </div>

    <!-- Content preview -->
    <div class="relative">
      <pre
        class="p-4 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 overflow-x-auto"
        :class="{ 'max-h-48': !expanded }"
      ><code>{{ truncatedContent }}</code></pre>

      <!-- Expand/collapse button -->
      <div
        v-if="isLongContent"
        class="absolute bottom-0 left-0 right-0 flex justify-center py-2 bg-gradient-to-t from-gray-50 dark:from-gray-900"
      >
        <button
          type="button"
          class="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Show less' : 'Show more' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface RetrievalResult {
  chunkId: string
  filePath: string
  content: string
  score: number
  startLine?: number
  endLine?: number
  language: string
  chunkType: string
  metadata: Record<string, unknown>
}

interface Props {
  result: RetrievalResult
  maxPreviewLines?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxPreviewLines: 15,
})

const expanded = ref(false)

const scoreClass = computed(() => {
  const score = props.result.score
  if (score >= 0.8) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  } else if (score >= 0.6) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  } else {
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
})

const contentLines = computed(() => props.result.content.split('\n'))
const isLongContent = computed(() => contentLines.value.length > props.maxPreviewLines)

const truncatedContent = computed(() => {
  if (expanded.value || !isLongContent.value) {
    return props.result.content
  }
  return contentLines.value.slice(0, props.maxPreviewLines).join('\n') + '\n...'
})
</script>
