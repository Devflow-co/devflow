/**
 * Setup Step Workflow - Phase 4 Code Generation
 *
 * Syncs task from Linear and updates status to "Code In Progress".
 * This is the first step in the code generation phase.
 */

import { proxyActivities, executeChild } from '@temporalio/workflow';
import type * as activities from '@/activities';
import { syncLinearTaskWorkflow } from '../common/sync-linear-task.workflow';
import { updateLinearStatusWorkflow } from '../common/update-linear-status.workflow';
import type { SyncLinearTaskOutput } from '../../types/step-outputs.types';
import type { WorkflowConfig } from '@devflow/common';

const { logWorkflowProgress } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

// ============================================
// Types
// ============================================

export interface SetupWorkflowInput {
  projectId: string;
  taskId: string;
  config?: WorkflowConfig;
  /** Workflow ID for progress logging */
  parentWorkflowId: string;
}

export interface SetupWorkflowOutput {
  task: SyncLinearTaskOutput;
  statusUpdated: boolean;
}

// ============================================
// Constants
// ============================================

const LINEAR_STATUSES = {
  codeInProgress: 'Code In Progress',
};

// ============================================
// Workflow
// ============================================

/**
 * Setup workflow for code generation phase.
 * Syncs task from Linear and optionally updates status.
 */
export async function setupCodeGenerationWorkflow(
  input: SetupWorkflowInput
): Promise<SetupWorkflowOutput> {
  const { projectId, taskId, config, parentWorkflowId } = input;
  const enableAutoStatusUpdate = config?.automation?.phases?.codeGeneration?.features?.enableAutoStatusUpdate ?? true;

  // Step 1: Sync task from Linear
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Sync Linear Task',
    stepNumber: 1,
    totalSteps: 2,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const stepStart = Date.now();
  const task = await executeChild(syncLinearTaskWorkflow, {
    workflowId: `setup-sync-${taskId}-${Date.now()}`,
    args: [{ taskId, projectId }],
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Sync Linear Task',
    stepNumber: 1,
    totalSteps: 2,
    status: 'completed',
    startedAt: new Date(stepStart),
    completedAt: new Date(),
    metadata: { taskId: task.id, linearId: task.linearId, title: task.title },
  });

  // Step 2: Update status to Code In Progress (if enabled)
  let statusUpdated = false;
  if (enableAutoStatusUpdate) {
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Update Status to In Progress',
      stepNumber: 2,
      totalSteps: 2,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const statusStart = Date.now();
    await executeChild(updateLinearStatusWorkflow, {
      workflowId: `setup-status-${taskId}-${Date.now()}`,
      args: [{ projectId, linearId: task.linearId, status: LINEAR_STATUSES.codeInProgress }],
    });
    statusUpdated = true;

    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Update Status to In Progress',
      stepNumber: 2,
      totalSteps: 2,
      status: 'completed',
      startedAt: new Date(statusStart),
      completedAt: new Date(),
      metadata: { status: LINEAR_STATUSES.codeInProgress },
    });
  } else {
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Update Status to In Progress (disabled)',
      stepNumber: 2,
      totalSteps: 2,
      status: 'skipped',
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { reason: 'enableAutoStatusUpdate is disabled' },
    });
  }

  return {
    task,
    statusUpdated,
  };
}
