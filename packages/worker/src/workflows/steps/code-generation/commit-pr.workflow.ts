/**
 * Commit & PR Step Workflow - Phase 4 Code Generation
 *
 * Creates branch, commits generated files, and creates draft PR.
 * Always creates draft PRs for safety (human review required).
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type * as vcsActivities from '@/activities/vcs.activities';
import type { WorkflowConfig, GeneratedFile } from '@devflow/common';

const { logWorkflowProgress } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

const { createBranch, commitFiles, createPullRequest } = proxyActivities<typeof vcsActivities>({
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 3 },
});

// ============================================
// Types
// ============================================

export interface CommitPRWorkflowInput {
  projectId: string;
  taskId: string;
  config?: WorkflowConfig;
  /** Workflow ID for progress logging */
  parentWorkflowId: string;

  /** Task information */
  task: {
    id: string;
    linearId: string;
    title: string;
    identifier: string;
  };

  /** Generated files to commit */
  generatedFiles: GeneratedFile[];

  /** Branch name for the changes */
  branchName: string;

  /** Commit message */
  commitMessage: string;

  /** PR title */
  prTitle: string;

  /** PR description */
  prDescription: string;

  /** Target branch (defaults to 'main') */
  targetBranch?: string;

  /** Container validation result for PR labels */
  containerResult?: {
    success: boolean;
    duration: number;
    exitCode: number;
    phases: Record<string, unknown>;
    logs: string;
    failedPhase?: string;
    testResults?: {
      passed: number;
      failed: number;
      skipped: number;
      total: number;
    };
  };

  /** Retry metrics for PR description */
  retryMetrics?: {
    totalAttempts: number;
    validationRetries: number;
  };

  /** V3 Interactive metrics for PR description */
  interactiveMetrics?: {
    ambiguitiesDetected: number;
    clarificationQuestions: number;
    solutionChoices: number;
    approvalRequested: boolean;
  };
}

export interface CommitPRWorkflowOutput {
  /** PR number */
  number: number;
  /** PR URL */
  url: string;
  /** Whether PR was created as draft */
  draft: boolean;
  /** Branch name */
  branchName: string;
}

// ============================================
// Workflow
// ============================================

/**
 * Commit and PR workflow for code generation phase.
 * Creates branch, commits files, and opens draft PR.
 */
export async function commitPRWorkflow(
  input: CommitPRWorkflowInput
): Promise<CommitPRWorkflowOutput> {
  const {
    projectId,
    taskId,
    config,
    parentWorkflowId,
    task,
    generatedFiles,
    branchName,
    commitMessage,
    prTitle,
    prDescription,
    targetBranch = 'main',
    containerResult,
    retryMetrics,
    interactiveMetrics,
  } = input;

  const totalSteps = 3;

  // Step 1: Create branch
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Create Branch',
    stepNumber: 1,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
    metadata: { branchName, baseBranch: targetBranch },
  });

  const branchStart = Date.now();

  await createBranch({
    projectId,
    branchName,
    baseBranch: targetBranch,
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Create Branch',
    stepNumber: 1,
    totalSteps,
    status: 'completed',
    startedAt: new Date(branchStart),
    completedAt: new Date(),
    metadata: { branchName },
  });

  // Step 2: Commit files
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Commit Files',
    stepNumber: 2,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
    metadata: { fileCount: generatedFiles.length },
  });

  const commitStart = Date.now();

  // Convert GeneratedFile to commit format
  const filesToCommit = generatedFiles.map((file) => ({
    path: file.path,
    content: file.content || '',
  }));

  await commitFiles({
    projectId,
    branchName,
    files: filesToCommit,
    message: commitMessage,
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Commit Files',
    stepNumber: 2,
    totalSteps,
    status: 'completed',
    startedAt: new Date(commitStart),
    completedAt: new Date(),
    metadata: {
      fileCount: generatedFiles.length,
      commitMessage,
    },
  });

  // Step 3: Create draft PR
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Create Draft PR',
    stepNumber: 3,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const prStart = Date.now();

  // Build enhanced PR description
  const enhancedDescription = buildEnhancedPRDescription({
    baseDescription: prDescription,
    containerResult,
    retryMetrics,
    interactiveMetrics,
    taskIdentifier: task.identifier,
  });

  // Build labels based on results
  const labels = buildPRLabels(containerResult, interactiveMetrics);

  const pr = await createPullRequest({
    projectId,
    branchName,
    title: prTitle,
    description: enhancedDescription,
    targetBranch,
    draft: true, // Always draft for safety
    labels,
    linearIdentifier: task.identifier,
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Create Draft PR',
    stepNumber: 3,
    totalSteps,
    status: 'completed',
    startedAt: new Date(prStart),
    completedAt: new Date(),
    metadata: {
      prNumber: pr.number,
      prUrl: pr.url,
      draft: pr.draft,
      labels,
    },
  });

  return {
    number: pr.number,
    url: pr.url,
    draft: pr.draft,
    branchName: pr.branchName,
  };
}

// ============================================
// Helper Types
// ============================================

/** Simplified container result for PR workflow */
type ContainerResultSummary = {
  success: boolean;
  duration: number;
  exitCode: number;
  phases: Record<string, unknown>;
  logs: string;
  failedPhase?: string;
  testResults?: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
};

// ============================================
// Helper Functions
// ============================================

interface EnhancedDescriptionInput {
  baseDescription: string;
  containerResult?: ContainerResultSummary;
  retryMetrics?: {
    totalAttempts: number;
    validationRetries: number;
  };
  interactiveMetrics?: {
    ambiguitiesDetected: number;
    clarificationQuestions: number;
    solutionChoices: number;
    approvalRequested: boolean;
  };
  taskIdentifier: string;
}

/**
 * Build enhanced PR description with validation and metrics
 */
function buildEnhancedPRDescription(input: EnhancedDescriptionInput): string {
  const { baseDescription, containerResult, retryMetrics, interactiveMetrics, taskIdentifier } = input;

  let description = baseDescription;

  // Add container validation section
  if (containerResult) {
    const status = containerResult.success ? '✅ All checks passed' : `❌ Failed at: ${containerResult.failedPhase}`;
    description += `\n\n## Container Validation\n\n${status}\n`;

    if (retryMetrics) {
      description += `\n- Attempts: ${retryMetrics.totalAttempts}`;
      description += `\n- Validation retries: ${retryMetrics.validationRetries}`;
    }

    if (containerResult.testResults) {
      description += `\n- Tests: ${containerResult.testResults.passed} passed, ${containerResult.testResults.failed} failed`;
    }
  }

  // Add V3 interactive section
  if (interactiveMetrics && (
    interactiveMetrics.ambiguitiesDetected > 0 ||
    interactiveMetrics.clarificationQuestions > 0 ||
    interactiveMetrics.solutionChoices > 0 ||
    interactiveMetrics.approvalRequested
  )) {
    description += `\n\n## Interactive Code Generation (V3)\n`;

    if (interactiveMetrics.ambiguitiesDetected > 0) {
      description += `\n- Ambiguities detected: ${interactiveMetrics.ambiguitiesDetected}`;
    }
    if (interactiveMetrics.clarificationQuestions > 0) {
      description += `\n- Clarification questions: ${interactiveMetrics.clarificationQuestions}`;
    }
    if (interactiveMetrics.solutionChoices > 0) {
      description += `\n- Solution choices: ${interactiveMetrics.solutionChoices}`;
    }
    if (interactiveMetrics.approvalRequested) {
      description += `\n- Pre-PR approval: requested ✅`;
    }
  }

  // Add footer
  description += `\n\n---\n\n`;
  description += `*Generated with DevFlow Phase 4 (Code Generation)*\n\n`;
  description += `Linear: ${taskIdentifier}`;

  return description;
}

/**
 * Build PR labels based on validation and interactive results
 */
function buildPRLabels(
  containerResult?: ContainerResultSummary,
  interactiveMetrics?: {
    ambiguitiesDetected: number;
    clarificationQuestions: number;
    solutionChoices: number;
    approvalRequested: boolean;
  }
): string[] {
  const labels = ['auto-generated', 'devflow-phase-4'];

  if (containerResult) {
    labels.push(containerResult.success ? 'checks-passed' : 'checks-failed');
  }

  if (interactiveMetrics) {
    if (interactiveMetrics.clarificationQuestions > 0 || interactiveMetrics.solutionChoices > 0) {
      labels.push('human-guided');
    }
    if (interactiveMetrics.approvalRequested) {
      labels.push('pre-approved');
    }
  }

  return labels;
}
