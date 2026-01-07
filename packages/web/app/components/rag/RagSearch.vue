<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <!-- Header with toggle -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Semantic Search</h3>
      <RagRetrieverToggle v-model="localRetrieverType" />
    </div>

    <!-- Search input -->
    <div class="flex gap-2 mb-6">
      <div class="flex-1 relative">
        <input
          v-model="localQuery"
          type="text"
          placeholder="Search your codebase..."
          class="w-full px-4 py-2.5 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          @keydown.enter="handleSearch"
        />
        <svg
          v-if="!loading"
          class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <svg
          v-else
          class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <button
        type="button"
        :disabled="!localQuery.trim() || loading"
        class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleSearch"
      >
        Search
      </button>
    </div>

    <!-- Error message -->
    <div
      v-if="error"
      class="mb-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Results -->
    <div v-if="results.length > 0">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ results.length }} result{{ results.length === 1 ? '' : 's' }}
          <span v-if="searchQuery" class="text-gray-500">for "{{ searchQuery }}"</span>
        </p>
        <button
          v-if="results.length > 0"
          type="button"
          class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          @click="handleClear"
        >
          Clear
        </button>
      </div>

      <div class="space-y-4">
        <RagSearchResult
          v-for="result in results"
          :key="result.chunkId"
          :result="result"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="searchQuery && !loading" class="text-center py-8">
      <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-500 dark:text-gray-400">No results found</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Try a different query or switch retriever type</p>
    </div>

    <!-- Initial state -->
    <div v-else-if="!loading" class="text-center py-8">
      <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p class="text-gray-500 dark:text-gray-400">Enter a query to search your codebase</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
        {{ localRetrieverType === 'semantic' ? 'Using vector-based semantic search' : 'Using hybrid semantic + keyword search' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

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
  results: RetrievalResult[]
  loading?: boolean
  error?: string | null
  searchQuery?: string
  retrieverType?: 'semantic' | 'hybrid'
}

interface Emits {
  (e: 'search', query: string, retrieverType: 'semantic' | 'hybrid'): void
  (e: 'clear'): void
  (e: 'update:retrieverType', value: 'semantic' | 'hybrid'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  searchQuery: '',
  retrieverType: 'semantic',
})

const emit = defineEmits<Emits>()

const localQuery = ref('')
const localRetrieverType = ref<'semantic' | 'hybrid'>(props.retrieverType)

// Sync retrieverType prop with local state
watch(() => props.retrieverType, (newVal) => {
  localRetrieverType.value = newVal
})

watch(localRetrieverType, (newVal) => {
  emit('update:retrieverType', newVal)
})

const handleSearch = () => {
  if (localQuery.value.trim()) {
    emit('search', localQuery.value.trim(), localRetrieverType.value)
  }
}

const handleClear = () => {
  localQuery.value = ''
  emit('clear')
}
</script>
