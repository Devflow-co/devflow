/**
 * Finalization Step Workflow - Phase 4 Code Generation
 *
 * Updates status to "Code Review" and logs completion metrics.
 * This is the last step in the code generation phase.
 */

import { proxyActivities, executeChild } from '@temporalio/workflow';
import type * as activities from '@/activities';
import { updateLinearStatusWorkflow } from '../common/update-linear-status.workflow';
import type { WorkflowConfig } from '@devflow/common';

const { logWorkflowProgress, logWorkflowCompletion } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

// ============================================
// Types
// ============================================

export interface FinalizationWorkflowInput {
  projectId: string;
  taskId: string;
  linearId: string;
  config?: WorkflowConfig;
  /** Workflow ID for progress logging */
  parentWorkflowId: string;
  /** Workflow start time for completion metrics */
  workflowStartTime: Date;
  /** PR information */
  pr?: {
    number: number;
    url: string;
    draft: boolean;
  };
  /** Container validation result */
  containerResult?: {
    success: boolean;
    failedPhase?: string;
    duration?: number;
  };
  /** Retry metrics */
  retryMetrics?: {
    totalAttempts: number;
    validationRetries: number;
  };
  /** Interactive metrics (V3) */
  interactiveMetrics?: {
    ambiguitiesDetected: number;
    clarificationQuestions: number;
    solutionChoices: number;
    approvalRequested: boolean;
    humanResponsesReceived: number;
  };
}

export interface FinalizationWorkflowOutput {
  statusUpdated: boolean;
  completionLogged: boolean;
}

// ============================================
// Constants
// ============================================

const LINEAR_STATUSES = {
  codeReview: 'Code Review',
};

// ============================================
// Workflow
// ============================================

/**
 * Finalization workflow for code generation phase.
 * Updates status to Code Review and logs completion metrics.
 */
export async function finalizationWorkflow(
  input: FinalizationWorkflowInput
): Promise<FinalizationWorkflowOutput> {
  const { projectId, taskId, linearId, config, parentWorkflowId, workflowStartTime } = input;
  const enableAutoStatusUpdate = config?.automation?.phases?.codeGeneration?.features?.enableAutoStatusUpdate ?? true;

  const totalSteps = 2;

  // Step 1: Update status to Code Review (if enabled)
  let statusUpdated = false;
  if (enableAutoStatusUpdate) {
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Update Status to Code Review',
      stepNumber: 1,
      totalSteps,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const statusStart = Date.now();
    await executeChild(updateLinearStatusWorkflow, {
      workflowId: `finalize-status-${taskId}-${Date.now()}`,
      args: [{ projectId, linearId, status: LINEAR_STATUSES.codeReview }],
    });
    statusUpdated = true;

    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Update Status to Code Review',
      stepNumber: 1,
      totalSteps,
      status: 'completed',
      startedAt: new Date(statusStart),
      completedAt: new Date(),
      metadata: { status: LINEAR_STATUSES.codeReview },
    });
  } else {
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Update Status to Code Review (disabled)',
      stepNumber: 1,
      totalSteps,
      status: 'skipped',
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { reason: 'enableAutoStatusUpdate is disabled' },
    });
  }

  // Step 2: Log completion metrics
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Log Completion Metrics',
    stepNumber: 2,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const metricsStart = Date.now();
  await logWorkflowCompletion({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    startedAt: workflowStartTime,
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Log Completion Metrics',
    stepNumber: 2,
    totalSteps,
    status: 'completed',
    startedAt: new Date(metricsStart),
    completedAt: new Date(),
    metadata: {
      pr: input.pr,
      containerResult: input.containerResult,
      retryMetrics: input.retryMetrics,
      interactiveMetrics: input.interactiveMetrics,
    },
  });

  return {
    statusUpdated,
    completionLogged: true,
  };
}
