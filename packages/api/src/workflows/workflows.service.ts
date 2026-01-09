/**
 * Workflows Service - Temporal Integration
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection, Client } from '@temporalio/client';
import { createLogger, loadConfig, WorkflowConfig, DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';
import { StartWorkflowDto } from '@/workflows/dto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class WorkflowsService {
  private logger = createLogger('WorkflowsService');
  private client: Client | null = null;
  private workflowConfig: WorkflowConfig;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      // Load config once at service initialization
      // Merge loaded statuses with DEFAULT_WORKFLOW_CONFIG for statusOrder and workflow behavior
      const fullConfig = loadConfig();
      this.workflowConfig = {
        linear: {
          statuses: fullConfig.linear.statuses,
          statusOrder: DEFAULT_WORKFLOW_CONFIG.linear.statusOrder,
          workflow: DEFAULT_WORKFLOW_CONFIG.linear.workflow,
          features: DEFAULT_WORKFLOW_CONFIG.linear.features,
        },
      };
      this.logger.info('Workflow config loaded');

      const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      });

      this.client = new Client({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      });

      this.logger.info('Connected to Temporal');
    } catch (error) {
      this.logger.error('Failed to connect to Temporal', error as Error);
    }
  }

  async start(dto: StartWorkflowDto) {
    this.logger.info('Starting workflow', dto);

    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    // Determine workflow type (default to full devflow workflow)
    const workflowType = dto.workflowType || 'devflowWorkflow';
    const workflowId = `${workflowType}-${dto.taskId}-${Date.now()}`;

    const handle = await this.client.workflow.start(workflowType, {
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'devflow',
      workflowId,
      args: [
        {
          taskId: dto.taskId,
          projectId: dto.projectId,
          userId: dto.userId || 'system',
          config: this.workflowConfig, // Pass workflow config
        },
      ],
    });

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    };
  }

  /**
   * Start a spec generation workflow
   */
  async startSpecGeneration(taskId: string, projectId: string, userId?: string) {
    this.logger.info('Starting spec generation workflow', { taskId, projectId });

    return this.start({
      taskId,
      projectId,
      userId,
      workflowType: 'specGenerationWorkflow',
    });
  }

  async getStatus(workflowId: string) {
    this.logger.info('Getting workflow status', { workflowId });

    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    const handle = this.client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    return {
      workflowId,
      status: description.status.name,
      startTime: description.startTime,
      closeTime: description.closeTime,
    };
  }

  async cancel(workflowId: string) {
    this.logger.info('Cancelling workflow', { workflowId });

    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    const handle = this.client.workflow.getHandle(workflowId);
    await handle.cancel();

    return { workflowId, status: 'cancelled' };
  }

  /**
   * List all workflows for a user (across all accessible projects)
   */
  async listAllWorkflows(
    userId: string,
    options?: { limit?: number; status?: string; offset?: number },
  ) {
    this.logger.info('Listing all workflows for user', { userId, options });

    const limit = options?.limit ? parseInt(options.limit.toString(), 10) : 50;
    const offset = options?.offset ? parseInt(options.offset.toString(), 10) : 0;
    const statusFilter = options?.status ? { status: options.status as any } : {};

    // Get all project IDs the user has access to via their organizations
    const userOrgs = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = userOrgs.map((o) => o.organizationId);

    const orgProjects = await this.prisma.organizationProject.findMany({
      where: { organizationId: { in: orgIds } },
      select: { projectId: true },
    });
    const projectIds = orgProjects.map((p) => p.projectId);

    // Get total count
    const total = await this.prisma.workflow.count({
      where: {
        projectId: { in: projectIds },
        ...statusFilter,
      },
    });

    // Get workflows
    const workflows = await this.prisma.workflow.findMany({
      where: {
        projectId: { in: projectIds },
        ...statusFilter,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            linearId: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            stages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    return {
      workflows: workflows.map((w) => ({
        id: w.id,
        workflowId: w.workflowId,
        status: w.status,
        currentPhase: w.currentPhase,
        currentStepName: w.currentStepName,
        currentStepNumber: w.currentStepNumber,
        progressPercent: w.progressPercent,
        task: w.task,
        project: w.project,
        startedAt: w.startedAt,
        completedAt: w.completedAt,
        duration: w.duration,
        stageCount: w._count.stages,
      })),
      total,
    };
  }

  /**
   * List workflows for a project
   */
  async listProjectWorkflows(projectId: string, options?: { limit?: number; status?: string }) {
    this.logger.info('Listing project workflows', { projectId, options });

    const limit = options?.limit ? parseInt(options.limit.toString(), 10) : 50;
    const statusFilter = options?.status ? { status: options.status as any } : {};

    // Get total count
    const total = await this.prisma.workflow.count({
      where: {
        projectId,
        ...statusFilter,
      },
    });

    const workflows = await this.prisma.workflow.findMany({
      where: {
        projectId,
        ...statusFilter,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            linearId: true,
          },
        },
        _count: {
          select: {
            stages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      workflows: workflows.map((w) => ({
        id: w.id,
        workflowId: w.workflowId,
        status: w.status,
        currentPhase: w.currentPhase,
        currentStepName: w.currentStepName,
        currentStepNumber: w.currentStepNumber,
        progressPercent: w.progressPercent,
        task: w.task,
        startedAt: w.startedAt,
        completedAt: w.completedAt,
        duration: w.duration,
        stageCount: w._count.stages,
      })),
      total,
    };
  }

  /**
   * Get detailed workflow progress with step information
   */
  async getWorkflowProgress(workflowId: string) {
    this.logger.info('Getting workflow progress', { workflowId });

    const workflow = await this.prisma.workflow.findUnique({
      where: { workflowId },
      include: {
        task: true,
        stages: {
          orderBy: [{ phase: 'asc' }, { stepNumber: 'asc' }],
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    // Group stages by phase
    const phaseGroups = workflow.stages.reduce(
      (acc, stage) => {
        const phase = stage.phase || 'unknown';
        if (!acc[phase]) acc[phase] = [];
        acc[phase].push(stage);
        return acc;
      },
      {} as Record<string, typeof workflow.stages>,
    );

    return {
      workflow: {
        id: workflow.id,
        workflowId: workflow.workflowId,
        status: workflow.status,
        currentPhase: workflow.currentPhase,
        currentStepName: workflow.currentStepName,
        currentStepNumber: workflow.currentStepNumber,
        progressPercent: workflow.progressPercent,
        startedAt: workflow.startedAt,
        completedAt: workflow.completedAt,
        duration: workflow.duration,
        error: workflow.error,
      },
      task: workflow.task,
      phases: Object.entries(phaseGroups).map(([phase, stages]) => ({
        phase,
        totalSteps: stages[0]?.totalSteps || stages.length,
        completedSteps: stages.filter((s) => s.status === 'COMPLETED').length,
        steps: stages.map((s) => ({
          stepNumber: s.stepNumber,
          stepName: s.stepName,
          status: s.status,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          duration: s.duration,
          error: s.error,
          data: s.data,
        })),
      })),
    };
  }

  /**
   * Get workflow activity timeline
   */
  async getWorkflowTimeline(workflowId: string) {
    this.logger.info('Getting workflow timeline', { workflowId });

    const workflow = await this.prisma.workflow.findUnique({
      where: { workflowId },
      select: { id: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    const stages = await this.prisma.workflowStageLog.findMany({
      where: { workflowId: workflow.id },
      orderBy: { startedAt: 'asc' },
      select: {
        stepName: true,
        phase: true,
        status: true,
        startedAt: true,
        completedAt: true,
        duration: true,
        error: true,
      },
    });

    return {
      workflowId,
      timeline: stages,
    };
  }
}

