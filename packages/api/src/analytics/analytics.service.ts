import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  OrganizationAnalyticsResponse,
  ProjectAnalyticsResponse,
  PerformanceAnalyticsResponse,
  CostTrendDataPoint,
  ModelUsageItem,
  PhaseStats,
  FailureAnalysisItem,
  TopConsumerItem,
  RecentActivityItem,
  ModelLatencyItem,
  PhaseCostItem,
  CacheMetrics,
  TopExpensiveTaskItem,
  UsageForecast,
  CostByOutcome,
} from './dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get organization analytics for a date range (default: 90 days)
   */
  async getOrganizationAnalytics(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<OrganizationAnalyticsResponse> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

    this.logger.log(`Fetching analytics for org ${organizationId} from ${start} to ${end}`);

    // Get organization with quotas
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        tokenQuota: true,
        costQuota: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Execute all queries in parallel
    const [
      costSummary,
      costTrend,
      modelUsage,
      workflowStats,
      phaseStats,
      failureAnalysis,
      topConsumers,
      projectCount,
    ] = await Promise.all([
      this.getCostSummary(organizationId, start, end),
      this.getCostTrend(organizationId, start, end),
      this.getModelUsage(organizationId, start, end),
      this.getWorkflowStats(organizationId, start, end),
      this.getPhaseStats(organizationId, start, end),
      this.getFailureAnalysis(organizationId, start, end),
      this.getTopConsumers(organizationId, start, end),
      this.getProjectCount(organizationId),
    ]);

    // Calculate quotas
    const tokenUsed = costSummary.totalTokens;
    const costUsed = costSummary.totalCost;

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        totalCost: costSummary.totalCost,
        totalTokens: costSummary.totalTokens,
        totalWorkflows: workflowStats.total,
        successRate: workflowStats.successRate,
        avgWorkflowDuration: workflowStats.avgDuration,
        projectCount,
      },
      quotas: {
        tokens: {
          used: tokenUsed,
          limit: org.tokenQuota,
          percent: org.tokenQuota > 0 ? Math.round((tokenUsed / org.tokenQuota) * 100) : 0,
        },
        cost: {
          used: costUsed,
          limit: org.costQuota,
          percent: org.costQuota > 0 ? Math.round((costUsed / org.costQuota) * 100) : 0,
        },
      },
      costTrend,
      modelUsage,
      workflows: {
        total: workflowStats.total,
        byStatus: workflowStats.byStatus,
        byPhase: phaseStats,
        failureAnalysis,
        throughputPerDay: workflowStats.throughputPerDay,
      },
      topConsumers,
    };
  }

  /**
   * Get project-specific analytics
   */
  async getProjectAnalytics(
    projectId: string,
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ProjectAnalyticsResponse> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Verify project belongs to organization
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizations: {
          some: { organizationId },
        },
      },
      select: {
        id: true,
        name: true,
        repository: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found or not accessible');
    }

    const [
      costSummary,
      costTrend,
      modelUsage,
      workflowStats,
      phaseStats,
      failureAnalysis,
      recentActivity,
    ] = await Promise.all([
      this.getProjectCostSummary(projectId, start, end),
      this.getProjectCostTrend(projectId, start, end),
      this.getProjectModelUsage(projectId, start, end),
      this.getProjectWorkflowStats(projectId, start, end),
      this.getProjectPhaseStats(projectId, start, end),
      this.getProjectFailureAnalysis(projectId, start, end),
      this.getRecentActivity(projectId, 10),
    ]);

    return {
      project: {
        id: project.id,
        name: project.name,
        repository: project.repository || undefined,
      },
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        totalCost: costSummary.totalCost,
        totalTokens: costSummary.totalTokens,
        totalWorkflows: workflowStats.total,
        successRate: workflowStats.successRate,
        avgWorkflowDuration: workflowStats.avgDuration,
        taskCount: workflowStats.taskCount,
      },
      costTrend,
      modelUsage,
      workflows: {
        total: workflowStats.total,
        byStatus: workflowStats.byStatus,
        byPhase: phaseStats,
        failureAnalysis,
        throughputPerDay: workflowStats.throughputPerDay,
      },
      recentActivity,
    };
  }

  // ============================================
  // Organization-level queries
  // ============================================

  private async getCostSummary(orgId: string, start: Date, end: Date) {
    const result = await this.prisma.usageRecord.aggregate({
      where: {
        organizationId: orgId,
        periodStart: { gte: start },
        periodEnd: { lte: end },
      },
      _sum: {
        totalCost: true,
        quantity: true,
      },
    });

    // Get token-specific sum
    const tokenResult = await this.prisma.usageRecord.aggregate({
      where: {
        organizationId: orgId,
        periodStart: { gte: start },
        periodEnd: { lte: end },
        type: { in: ['LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT'] },
      },
      _sum: {
        quantity: true,
      },
    });

    return {
      totalCost: result._sum.totalCost || 0,
      totalTokens: tokenResult._sum.quantity || 0,
    };
  }

  private async getCostTrend(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<CostTrendDataPoint[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        date: Date;
        input_cost: number;
        output_cost: number;
        other_cost: number;
        total: number;
      }>
    >`
      SELECT
        DATE(period_start) as date,
        COALESCE(SUM(CASE WHEN type = 'LLM_TOKENS_INPUT' THEN total_cost ELSE 0 END), 0) as input_cost,
        COALESCE(SUM(CASE WHEN type = 'LLM_TOKENS_OUTPUT' THEN total_cost ELSE 0 END), 0) as output_cost,
        COALESCE(SUM(CASE WHEN type NOT IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT') THEN total_cost ELSE 0 END), 0) as other_cost,
        COALESCE(SUM(total_cost), 0) as total
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND period_start >= ${start}
        AND period_end <= ${end}
      GROUP BY DATE(period_start)
      ORDER BY date
    `;

    return result.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      inputCost: Number(r.input_cost),
      outputCost: Number(r.output_cost),
      otherCost: Number(r.other_cost),
      total: Number(r.total),
    }));
  }

  private async getModelUsage(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<ModelUsageItem[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        model: string;
        provider: string;
        input_tokens: number;
        output_tokens: number;
        cost: number;
        calls: bigint;
      }>
    >`
      SELECT
        COALESCE(metadata->>'model', 'unknown') as model,
        COALESCE(metadata->>'provider', 'unknown') as provider,
        COALESCE(SUM(CASE WHEN type = 'LLM_TOKENS_INPUT' THEN quantity ELSE 0 END), 0) as input_tokens,
        COALESCE(SUM(CASE WHEN type = 'LLM_TOKENS_OUTPUT' THEN quantity ELSE 0 END), 0) as output_tokens,
        COALESCE(SUM(total_cost), 0) as cost,
        COUNT(DISTINCT resource_id) as calls
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT')
        AND period_start >= ${start}
        AND period_end <= ${end}
      GROUP BY metadata->>'model', metadata->>'provider'
      ORDER BY cost DESC
    `;

    const totalCost = result.reduce((sum, r) => sum + Number(r.cost), 0);

    return result.map((r) => ({
      model: r.model || 'unknown',
      provider: r.provider || 'unknown',
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.input_tokens) + Number(r.output_tokens),
      cost: Number(r.cost),
      calls: Number(r.calls),
      percentOfTotal: totalCost > 0 ? Math.round((Number(r.cost) / totalCost) * 100) : 0,
    }));
  }

  private async getWorkflowStats(orgId: string, start: Date, end: Date) {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        project: {
          organizations: {
            some: { organizationId: orgId },
          },
        },
        createdAt: { gte: start, lte: end },
      },
      select: {
        status: true,
        duration: true,
      },
    });

    const total = workflows.length;
    const completed = workflows.filter((w) => w.status === 'COMPLETED').length;
    const failed = workflows.filter((w) => w.status === 'FAILED').length;
    const running = workflows.filter((w) => w.status === 'RUNNING').length;
    const pending = workflows.filter((w) => w.status === 'PENDING').length;
    const cancelled = workflows.filter((w) => w.status === 'CANCELLED').length;

    const completedWorkflows = workflows.filter(
      (w) => w.status === 'COMPLETED' && w.duration,
    );
    const avgDuration =
      completedWorkflows.length > 0
        ? completedWorkflows.reduce((sum, w) => sum + (w.duration || 0), 0) /
          completedWorkflows.length
        : 0;

    // Calculate throughput per day
    const daysDiff = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const throughputPerDay = total / daysDiff;

    return {
      total,
      byStatus: { completed, failed, running, pending, cancelled },
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDuration: Math.round(avgDuration),
      throughputPerDay: Math.round(throughputPerDay * 10) / 10,
    };
  }

  private async getPhaseStats(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<PhaseStats[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        phase: string;
        total: bigint;
        completed: bigint;
        avg_duration: number;
      }>
    >`
      SELECT
        wsl.phase,
        COUNT(*) as total,
        COUNT(CASE WHEN wsl.status = 'COMPLETED' THEN 1 END) as completed,
        COALESCE(AVG(wsl.duration), 0) as avg_duration
      FROM workflow_stage_logs wsl
      JOIN workflows w ON wsl.workflow_id = w.id
      JOIN organization_projects op ON w.project_id = op.project_id
      WHERE op.organization_id = ${orgId}
        AND wsl.started_at >= ${start}
        AND wsl.started_at <= ${end}
        AND wsl.phase IS NOT NULL
      GROUP BY wsl.phase
      ORDER BY total DESC
    `;

    return result.map((r) => ({
      phase: r.phase,
      count: Number(r.total),
      successRate:
        Number(r.total) > 0 ? Math.round((Number(r.completed) / Number(r.total)) * 100) : 0,
      avgDuration: Math.round(Number(r.avg_duration)),
    }));
  }

  private async getFailureAnalysis(
    orgId: string,
    start: Date,
    end: Date,
    limit = 10,
  ): Promise<FailureAnalysisItem[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        step_name: string;
        phase: string;
        count: bigint;
        last_error: string | null;
      }>
    >`
      SELECT
        wsl.step_name,
        wsl.phase,
        COUNT(*) as count,
        MAX(wsl.error) as last_error
      FROM workflow_stage_logs wsl
      JOIN workflows w ON wsl.workflow_id = w.id
      JOIN organization_projects op ON w.project_id = op.project_id
      WHERE op.organization_id = ${orgId}
        AND wsl.status = 'FAILED'
        AND wsl.started_at >= ${start}
        AND wsl.started_at <= ${end}
      GROUP BY wsl.step_name, wsl.phase
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    return result.map((r) => ({
      stepName: r.step_name || 'Unknown',
      phase: r.phase || 'Unknown',
      count: Number(r.count),
      lastError: r.last_error || undefined,
    }));
  }

  private async getTopConsumers(
    orgId: string,
    start: Date,
    end: Date,
    limit = 10,
  ): Promise<TopConsumerItem[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        resource_id: string;
        resource_type: string;
        cost: number;
      }>
    >`
      SELECT
        resource_id,
        resource_type,
        SUM(total_cost) as cost
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND resource_id IS NOT NULL
        AND period_start >= ${start}
        AND period_end <= ${end}
      GROUP BY resource_id, resource_type
      ORDER BY cost DESC
      LIMIT ${limit}
    `;

    // Enrich with project/task names
    const enriched = await Promise.all(
      result.map(async (r) => {
        let projectName: string | undefined;
        let taskTitle: string | undefined;

        if (r.resource_type === 'workflow' && r.resource_id) {
          const workflow = await this.prisma.workflow.findFirst({
            where: { workflowId: r.resource_id },
            select: {
              project: { select: { name: true } },
              task: { select: { title: true } },
            },
          });
          projectName = workflow?.project?.name;
          taskTitle = workflow?.task?.title;
        }

        return {
          resourceId: r.resource_id,
          resourceType: r.resource_type || 'unknown',
          projectName,
          taskTitle,
          cost: Number(r.cost),
        };
      }),
    );

    return enriched;
  }

  private async getProjectCount(orgId: string): Promise<number> {
    return this.prisma.organizationProject.count({
      where: { organizationId: orgId },
    });
  }

  // ============================================
  // Project-level queries
  // ============================================

  private async getProjectCostSummary(projectId: string, start: Date, end: Date) {
    const result = await this.prisma.$queryRaw<
      Array<{ total_cost: number; total_tokens: number }>
    >`
      SELECT
        COALESCE(SUM(ur.total_cost), 0) as total_cost,
        COALESCE(SUM(CASE WHEN ur.type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT') THEN ur.quantity ELSE 0 END), 0) as total_tokens
      FROM usage_records ur
      JOIN workflows w ON ur.resource_id = w.workflow_id
      WHERE w.project_id = ${projectId}
        AND ur.period_start >= ${start}
        AND ur.period_end <= ${end}
    `;

    return {
      totalCost: Number(result[0]?.total_cost || 0),
      totalTokens: Number(result[0]?.total_tokens || 0),
    };
  }

  private async getProjectCostTrend(
    projectId: string,
    start: Date,
    end: Date,
  ): Promise<CostTrendDataPoint[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        date: Date;
        input_cost: number;
        output_cost: number;
        other_cost: number;
        total: number;
      }>
    >`
      SELECT
        DATE(ur.period_start) as date,
        COALESCE(SUM(CASE WHEN ur.type = 'LLM_TOKENS_INPUT' THEN ur.total_cost ELSE 0 END), 0) as input_cost,
        COALESCE(SUM(CASE WHEN ur.type = 'LLM_TOKENS_OUTPUT' THEN ur.total_cost ELSE 0 END), 0) as output_cost,
        COALESCE(SUM(CASE WHEN ur.type NOT IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT') THEN ur.total_cost ELSE 0 END), 0) as other_cost,
        COALESCE(SUM(ur.total_cost), 0) as total
      FROM usage_records ur
      JOIN workflows w ON ur.resource_id = w.workflow_id
      WHERE w.project_id = ${projectId}
        AND ur.period_start >= ${start}
        AND ur.period_end <= ${end}
      GROUP BY DATE(ur.period_start)
      ORDER BY date
    `;

    return result.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      inputCost: Number(r.input_cost),
      outputCost: Number(r.output_cost),
      otherCost: Number(r.other_cost),
      total: Number(r.total),
    }));
  }

  private async getProjectModelUsage(
    projectId: string,
    start: Date,
    end: Date,
  ): Promise<ModelUsageItem[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        model: string;
        provider: string;
        input_tokens: number;
        output_tokens: number;
        cost: number;
        calls: bigint;
      }>
    >`
      SELECT
        COALESCE(ur.metadata->>'model', 'unknown') as model,
        COALESCE(ur.metadata->>'provider', 'unknown') as provider,
        COALESCE(SUM(CASE WHEN ur.type = 'LLM_TOKENS_INPUT' THEN ur.quantity ELSE 0 END), 0) as input_tokens,
        COALESCE(SUM(CASE WHEN ur.type = 'LLM_TOKENS_OUTPUT' THEN ur.quantity ELSE 0 END), 0) as output_tokens,
        COALESCE(SUM(ur.total_cost), 0) as cost,
        COUNT(DISTINCT ur.resource_id) as calls
      FROM usage_records ur
      JOIN workflows w ON ur.resource_id = w.workflow_id
      WHERE w.project_id = ${projectId}
        AND ur.type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT')
        AND ur.period_start >= ${start}
        AND ur.period_end <= ${end}
      GROUP BY ur.metadata->>'model', ur.metadata->>'provider'
      ORDER BY cost DESC
    `;

    const totalCost = result.reduce((sum, r) => sum + Number(r.cost), 0);

    return result.map((r) => ({
      model: r.model || 'unknown',
      provider: r.provider || 'unknown',
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.input_tokens) + Number(r.output_tokens),
      cost: Number(r.cost),
      calls: Number(r.calls),
      percentOfTotal: totalCost > 0 ? Math.round((Number(r.cost) / totalCost) * 100) : 0,
    }));
  }

  private async getProjectWorkflowStats(projectId: string, start: Date, end: Date) {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        projectId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        status: true,
        duration: true,
      },
    });

    const taskCount = await this.prisma.task.count({
      where: { projectId },
    });

    const total = workflows.length;
    const completed = workflows.filter((w) => w.status === 'COMPLETED').length;
    const failed = workflows.filter((w) => w.status === 'FAILED').length;
    const running = workflows.filter((w) => w.status === 'RUNNING').length;
    const pending = workflows.filter((w) => w.status === 'PENDING').length;
    const cancelled = workflows.filter((w) => w.status === 'CANCELLED').length;

    const completedWorkflows = workflows.filter(
      (w) => w.status === 'COMPLETED' && w.duration,
    );
    const avgDuration =
      completedWorkflows.length > 0
        ? completedWorkflows.reduce((sum, w) => sum + (w.duration || 0), 0) /
          completedWorkflows.length
        : 0;

    const daysDiff = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const throughputPerDay = total / daysDiff;

    return {
      total,
      byStatus: { completed, failed, running, pending, cancelled },
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDuration: Math.round(avgDuration),
      throughputPerDay: Math.round(throughputPerDay * 10) / 10,
      taskCount,
    };
  }

  private async getProjectPhaseStats(
    projectId: string,
    start: Date,
    end: Date,
  ): Promise<PhaseStats[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        phase: string;
        total: bigint;
        completed: bigint;
        avg_duration: number;
      }>
    >`
      SELECT
        wsl.phase,
        COUNT(*) as total,
        COUNT(CASE WHEN wsl.status = 'COMPLETED' THEN 1 END) as completed,
        COALESCE(AVG(wsl.duration), 0) as avg_duration
      FROM workflow_stage_logs wsl
      JOIN workflows w ON wsl.workflow_id = w.id
      WHERE w.project_id = ${projectId}
        AND wsl.started_at >= ${start}
        AND wsl.started_at <= ${end}
        AND wsl.phase IS NOT NULL
      GROUP BY wsl.phase
      ORDER BY total DESC
    `;

    return result.map((r) => ({
      phase: r.phase,
      count: Number(r.total),
      successRate:
        Number(r.total) > 0 ? Math.round((Number(r.completed) / Number(r.total)) * 100) : 0,
      avgDuration: Math.round(Number(r.avg_duration)),
    }));
  }

  private async getProjectFailureAnalysis(
    projectId: string,
    start: Date,
    end: Date,
    limit = 10,
  ): Promise<FailureAnalysisItem[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        step_name: string;
        phase: string;
        count: bigint;
        last_error: string | null;
      }>
    >`
      SELECT
        wsl.step_name,
        wsl.phase,
        COUNT(*) as count,
        MAX(wsl.error) as last_error
      FROM workflow_stage_logs wsl
      JOIN workflows w ON wsl.workflow_id = w.id
      WHERE w.project_id = ${projectId}
        AND wsl.status = 'FAILED'
        AND wsl.started_at >= ${start}
        AND wsl.started_at <= ${end}
      GROUP BY wsl.step_name, wsl.phase
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    return result.map((r) => ({
      stepName: r.step_name || 'Unknown',
      phase: r.phase || 'Unknown',
      count: Number(r.count),
      lastError: r.last_error || undefined,
    }));
  }

  private async getRecentActivity(
    projectId: string,
    limit = 10,
  ): Promise<RecentActivityItem[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        workflowId: true,
        status: true,
        currentPhase: true,
        startedAt: true,
        duration: true,
        task: { select: { title: true } },
        project: { select: { name: true } },
      },
    });

    return workflows.map((w) => ({
      workflowId: w.workflowId,
      taskTitle: w.task?.title || 'Unknown Task',
      projectName: w.project?.name || 'Unknown Project',
      status: w.status,
      phase: w.currentPhase || undefined,
      startedAt: w.startedAt?.toISOString() || '',
      duration: w.duration || undefined,
    }));
  }

  // ============================================
  // P1 & P2 - Performance Analytics
  // ============================================

  /**
   * Get performance analytics (latency, cache, phase costs, forecast)
   */
  async getPerformanceAnalytics(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PerformanceAnalyticsResponse> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

    this.logger.log(`Fetching performance analytics for org ${organizationId}`);

    // Get organization quotas for forecast
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { tokenQuota: true, costQuota: true },
    });

    const [
      modelLatency,
      phaseCosts,
      cacheMetrics,
      topExpensiveTasks,
      costByOutcome,
    ] = await Promise.all([
      this.getModelLatency(organizationId, start, end),
      this.getPhaseCosts(organizationId, start, end),
      this.getCacheMetrics(organizationId, start, end),
      this.getTopExpensiveTasks(organizationId, start, end),
      this.getCostByOutcome(organizationId, start, end),
    ]);

    // Calculate forecast based on recent data
    const usageForecast = await this.calculateUsageForecast(
      organizationId,
      start,
      end,
      org?.tokenQuota || 0,
      org?.costQuota || 0,
    );

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      modelLatency,
      phaseCosts,
      cacheMetrics,
      topExpensiveTasks,
      usageForecast,
      costByOutcome,
    };
  }

  /**
   * P1: Get model latency statistics
   */
  private async getModelLatency(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<ModelLatencyItem[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        model: string;
        provider: string;
        avg_latency: number;
        p50_latency: number;
        p95_latency: number;
        p99_latency: number;
        min_latency: number;
        max_latency: number;
        request_count: bigint;
      }>
    >`
      SELECT
        COALESCE(metadata->>'model', 'unknown') as model,
        COALESCE(metadata->>'provider', 'unknown') as provider,
        ROUND(AVG(CAST(metadata->>'latencyMs' AS FLOAT))) as avg_latency,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY CAST(metadata->>'latencyMs' AS FLOAT))) as p50_latency,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP(ORDER BY CAST(metadata->>'latencyMs' AS FLOAT))) as p95_latency,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP(ORDER BY CAST(metadata->>'latencyMs' AS FLOAT))) as p99_latency,
        MIN(CAST(metadata->>'latencyMs' AS FLOAT)) as min_latency,
        MAX(CAST(metadata->>'latencyMs' AS FLOAT)) as max_latency,
        COUNT(*) as request_count
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND period_start >= ${start}
        AND period_end <= ${end}
        AND type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT')
        AND metadata->>'latencyMs' IS NOT NULL
      GROUP BY metadata->>'model', metadata->>'provider'
      ORDER BY avg_latency ASC
    `;

    return result.map((r) => ({
      model: r.model || 'unknown',
      provider: r.provider || 'unknown',
      avgLatencyMs: Number(r.avg_latency) || 0,
      p50LatencyMs: Number(r.p50_latency) || 0,
      p95LatencyMs: Number(r.p95_latency) || 0,
      p99LatencyMs: Number(r.p99_latency) || 0,
      minLatencyMs: Number(r.min_latency) || 0,
      maxLatencyMs: Number(r.max_latency) || 0,
      requestCount: Number(r.request_count),
    }));
  }

  /**
   * P1: Get phase cost breakdown
   */
  private async getPhaseCosts(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<PhaseCostItem[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        phase: string;
        input_tokens: number;
        output_tokens: number;
        cost: number;
        request_count: bigint;
      }>
    >`
      SELECT
        COALESCE(metadata->>'phase', 'unknown') as phase,
        COALESCE(SUM(CASE WHEN type = 'LLM_TOKENS_INPUT' THEN quantity ELSE 0 END), 0) as input_tokens,
        COALESCE(SUM(CASE WHEN type = 'LLM_TOKENS_OUTPUT' THEN quantity ELSE 0 END), 0) as output_tokens,
        COALESCE(SUM(total_cost), 0) as cost,
        COUNT(DISTINCT resource_id) as request_count
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND period_start >= ${start}
        AND period_end <= ${end}
        AND type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT')
      GROUP BY metadata->>'phase'
      ORDER BY cost DESC
    `;

    const totalCost = result.reduce((sum, r) => sum + Number(r.cost), 0);

    return result.map((r) => ({
      phase: r.phase || 'unknown',
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.input_tokens) + Number(r.output_tokens),
      cost: Number(r.cost),
      requestCount: Number(r.request_count),
      percentOfTotal: totalCost > 0 ? Math.round((Number(r.cost) / totalCost) * 100) : 0,
    }));
  }

  /**
   * P1: Get cache effectiveness metrics
   */
  private async getCacheMetrics(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<CacheMetrics> {
    // Overall cache stats
    const overall = await this.prisma.$queryRaw<
      Array<{
        total_requests: bigint;
        cached_requests: bigint;
        total_cost: number;
        cached_cost: number;
      }>
    >`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN metadata->>'cached' = 'true' THEN 1 END) as cached_requests,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(CASE WHEN metadata->>'cached' = 'true' THEN total_cost ELSE 0 END), 0) as cached_cost
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND period_start >= ${start}
        AND period_end <= ${end}
        AND type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT')
    `;

    // Per-model cache stats
    const byModel = await this.prisma.$queryRaw<
      Array<{
        model: string;
        total_requests: bigint;
        cached_requests: bigint;
      }>
    >`
      SELECT
        COALESCE(metadata->>'model', 'unknown') as model,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN metadata->>'cached' = 'true' THEN 1 END) as cached_requests
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND period_start >= ${start}
        AND period_end <= ${end}
        AND type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT')
      GROUP BY metadata->>'model'
      ORDER BY total_requests DESC
    `;

    const totalReqs = Number(overall[0]?.total_requests || 0);
    const cachedReqs = Number(overall[0]?.cached_requests || 0);
    const totalCost = Number(overall[0]?.total_cost || 0);
    const cachedCost = Number(overall[0]?.cached_cost || 0);

    return {
      totalRequests: totalReqs,
      cachedRequests: cachedReqs,
      cacheHitRate: totalReqs > 0 ? Math.round((cachedReqs / totalReqs) * 100) : 0,
      estimatedSavings: cachedCost, // Cost that was from cache (could be 0 if cache is cheaper)
      byModel: byModel.map((m) => ({
        model: m.model || 'unknown',
        totalRequests: Number(m.total_requests),
        cachedRequests: Number(m.cached_requests),
        cacheHitRate:
          Number(m.total_requests) > 0
            ? Math.round((Number(m.cached_requests) / Number(m.total_requests)) * 100)
            : 0,
      })),
    };
  }

  /**
   * P1: Get top 10 most expensive tasks
   */
  private async getTopExpensiveTasks(
    orgId: string,
    start: Date,
    end: Date,
    limit = 10,
  ): Promise<TopExpensiveTaskItem[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        task_id: string;
        cost: number;
        total_tokens: number;
        workflow_count: bigint;
        phases: string;
      }>
    >`
      SELECT
        metadata->>'taskId' as task_id,
        COALESCE(SUM(total_cost), 0) as cost,
        COALESCE(SUM(quantity), 0) as total_tokens,
        COUNT(DISTINCT resource_id) as workflow_count,
        STRING_AGG(DISTINCT metadata->>'phase', ', ') as phases
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND period_start >= ${start}
        AND period_end <= ${end}
        AND type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT')
        AND metadata->>'taskId' IS NOT NULL
      GROUP BY metadata->>'taskId'
      ORDER BY cost DESC
      LIMIT ${limit}
    `;

    // Enrich with task details
    const enriched = await Promise.all(
      result.map(async (r) => {
        let taskTitle: string | undefined;
        let projectName: string | undefined;
        let linearIdentifier: string | undefined;

        if (r.task_id) {
          const task = await this.prisma.task.findUnique({
            where: { id: r.task_id },
            include: {
              project: { select: { name: true } },
            },
          });
          taskTitle = task?.title;
          projectName = task?.project?.name;
          linearIdentifier = task?.linearId || undefined;
        }

        return {
          taskId: r.task_id,
          taskTitle,
          projectName,
          linearIdentifier,
          totalCost: Number(r.cost),
          totalTokens: Number(r.total_tokens),
          workflowCount: Number(r.workflow_count),
          phases: r.phases ? r.phases.split(', ').filter(Boolean) : [],
        };
      }),
    );

    return enriched;
  }

  /**
   * P2: Calculate usage forecast
   */
  private async calculateUsageForecast(
    orgId: string,
    start: Date,
    end: Date,
    tokenQuota: number,
    costQuota: number,
  ): Promise<UsageForecast> {
    // Get daily costs for trend analysis (last 14 days)
    const twoWeeksAgo = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dailyCosts = await this.prisma.$queryRaw<
      Array<{ date: Date; cost: number; tokens: number }>
    >`
      SELECT
        DATE(period_start) as date,
        COALESCE(SUM(total_cost), 0) as cost,
        COALESCE(SUM(CASE WHEN type IN ('LLM_TOKENS_INPUT', 'LLM_TOKENS_OUTPUT') THEN quantity ELSE 0 END), 0) as tokens
      FROM usage_records
      WHERE organization_id = ${orgId}
        AND period_start >= ${twoWeeksAgo}
        AND period_end <= ${end}
      GROUP BY DATE(period_start)
      ORDER BY date
    `;

    // Calculate averages
    const recentDays = dailyCosts.filter((d) => d.date >= oneWeekAgo);
    const olderDays = dailyCosts.filter((d) => d.date < oneWeekAgo);

    const recentAvgCost =
      recentDays.length > 0
        ? recentDays.reduce((sum, d) => sum + Number(d.cost), 0) / recentDays.length
        : 0;
    const recentAvgTokens =
      recentDays.length > 0
        ? recentDays.reduce((sum, d) => sum + Number(d.tokens), 0) / recentDays.length
        : 0;

    const olderAvgCost =
      olderDays.length > 0
        ? olderDays.reduce((sum, d) => sum + Number(d.cost), 0) / olderDays.length
        : recentAvgCost;

    // Calculate trend
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    let trendPercentage = 0;

    if (olderAvgCost > 0) {
      trendPercentage = Math.round(((recentAvgCost - olderAvgCost) / olderAvgCost) * 100);
      if (trendPercentage > 10) trend = 'increasing';
      else if (trendPercentage < -10) trend = 'decreasing';
    }

    // Calculate days until quota exhausted
    const totalCostUsed = dailyCosts.reduce((sum, d) => sum + Number(d.cost), 0);
    const totalTokensUsed = dailyCosts.reduce((sum, d) => sum + Number(d.tokens), 0);

    const costRemaining = costQuota - totalCostUsed;
    const tokensRemaining = tokenQuota - totalTokensUsed;

    const daysUntilCostExhausted =
      recentAvgCost > 0 && costQuota > 0 ? Math.floor(costRemaining / recentAvgCost) : null;
    const daysUntilTokensExhausted =
      recentAvgTokens > 0 && tokenQuota > 0 ? Math.floor(tokensRemaining / recentAvgTokens) : null;

    return {
      dailyAverageCost: Math.round(recentAvgCost * 100) / 100,
      dailyAverageTokens: Math.round(recentAvgTokens),
      projectedMonthlyCost: Math.round(recentAvgCost * 30 * 100) / 100,
      projectedMonthlyTokens: Math.round(recentAvgTokens * 30),
      daysUntilCostQuotaExhausted: daysUntilCostExhausted !== null && daysUntilCostExhausted > 0 ? daysUntilCostExhausted : null,
      daysUntilTokenQuotaExhausted: daysUntilTokensExhausted !== null && daysUntilTokensExhausted > 0 ? daysUntilTokensExhausted : null,
      trend,
      trendPercentage: Math.abs(trendPercentage),
    };
  }

  /**
   * P2: Get cost breakdown by workflow outcome (success vs failure)
   */
  private async getCostByOutcome(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<CostByOutcome> {
    const result = await this.prisma.$queryRaw<
      Array<{
        status: string;
        workflow_count: bigint;
        total_cost: number;
      }>
    >`
      SELECT
        w.status,
        COUNT(DISTINCT w.id) as workflow_count,
        COALESCE(SUM(ur.total_cost), 0) as total_cost
      FROM workflows w
      LEFT JOIN usage_records ur ON ur.resource_id = w.workflow_id
      JOIN organization_projects op ON w.project_id = op.project_id
      WHERE op.organization_id = ${orgId}
        AND w.created_at >= ${start}
        AND w.created_at <= ${end}
      GROUP BY w.status
    `;

    const successfulRow = result.find((r) => r.status === 'COMPLETED');
    const failedRow = result.find((r) => r.status === 'FAILED');

    const successCount = Number(successfulRow?.workflow_count || 0);
    const successCost = Number(successfulRow?.total_cost || 0);
    const failedCount = Number(failedRow?.workflow_count || 0);
    const failedCost = Number(failedRow?.total_cost || 0);

    const totalCost = successCost + failedCost;

    return {
      successful: {
        count: successCount,
        totalCost: successCost,
        avgCost: successCount > 0 ? Math.round((successCost / successCount) * 100) / 100 : 0,
      },
      failed: {
        count: failedCount,
        totalCost: failedCost,
        avgCost: failedCount > 0 ? Math.round((failedCost / failedCount) * 100) / 100 : 0,
      },
      costEfficiency: totalCost > 0 ? Math.round((successCost / totalCost) * 100) : 100,
    };
  }
}
