<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Indexing Statistics</h3>
      <slot name="actions" />
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-8">
      <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
    </div>

    <!-- No index state -->
    <div v-else-if="!stats?.activeIndex" class="text-center py-8">
      <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <p class="text-gray-500 dark:text-gray-400 mb-4">No codebase index found</p>
      <p class="text-sm text-gray-400 dark:text-gray-500">Index your codebase to enable semantic search</p>
    </div>

    <!-- Stats grid -->
    <div v-else>
      <div class="grid grid-cols-3 gap-4 mb-6">
        <!-- Chunks -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ formatNumber(stats.totalChunks) }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Chunks</p>
        </div>

        <!-- Files -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ formatNumber(stats.totalFiles) }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Files</p>
        </div>

        <!-- Retrievals -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ formatNumber(stats.retrieval.totalRetrievals) }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Retrievals (30d)</p>
        </div>
      </div>

      <!-- Index info -->
      <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Commit: <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">{{ stats.activeIndex.commitSha.substring(0, 7) }}</code></span>
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ formatTimeAgo(stats.activeIndex.completedAt) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Avg. {{ stats.retrieval.averageTimeMs.toFixed(0) }}ms</span>
        </div>
      </div>

      <!-- Language distribution -->
      <div v-if="stats.languages.length > 0" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Languages</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="lang in stats.languages.slice(0, 8)"
            :key="lang.language"
            class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
          >
            {{ lang.language }} ({{ lang.count }})
          </span>
          <span
            v-if="stats.languages.length > 8"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            +{{ stats.languages.length - 8 }} more
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface RagStats {
  totalChunks: number
  totalFiles: number
  totalIndexes: number
  activeIndex: {
    id: string
    commitSha: string
    status: string
    completedAt: string | null
    cost: number
    totalTokens: number
    branch: string
  } | null
  retrieval: {
    totalRetrievals: number
    averageScore: number
    averageTimeMs: number
    totalCost: number
  }
  languages: { language: string; count: number }[]
  chunkTypes: { chunkType: string; count: number }[]
}

interface Props {
  stats: RagStats | null
  loading?: boolean
  error?: string | null
}

withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
})

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return 'Never'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
</script>
