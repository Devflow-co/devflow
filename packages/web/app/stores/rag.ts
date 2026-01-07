import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// TypeScript interfaces
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

interface IndexStatus {
  status: 'PENDING' | 'INDEXING' | 'COMPLETED' | 'FAILED' | null
  progress?: number
  totalFiles?: number
  processedFiles?: number
  error?: string
  indexId?: string
}

interface PaginatedChunks {
  items: DocumentChunk[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface SearchOptions {
  retrieverType?: 'semantic' | 'hybrid'
  topK?: number
  scoreThreshold?: number
  filter?: {
    language?: string
    chunkType?: string
    filePaths?: string[]
  }
}

interface BrowseOptions {
  page?: number
  limit?: number
  language?: string
  chunkType?: string
  filePath?: string
  search?: string
}

// Cache the API base URL
let cachedApiBase: string | null = null

const getApiBase = (): string => {
  if (cachedApiBase) {
    return cachedApiBase
  }

  const defaultUrl = 'http://localhost:3001/api/v1'

  if (import.meta.client) {
    try {
      const config = useRuntimeConfig()
      cachedApiBase = String(config.public.apiBase || defaultUrl)
    } catch {
      cachedApiBase = defaultUrl
    }
  } else {
    cachedApiBase = defaultUrl
  }

  return cachedApiBase
}

export const useRagStore = defineStore('rag', () => {
  // State
  const stats = ref<RagStats | null>(null)
  const statsLoading = ref(false)
  const statsError = ref<string | null>(null)

  const searchResults = ref<RetrievalResult[]>([])
  const searchLoading = ref(false)
  const searchError = ref<string | null>(null)
  const searchQuery = ref('')
  const retrieverType = ref<'semantic' | 'hybrid'>('semantic')

  const chunks = ref<DocumentChunk[]>([])
  const chunksLoading = ref(false)
  const chunksError = ref<string | null>(null)
  const chunksPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const chunksFilter = ref<{ language?: string; chunkType?: string; filePath?: string }>({})

  const indexStatus = ref<IndexStatus | null>(null)
  const indexStatusLoading = ref(false)
  const indexingInProgress = ref(false)
  const reindexLoading = ref(false)
  const reindexError = ref<string | null>(null)

  // Computed
  const hasIndex = computed(() => stats.value?.activeIndex !== null)
  const hasResults = computed(() => searchResults.value.length > 0)
  const hasChunks = computed(() => chunks.value.length > 0)

  // API helper
  const apiFetch = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const apiBase = getApiBase()
    const url = `${apiBase}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Actions
  const fetchStats = async (projectId: string) => {
    try {
      statsLoading.value = true
      statsError.value = null
      stats.value = await apiFetch<RagStats>(`/projects/${projectId}/rag/stats`)
    } catch (e: unknown) {
      statsError.value = (e as Error).message || 'Failed to fetch RAG stats'
      throw e
    } finally {
      statsLoading.value = false
    }
  }

  const search = async (projectId: string, query: string, options: SearchOptions = {}) => {
    try {
      searchLoading.value = true
      searchError.value = null
      searchQuery.value = query

      const body = {
        query,
        retrieverType: options.retrieverType || retrieverType.value,
        topK: options.topK || 10,
        scoreThreshold: options.scoreThreshold,
        filter: options.filter,
      }

      searchResults.value = await apiFetch<RetrievalResult[]>(
        `/projects/${projectId}/rag/search`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      )
    } catch (e: unknown) {
      searchError.value = (e as Error).message || 'Search failed'
      throw e
    } finally {
      searchLoading.value = false
    }
  }

  const fetchChunks = async (projectId: string, options: BrowseOptions = {}) => {
    try {
      chunksLoading.value = true
      chunksError.value = null

      // Build query string
      const params = new URLSearchParams()
      if (options.page) params.set('page', String(options.page))
      if (options.limit) params.set('limit', String(options.limit))
      if (options.language) params.set('language', options.language)
      if (options.chunkType) params.set('chunkType', options.chunkType)
      if (options.filePath) params.set('filePath', options.filePath)
      if (options.search) params.set('search', options.search)

      const queryString = params.toString()
      const endpoint = `/projects/${projectId}/rag/chunks${queryString ? `?${queryString}` : ''}`

      const response = await apiFetch<PaginatedChunks>(endpoint)
      chunks.value = response.items
      chunksPagination.value = response.pagination

      // Update filter state
      chunksFilter.value = {
        language: options.language,
        chunkType: options.chunkType,
        filePath: options.filePath,
      }
    } catch (e: unknown) {
      chunksError.value = (e as Error).message || 'Failed to fetch chunks'
      throw e
    } finally {
      chunksLoading.value = false
    }
  }

  const triggerReindex = async (projectId: string, options: { branch?: string; force?: boolean } = {}) => {
    try {
      reindexLoading.value = true
      reindexError.value = null

      const response = await apiFetch<{ indexId: string; message: string }>(
        `/projects/${projectId}/rag/reindex`,
        {
          method: 'POST',
          body: JSON.stringify(options),
        }
      )

      indexingInProgress.value = true
      return response
    } catch (e: unknown) {
      reindexError.value = (e as Error).message || 'Failed to trigger re-indexing'
      throw e
    } finally {
      reindexLoading.value = false
    }
  }

  const fetchIndexStatus = async (projectId: string) => {
    try {
      indexStatusLoading.value = true
      indexStatus.value = await apiFetch<IndexStatus>(`/projects/${projectId}/rag/index-status`)

      // Update indexingInProgress based on status
      indexingInProgress.value = indexStatus.value.status === 'PENDING' || indexStatus.value.status === 'INDEXING'
    } catch (e: unknown) {
      console.error('Failed to fetch index status:', e)
    } finally {
      indexStatusLoading.value = false
    }
  }

  // Poll index status while indexing is in progress
  let pollingInterval: ReturnType<typeof setInterval> | null = null

  const startPollingIndexStatus = (projectId: string, intervalMs = 3000) => {
    stopPollingIndexStatus()
    pollingInterval = setInterval(async () => {
      await fetchIndexStatus(projectId)
      if (!indexingInProgress.value) {
        stopPollingIndexStatus()
        // Refresh stats after indexing completes
        await fetchStats(projectId)
      }
    }, intervalMs)
  }

  const stopPollingIndexStatus = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
  }

  const setRetrieverType = (type: 'semantic' | 'hybrid') => {
    retrieverType.value = type
  }

  const clearSearch = () => {
    searchResults.value = []
    searchQuery.value = ''
    searchError.value = null
  }

  const reset = () => {
    stats.value = null
    statsError.value = null
    searchResults.value = []
    searchQuery.value = ''
    searchError.value = null
    chunks.value = []
    chunksError.value = null
    chunksPagination.value = { page: 1, limit: 20, total: 0, totalPages: 0 }
    chunksFilter.value = {}
    indexStatus.value = null
    indexingInProgress.value = false
    reindexError.value = null
    stopPollingIndexStatus()
  }

  return {
    // State
    stats,
    statsLoading,
    statsError,
    searchResults,
    searchLoading,
    searchError,
    searchQuery,
    retrieverType,
    chunks,
    chunksLoading,
    chunksError,
    chunksPagination,
    chunksFilter,
    indexStatus,
    indexStatusLoading,
    indexingInProgress,
    reindexLoading,
    reindexError,

    // Computed
    hasIndex,
    hasResults,
    hasChunks,

    // Actions
    fetchStats,
    search,
    fetchChunks,
    triggerReindex,
    fetchIndexStatus,
    startPollingIndexStatus,
    stopPollingIndexStatus,
    setRetrieverType,
    clearSearch,
    reset,
  }
})
