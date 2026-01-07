/**
 * Workflow Progress Tracking Activities
 *
 * Logs workflow progress to database for real-time monitoring in UI.
 * Each orchestrator step calls logWorkflowProgress to track execution.
 */

import { createLogger } from '@devflow/common';
import { PrismaClient, WorkflowStatus } from '@prisma/client';

const logger = createLogger('WorkflowProgressActivities');
const prisma = new PrismaClient();

export type WorkflowPhase = 'refinement' | 'user_story' | 'technical_plan';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface LogWorkflowProgressParams {
  workflowId: string;
  projectId: string;
  taskId: string;
  phase: WorkflowPhase;
  stepName: string;
  stepNumber: number;
  totalSteps: number;
  status: StepStatus;
  metadata?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Map step status to Prisma WorkflowStatus enum
 */
function mapStepStatusToPrisma(status: StepStatus): WorkflowStatus {
  switch (status) {
    case 'pending':
      return 'PENDING';
    case 'in_progress':
      return 'RUNNING';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    case 'skipped':
      return 'COMPLETED'; // Treat skipped as completed
    default:
      return 'RUNNING';
  }
}

/**
 * Map phase + stepName to legacy WorkflowStage enum (optional, for compatibility)
 */
function mapPhaseToStage(phase: WorkflowPhase, stepName: string): string {
  // Map to legacy stage if needed, otherwise return generic stage
  if (stepName.toLowerCase().includes('sync')) return 'LINEAR_SYNC';
  if (stepName.toLowerCase().includes('generate') || stepName.toLowerCase().includes('refinement')) return 'SPEC_GENERATION';
  if (stepName.toLowerCase().includes('user story')) return 'SPEC_GENERATION';
  if (stepName.toLowerCase().includes('technical plan')) return 'SPEC_GENERATION';
  if (stepName.toLowerCase().includes('pr') || stepName.toLowerCase().includes('pull request')) return 'PR_CREATION';
  return 'SPEC_GENERATION'; // Default fallback
}

/**
 * Log workflow progress to database
 *
 * This activity is called by orchestrators after each step to track progress.
 * It updates both the Workflow record (current state) and creates/updates
 * WorkflowStageLog entries (step history).
 *
 * @example
 * ```typescript
 * // Before step execution
 * await logWorkflowProgress({
 *   workflowId: 'refinement-123',
 *   projectId: 'proj-1',
 *   taskId: 'task-1',
 *   phase: 'refinement',
 *   stepName: 'Sync Linear Task',
 *   stepNumber: 1,
 *   totalSteps: 15,
 *   status: 'in_progress',
 *   startedAt: new Date(),
 * });
 *
 * // After step execution
 * await logWorkflowProgress({
 *   workflowId: 'refinement-123',
 *   projectId: 'proj-1',
 *   taskId: 'task-1',
 *   phase: 'refinement',
 *   stepName: 'Sync Linear Task',
 *   stepNumber: 1,
 *   totalSteps: 15,
 *   status: 'completed',
 *   completedAt: new Date(),
 *   metadata: { taskId: 'task-123' },
 * });
 * ```
 */
export async function logWorkflowProgress(params: LogWorkflowProgressParams): Promise<void> {
  const {
    workflowId,
    projectId,
    taskId,
    phase,
    stepName,
    stepNumber,
    totalSteps,
    status,
    metadata,
    error,
    startedAt,
    completedAt,
  } = params;

  try {
    // Calculate progress percentage
    const progressPercent = Math.round((stepNumber / totalSteps) * 100);

    // Handle date deserialization from Temporal (dates come as ISO strings)
    const parsedStartedAt = startedAt ? new Date(startedAt) : undefined;
    const parsedCompletedAt = completedAt ? new Date(completedAt) : undefined;

    // Calculate duration if both timestamps provided
    let duration: number | undefined;
    if (parsedStartedAt && parsedCompletedAt) {
      duration = parsedCompletedAt.getTime() - parsedStartedAt.getTime();
    }

    // Map status to Prisma enum
    const prismaStatus = mapStepStatusToPrisma(status);

    // 1. Upsert Workflow record (create if doesn't exist, update if exists)
    // First, get the task to link the workflow
    const task = await prisma.task.findFirst({
      where: {
        OR: [{ id: taskId }, { linearId: taskId }],
      },
      select: { id: true, projectId: true },
    });

    // If no task found, we can't create the workflow record (required relation)
    // Just log and skip - this shouldn't fail the workflow
    if (!task) {
      logger.warn('Task not found for workflow progress, skipping', {
        workflowId,
        taskId,
        projectId,
      });
      return;
    }

    await prisma.workflow.upsert({
      where: { workflowId },
      create: {
        workflowId,
        project: { connect: { id: task.projectId } },
        task: { connect: { id: task.id } },
        status: 'RUNNING',
        currentPhase: phase,
        currentStepName: stepName,
        currentStepNumber: stepNumber,
        totalSteps,
        progressPercent,
        startedAt: new Date(),
      },
      update: {
        currentPhase: phase,
        currentStepName: stepName,
        currentStepNumber: stepNumber,
        totalSteps,
        progressPercent,
        updatedAt: new Date(),
      },
    });

    logger.debug('Updated workflow progress', {
      workflowId,
      phase,
      stepName,
      stepNumber,
      totalSteps,
      progressPercent,
      status,
    });

    // 2. Upsert WorkflowStageLog entry for this step
    const stage = mapPhaseToStage(phase, stepName);

    // Get the workflow record to get the id for the stage log
    const workflowRecord = await prisma.workflow.findUnique({
      where: { workflowId },
      select: { id: true },
    });

    if (workflowRecord) {
      await prisma.workflowStageLog.upsert({
        where: {
          workflowId_stepName: {
            workflowId: workflowRecord.id,
            stepName,
          },
        },
        create: {
          workflowId: workflowRecord.id,
          stage: stage as any,
          status: prismaStatus,
          phase,
          stepName,
          stepNumber,
          totalSteps,
          data: metadata || null,
          error: error || null,
          startedAt: parsedStartedAt || new Date(),
          completedAt: parsedCompletedAt || null,
          duration: duration || null,
        },
        update: {
          status: prismaStatus,
          data: metadata || null,
          error: error || null,
          completedAt: parsedCompletedAt || null,
          duration: duration || null,
        },
      });
    }

    logger.info('Workflow progress logged', {
      workflowId,
      phase,
      stepName,
      stepNumber,
      status,
      duration,
    });
  } catch (err) {
    logger.error('Failed to log workflow progress', err as Error, {
      workflowId,
      phase,
      stepName,
    });
    // Don't throw - logging failure should not fail the workflow
  }
}

/**
 * Mark workflow as failed with error details
 *
 * This is a convenience function to log a workflow failure.
 */
export async function logWorkflowFailure(params: {
  workflowId: string;
  projectId: string;
  taskId: string;
  phase: WorkflowPhase;
  error: string;
  stepName?: string;
}): Promise<void> {
  const { workflowId, projectId, taskId, phase, error, stepName } = params;

  try {
    // First, get the task to link the workflow
    const task = await prisma.task.findFirst({
      where: {
        OR: [{ id: taskId }, { linearId: taskId }],
      },
      select: { id: true, projectId: true },
    });

    // If no task found, we can't create the workflow record (required relation)
    // Just log and skip - this shouldn't fail the workflow
    if (!task) {
      logger.warn('Task not found for workflow failure logging, skipping', {
        workflowId,
        taskId,
        projectId,
      });
      return;
    }

    // Use upsert to handle both create and update scenarios
    await prisma.workflow.upsert({
      where: { workflowId },
      create: {
        workflowId,
        project: { connect: { id: task.projectId } },
        task: { connect: { id: task.id } },
        status: 'FAILED',
        currentPhase: phase,
        error,
        startedAt: new Date(),
        completedAt: new Date(),
      },
      update: {
        status: 'FAILED',
        error,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.error('Workflow failed', new Error(error), {
      workflowId,
      phase,
    });

    // If stepName provided, also log the step failure
    if (stepName) {
      await logWorkflowProgress({
        workflowId,
        projectId,
        taskId,
        phase,
        stepName: stepName || 'Workflow Failed',
        stepNumber: 0,
        totalSteps: 0,
        status: 'failed',
        error,
        completedAt: new Date(),
      });
    }
  } catch (err) {
    logger.error('Failed to log workflow failure', err as Error, {
      workflowId,
    });
  }
}
