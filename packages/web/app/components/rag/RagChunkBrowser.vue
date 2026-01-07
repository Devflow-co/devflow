<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <!-- Header -->
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Chunk Browser</h3>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <!-- Language filter -->
      <select
        v-model="localFilters.language"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        @change="handleFilterChange"
      >
        <option value="">All Languages</option>
        <option v-for="lang in availableLanguages" :key="lang" :value="lang">
          {{ lang }}
        </option>
      </select>

      <!-- Chunk type filter -->
      <select
        v-model="localFilters.chunkType"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        @change="handleFilterChange"
      >
        <option value="">All Types</option>
        <option value="function">Function</option>
        <option value="class">Class</option>
        <option value="module">Module</option>
        <option value="comment">Comment</option>
        <option value="import">Import</option>
      </select>

      <!-- File path filter -->
      <input
        v-model="localFilters.filePath"
        type="text"
        placeholder="Filter by path..."
        class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 w-48"
        @input="debouncedFilterChange"
      />

      <!-- Clear filters -->
      <button
        v-if="hasActiveFilters"
        type="button"
        class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        @click="clearFilters"
      >
        Clear filters
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="chunks.length === 0" class="text-center py-12">
      <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <p class="text-gray-500 dark:text-gray-400">
        {{ hasActiveFilters ? 'No chunks match the filters' : 'No chunks indexed yet' }}
      </p>
    </div>

    <!-- Chunks list -->
    <div v-else class="space-y-2">
      <RagChunkCard
        v-for="chunk in chunks"
        :key="chunk.id"
        :chunk="chunk"
      />
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="mt-6 flex items-center justify-between">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Showing {{ (pagination.page - 1) * pagination.limit + 1 }} - {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }}
      </p>

      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="pagination.page === 1"
          class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="handlePageChange(pagination.page - 1)"
        >
          Previous
        </button>

        <div class="flex items-center gap-1">
          <button
            v-for="page in visiblePages"
            :key="page"
            type="button"
            :class="[
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              page === pagination.page
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            ]"
            @click="handlePageChange(page)"
          >
            {{ page }}
          </button>
        </div>

        <button
          type="button"
          :disabled="pagination.page === pagination.totalPages"
          class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="handlePageChange(pagination.page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

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

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ChunksFilter {
  language?: string
  chunkType?: string
  filePath?: string
}

interface Props {
  chunks: DocumentChunk[]
  pagination: Pagination
  filters?: ChunksFilter
  loading?: boolean
  error?: string | null
  availableLanguages?: string[]
}

interface Emits {
  (e: 'page-change', page: number): void
  (e: 'filter-change', filters: ChunksFilter): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  filters: () => ({}),
  availableLanguages: () => ['typescript', 'javascript', 'python', 'go', 'rust', 'java'],
})

const emit = defineEmits<Emits>()

const localFilters = ref<ChunksFilter>({ ...props.filters })

// Sync props to local state
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters }
}, { deep: true })

const hasActiveFilters = computed(() => {
  return !!(localFilters.value.language || localFilters.value.chunkType || localFilters.value.filePath)
})

// Debounce for text input
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debouncedFilterChange = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    handleFilterChange()
  }, 300)
}

const handleFilterChange = () => {
  emit('filter-change', { ...localFilters.value })
}

const clearFilters = () => {
  localFilters.value = {}
  emit('filter-change', {})
}

const handlePageChange = (page: number) => {
  emit('page-change', page)
}

// Calculate visible page numbers
const visiblePages = computed(() => {
  const current = props.pagination.page
  const total = props.pagination.totalPages
  const pages: number[] = []

  if (total <= 5) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    if (current <= 3) {
      pages.push(1, 2, 3, 4, 5)
    } else if (current >= total - 2) {
      pages.push(total - 4, total - 3, total - 2, total - 1, total)
    } else {
      pages.push(current - 2, current - 1, current, current + 1, current + 2)
    }
  }

  return pages
})
</script>
