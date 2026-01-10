/**
 * Analytics Response DTOs
 */

export interface AnalyticsSummary {
  totalCost: number;
  totalTokens: number;
  totalWorkflows: number;
  successRate: number;
  avgWorkflowDuration: number;
  projectCount?: number;
  taskCount?: number;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  percent: number;
}

export interface AnalyticsQuotas {
  tokens: QuotaStatus;
  cost: QuotaStatus;
}

export interface CostTrendDataPoint {
  date: string;
  inputCost: number;
  outputCost: number;
  otherCost: number;
  total: number;
}

export interface ModelUsageItem {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  calls: number;
  percentOfTotal: number;
}

export interface PhaseStats {
  phase: string;
  count: number;
  successRate: number;
  avgDuration: number;
}

export interface FailureAnalysisItem {
  stepName: string;
  phase: string;
  count: number;
  lastError?: string;
}

export interface WorkflowsByStatus {
  completed: number;
  failed: number;
  running: number;
  pending: number;
  cancelled: number;
}

export interface WorkflowAnalytics {
  total: number;
  byStatus: WorkflowsByStatus;
  byPhase: PhaseStats[];
  failureAnalysis: FailureAnalysisItem[];
  throughputPerDay: number;
}

export interface TopConsumerItem {
  resourceId: string;
  resourceType: string;
  projectName?: string;
  taskTitle?: string;
  cost: number;
}

export interface RecentActivityItem {
  workflowId: string;
  taskTitle: string;
  projectName: string;
  status: string;
  phase?: string;
  startedAt: string;
  duration?: number;
  cost?: number;
}

export interface OrganizationAnalyticsResponse {
  period: {
    start: string;
    end: string;
  };
  summary: AnalyticsSummary;
  quotas: AnalyticsQuotas;
  costTrend: CostTrendDataPoint[];
  modelUsage: ModelUsageItem[];
  workflows: WorkflowAnalytics;
  topConsumers: TopConsumerItem[];
}

export interface ProjectAnalyticsResponse {
  project: {
    id: string;
    name: string;
    repository?: string;
  };
  period: {
    start: string;
    end: string;
  };
  summary: AnalyticsSummary;
  costTrend: CostTrendDataPoint[];
  modelUsage: ModelUsageItem[];
  workflows: WorkflowAnalytics;
  recentActivity: RecentActivityItem[];
}

// ============================================
// P1 & P2 - New Performance & Insights Metrics
// ============================================

/**
 * Model latency statistics
 */
export interface ModelLatencyItem {
  model: string;
  provider: string;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  requestCount: number;
}

/**
 * Phase cost breakdown (refinement, user_story, technical_plan)
 */
export interface PhaseCostItem {
  phase: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requestCount: number;
  percentOfTotal: number;
}

/**
 * Cache effectiveness metrics
 */
export interface CacheMetrics {
  totalRequests: number;
  cachedRequests: number;
  cacheHitRate: number;
  estimatedSavings: number;
  byModel: Array<{
    model: string;
    totalRequests: number;
    cachedRequests: number;
    cacheHitRate: number;
  }>;
}

/**
 * Top expensive tasks
 */
export interface TopExpensiveTaskItem {
  taskId: string;
  taskTitle?: string;
  projectName?: string;
  linearIdentifier?: string;
  totalCost: number;
  totalTokens: number;
  workflowCount: number;
  phases: string[];
}

/**
 * Usage forecast
 */
export interface UsageForecast {
  dailyAverageCost: number;
  dailyAverageTokens: number;
  projectedMonthlyCost: number;
  projectedMonthlyTokens: number;
  daysUntilCostQuotaExhausted: number | null;
  daysUntilTokenQuotaExhausted: number | null;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercentage: number;
}

/**
 * Cost per workflow outcome
 */
export interface CostByOutcome {
  successful: {
    count: number;
    totalCost: number;
    avgCost: number;
  };
  failed: {
    count: number;
    totalCost: number;
    avgCost: number;
  };
  costEfficiency: number; // % of cost going to successful workflows
}

/**
 * Performance analytics response (new endpoint)
 */
export interface PerformanceAnalyticsResponse {
  period: {
    start: string;
    end: string;
  };
  modelLatency: ModelLatencyItem[];
  phaseCosts: PhaseCostItem[];
  cacheMetrics: CacheMetrics;
  topExpensiveTasks: TopExpensiveTaskItem[];
  usageForecast: UsageForecast;
  costByOutcome: CostByOutcome;
}
