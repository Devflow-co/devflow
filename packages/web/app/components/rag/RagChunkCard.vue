<template>
  <div
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
    @click="expanded = !expanded"
  >
    <!-- Compact header -->
    <div class="px-4 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <!-- Expand icon -->
        <svg
          class="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform"
          :class="{ 'rotate-90': expanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>

        <!-- File path -->
        <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {{ chunk.filePath }}
        </span>
      </div>

      <!-- Metadata badges -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {{ chunk.language }}
        </span>
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {{ chunk.chunkType }}
        </span>
        <span
          v-if="chunk.startLine && chunk.endLine"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ chunk.endLine - chunk.startLine + 1 }} lines
        </span>
      </div>
    </div>

    <!-- Expandable content -->
    <div v-if="expanded" class="border-t border-gray-200 dark:border-gray-700">
      <!-- Line info -->
      <div
        v-if="chunk.startLine && chunk.endLine"
        class="px-4 py-1.5 bg-gray-50 dark:bg-gray-750 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
      >
        Lines {{ chunk.startLine }} - {{ chunk.endLine }}
      </div>

      <!-- Code content -->
      <pre class="p-4 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 overflow-x-auto max-h-96"><code>{{ chunk.content }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface DocumentChunk {
  id: string
  filePath: string
  content: string
  language: string
  chunkType: string
  startLine: number | null
  endLine: number | null
  createdAt: string
}

interface Props {
  chunk: DocumentChunk
}

defineProps<Props>()

const expanded = ref(false)
</script>
