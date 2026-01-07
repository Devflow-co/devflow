<template>
  <div class="space-y-6">
    <!-- Stats section with reindex button -->
    <RagStats
      :stats="ragStore.stats"
      :loading="ragStore.statsLoading"
      :error="ragStore.statsError"
    >
      <template #actions>
        <RagReindexButton
          :loading="ragStore.reindexLoading"
          :indexing-in-progress="ragStore.indexingInProgress"
          :progress="ragStore.indexStatus?.progress"
          :error="ragStore.reindexError"
          :has-index="ragStore.hasIndex"
          @reindex="handleReindex"
        />
      </template>
    </RagStats>

    <!-- Search section -->
    <RagSearch
      :results="ragStore.searchResults"
      :loading="ragStore.searchLoading"
      :error="ragStore.searchError"
      :search-query="ragStore.searchQuery"
      :retriever-type="ragStore.retrieverType"
      @search="handleSearch"
      @clear="handleClearSearch"
      @update:retriever-type="handleRetrieverTypeChange"
    />

    <!-- Chunk browser section -->
    <RagChunkBrowser
      :chunks="ragStore.chunks"
      :pagination="ragStore.chunksPagination"
      :filters="ragStore.chunksFilter"
      :loading="ragStore.chunksLoading"
      :error="ragStore.chunksError"
      :available-languages="availableLanguages"
      @page-change="handlePageChange"
      @filter-change="handleFilterChange"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRagStore } from '@/stores/rag'

interface Props {
  projectId: string
}

const props = defineProps<Props>()
const ragStore = useRagStore()

// Available languages from stats
const availableLanguages = computed(() => {
  return ragStore.stats?.languages.map(l => l.language) || []
})

// Load initial data
onMounted(async () => {
  await Promise.all([
    ragStore.fetchStats(props.projectId),
    ragStore.fetchChunks(props.projectId),
    ragStore.fetchIndexStatus(props.projectId),
  ])

  // Start polling if indexing is in progress
  if (ragStore.indexingInProgress) {
    ragStore.startPollingIndexStatus(props.projectId)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  ragStore.stopPollingIndexStatus()
  ragStore.reset()
})

// Handlers
const handleReindex = async (force: boolean) => {
  try {
    await ragStore.triggerReindex(props.projectId, { force })
    // Start polling for status updates
    ragStore.startPollingIndexStatus(props.projectId)
  } catch (error) {
    console.error('Failed to trigger reindex:', error)
  }
}

const handleSearch = async (query: string, retrieverType: 'semantic' | 'hybrid') => {
  try {
    await ragStore.search(props.projectId, query, { retrieverType })
  } catch (error) {
    console.error('Search failed:', error)
  }
}

const handleClearSearch = () => {
  ragStore.clearSearch()
}

const handleRetrieverTypeChange = (type: 'semantic' | 'hybrid') => {
  ragStore.setRetrieverType(type)
}

const handlePageChange = async (page: number) => {
  try {
    await ragStore.fetchChunks(props.projectId, {
      page,
      ...ragStore.chunksFilter,
    })
  } catch (error) {
    console.error('Failed to fetch chunks:', error)
  }
}

const handleFilterChange = async (filters: { language?: string; chunkType?: string; filePath?: string }) => {
  try {
    await ragStore.fetchChunks(props.projectId, {
      page: 1, // Reset to first page when filters change
      ...filters,
    })
  } catch (error) {
    console.error('Failed to fetch chunks:', error)
  }
}
</script>
