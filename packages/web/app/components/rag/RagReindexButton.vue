<template>
  <div class="flex items-center gap-2">
    <!-- Reindex button -->
    <button
      type="button"
      :disabled="loading || indexingInProgress"
      :class="[
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
        indexingInProgress
          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
          : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
      ]"
      @click="handleReindex"
    >
      <!-- Loading spinner -->
      <svg
        v-if="loading"
        class="animate-spin h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>

      <!-- Progress indicator -->
      <svg
        v-else-if="indexingInProgress"
        class="animate-spin h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>

      <!-- Default icon -->
      <svg
        v-else
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>

      <span>
        {{ indexingInProgress ? `Indexing${progress ? ` (${progress}%)` : '...'}` : (hasIndex ? 'Reindex Now' : 'Index Codebase') }}
      </span>
    </button>

    <!-- Force reindex option -->
    <button
      v-if="hasIndex && !indexingInProgress"
      type="button"
      :disabled="loading"
      class="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
      title="Force re-index even if up to date"
      @click="handleForceReindex"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>Force</span>
    </button>
  </div>

  <!-- Error message -->
  <p v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">
    {{ error }}
  </p>
</template>

<script setup lang="ts">
interface Props {
  loading?: boolean
  indexingInProgress?: boolean
  progress?: number
  error?: string | null
  hasIndex?: boolean
}

interface Emits {
  (e: 'reindex', force: boolean): void
}

withDefaults(defineProps<Props>(), {
  loading: false,
  indexingInProgress: false,
  progress: undefined,
  error: null,
  hasIndex: false,
})

const emit = defineEmits<Emits>()

const handleReindex = () => {
  emit('reindex', false)
}

const handleForceReindex = () => {
  emit('reindex', true)
}
</script>
