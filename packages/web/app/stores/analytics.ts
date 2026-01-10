import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// TypeScript interfaces matching backend DTOs
export interface AnalyticsSummary {
  totalCost: number
  totalTokens: number
  totalWorkflows: number
  successRate: number
  avgWorkflowDuration: number
  projectCount?: number
  taskCount?: number
}

export interface QuotaStatus {
  used: number
  limit: number
  percent: number
}

export interface AnalyticsQuotas {
  tokens: QuotaStatus
  cost: QuotaStatus
}

export interface CostTrendDataPoint {
  date: string
  inputCost: number
  outputCost: number
  otherCost: number
  total: number
}

export interface ModelUsageItem {
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  calls: number
  percentOfTotal: number
}

export interface PhaseStats {
  phase: string
  count: number
  successRate: number
  avgDuration: number
}

export interface FailureAnalysisItem {
  stepName: string
  phase: string
  count: number
  lastError?: string
}

export interface WorkflowsByStatus {
  completed: number
  failed: number
  running: number
  pending: number
  cancelled: number
}

export interface WorkflowAnalytics {
  total: number
  byStatus: WorkflowsByStatus
  byPhase: PhaseStats[]
  failureAnalysis: FailureAnalysisItem[]
  throughputPerDay: number
}

export interface TopConsumerItem {
  resourceId: string
  resourceType: string
  projectName?: string
  taskTitle?: string
  cost: number
}

export interface RecentActivityItem {
  workflowId: string
  taskTitle: string
  projectName: string
  status: string
  phase?: string
  startedAt: string
  duration?: number
  cost?: number
}

export interface OrganizationAnalytics {
  period: {
    start: string
    end: string
  }
  summary: AnalyticsSummary
  quotas: AnalyticsQuotas
  costTrend: CostTrendDataPoint[]
  modelUsage: ModelUsageItem[]
  workflows: WorkflowAnalytics
  topConsumers: TopConsumerItem[]
}

export interface ProjectAnalytics {
  project: {
    id: string
    name: string
    repository?: string
  }
  period: {
    start: string
    end: string
  }
  summary: AnalyticsSummary
  costTrend: CostTrendDataPoint[]
  modelUsage: ModelUsageItem[]
  workflows: WorkflowAnalytics
  recentActivity: RecentActivityItem[]
}

export interface DateRange {
  start: Date
  end: Date
}

// ============================================
// P1 & P2 - Performance Analytics Types
// ============================================

export interface ModelLatencyItem {
  model: string
  provider: string
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  minLatencyMs: number
  maxLatencyMs: number
  requestCount: number
}

export interface PhaseCostItem {
  phase: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  requestCount: number
  percentOfTotal: number
}

export interface CacheMetrics {
  totalRequests: number
  cachedRequests: number
  cacheHitRate: number
  estimatedSavings: number
  byModel: Array<{
    model: string
    totalRequests: number
    cachedRequests: number
    cacheHitRate: number
  }>
}

export interface TopExpensiveTaskItem {
  taskId: string
  taskTitle?: string
  projectName?: string
  linearIdentifier?: string
  totalCost: number
  totalTokens: number
  workflowCount: number
  phases: string[]
}

export interface UsageForecast {
  dailyAverageCost: number
  dailyAverageTokens: number
  projectedMonthlyCost: number
  projectedMonthlyTokens: number
  daysUntilCostQuotaExhausted: number | null
  daysUntilTokenQuotaExhausted: number | null
  trend: 'increasing' | 'stable' | 'decreasing'
  trendPercentage: number
}

export interface CostByOutcome {
  successful: {
    count: number
    totalCost: number
    avgCost: number
  }
  failed: {
    count: number
    totalCost: number
    avgCost: number
  }
  costEfficiency: number
}

export interface PerformanceAnalytics {
  period: {
    start: string
    end: string
  }
  modelLatency: ModelLatencyItem[]
  phaseCosts: PhaseCostItem[]
  cacheMetrics: CacheMetrics
  topExpensiveTasks: TopExpensiveTaskItem[]
  usageForecast: UsageForecast
  costByOutcome: CostByOutcome
}

// API base URL helper
let cachedApiBase: string | null = null

const getApiBase = (): string => {
  if (cachedApiBase) {
    return cachedApiBase
  }

  const defaultUrl = 'http://localhost:3001/api/v1'

  if (import.meta.client) {
    try {
      const config = useRuntimeConfig()
      cachedApiBase = (config.public?.apiBase as string) || defaultUrl
    } catch {
      cachedApiBase = defaultUrl
    }
  } else {
    cachedApiBase = defaultUrl
  }

  return cachedApiBase
}

export const useAnalyticsStore = defineStore('analytics', () => {
  // State
  const organizationAnalytics = ref<OrganizationAnalytics | null>(null)
  const projectAnalytics = ref<Map<string, ProjectAnalytics>>(new Map())
  const performanceAnalytics = ref<PerformanceAnalytics | null>(null)
  const loading = ref(false)
  const performanceLoading = ref(false)
  const error = ref<string | null>(null)

  // Date range (default: 90 days)
  const dateRange = ref<DateRange>({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    end: new Date()
  })

  // Computed
  const hasData = computed(() => organizationAnalytics.value !== null)

  const isOverQuota = computed(() => {
    if (!organizationAnalytics.value?.quotas) return false
    return (
      organizationAnalytics.value.quotas.tokens.percent > 100 ||
      organizationAnalytics.value.quotas.cost.percent > 100
    )
  })

  const quotaWarning = computed(() => {
    if (!organizationAnalytics.value?.quotas) return null
    const { tokens, cost } = organizationAnalytics.value.quotas
    if (tokens.percent >= 90 || cost.percent >= 90) {
      return 'warning'
    }
    if (tokens.percent >= 70 || cost.percent >= 70) {
      return 'caution'
    }
    return null
  })

  // Actions
  async function fetchOrganizationAnalytics(): Promise<OrganizationAnalytics> {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        startDate: dateRange.value.start.toISOString(),
        endDate: dateRange.value.end.toISOString()
      })

      const response = await fetch(
        `${getApiBase()}/analytics/organization?${params}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      organizationAnalytics.value = data
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch analytics'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchProjectAnalytics(projectId: string): Promise<ProjectAnalytics> {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        startDate: dateRange.value.start.toISOString(),
        endDate: dateRange.value.end.toISOString()
      })

      const response = await fetch(
        `${getApiBase()}/analytics/projects/${projectId}?${params}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      projectAnalytics.value.set(projectId, data)
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch project analytics'
      throw e
    } finally {
      loading.value = false
    }
  }

  function getProjectAnalytics(projectId: string): ProjectAnalytics | undefined {
    return projectAnalytics.value.get(projectId)
  }

  async function fetchPerformanceAnalytics(): Promise<PerformanceAnalytics> {
    performanceLoading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        startDate: dateRange.value.start.toISOString(),
        endDate: dateRange.value.end.toISOString()
      })

      const response = await fetch(
        `${getApiBase()}/analytics/performance?${params}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      performanceAnalytics.value = data
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch performance analytics'
      throw e
    } finally {
      performanceLoading.value = false
    }
  }

  function setDateRange(start: Date, end: Date) {
    dateRange.value = { start, end }
    // Clear cache when date range changes
    organizationAnalytics.value = null
    projectAnalytics.value.clear()
  }

  function setPresetDateRange(preset: '7d' | '30d' | '90d' | 'ytd') {
    const now = new Date()
    let start: Date

    switch (preset) {
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1)
        break
    }

    setDateRange(start, now)
  }

  function clearCache() {
    organizationAnalytics.value = null
    projectAnalytics.value.clear()
    performanceAnalytics.value = null
    error.value = null
  }

  // Format helpers
  function formatCost(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  function formatTokens(value: number): string {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`
    }
    return value.toString()
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  function formatPhase(phase: string): string {
    const phaseNames: Record<string, string> = {
      refinement: 'Refinement',
      user_story: 'User Story',
      technical_plan: 'Technical Plan'
    }
    return phaseNames[phase] || phase
  }

  return {
    // State
    organizationAnalytics,
    projectAnalytics,
    performanceAnalytics,
    loading,
    performanceLoading,
    error,
    dateRange,

    // Computed
    hasData,
    isOverQuota,
    quotaWarning,

    // Actions
    fetchOrganizationAnalytics,
    fetchProjectAnalytics,
    fetchPerformanceAnalytics,
    getProjectAnalytics,
    setDateRange,
    setPresetDateRange,
    clearCache,

    // Formatters
    formatCost,
    formatTokens,
    formatDuration,
    formatPhase
  }
})
