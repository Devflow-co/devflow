/**
 * Pre-Approval Step Workflow - Phase 4 Code Generation V3
 *
 * Generates code preview and posts approval request to Linear.
 * Allows human review before PR creation.
 *
 * Note: Signal handling for responses happens in the parent orchestrator.
 * This workflow only generates preview and posts the question.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type * as interactiveActivities from '@/activities/interactive.activities';
import type { WorkflowConfig, GeneratedFile } from '@devflow/common';

const { logWorkflowProgress } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

const { generateCodePreview, postCodeQuestion } = proxyActivities<typeof interactiveActivities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

// ============================================
// Types
// ============================================

export interface PreApprovalWorkflowInput {
  projectId: string;
  taskId: string;
  linearId: string;
  config?: WorkflowConfig;
  /** Workflow ID for progress logging and signal handling */
  parentWorkflowId: string;

  /** Task information */
  task: {
    id: string;
    linearId: string;
    title: string;
    identifier: string;
  };

  /** Generated files to preview */
  generatedFiles: GeneratedFile[];

  /** Branch name */
  branchName: string;

  /** PR title */
  prTitle: string;

  /** Commit message */
  commitMessage: string;

  /** Container validation result summary */
  validationSummary?: {
    success: boolean;
    testsRun: number;
    testsPassed: number;
    lintPassed: boolean;
    typecheckPassed: boolean;
  };

  /** Current step number in parent workflow */
  stepNumber: number;
  /** Total steps in parent workflow */
  totalSteps: number;
}

export interface PreApprovalWorkflowOutput {
  /** The question ID for signal matching */
  questionId: string;

  /** Linear comment ID where question was posted */
  commentId: string;

  /** Whether the workflow should wait for a response */
  waitingForResponse: true;

  /** Preview that was generated */
  preview: {
    totalFiles: number;
    totalLinesChanged: number;
    summary: string;
  };
}

// ============================================
// Workflow
// ============================================

/**
 * Pre-approval workflow for code generation phase (V3).
 * Generates code preview and posts approval request before PR creation.
 */
export async function preApprovalWorkflow(
  input: PreApprovalWorkflowInput
): Promise<PreApprovalWorkflowOutput> {
  const {
    projectId,
    taskId,
    linearId,
    config,
    parentWorkflowId,
    task,
    generatedFiles,
    branchName,
    prTitle,
    commitMessage,
    validationSummary,
    stepNumber,
    totalSteps,
  } = input;

  const timeoutHours = config?.automation?.phases?.codeGeneration?.features?.humanResponseTimeoutHours ?? 24;

  // Step 1: Generate code preview
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Generate Code Preview',
    stepNumber,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const previewStart = Date.now();

  // Build summary for the preview
  const summary = buildPreviewSummary({
    branchName,
    prTitle,
    commitMessage,
    fileCount: generatedFiles.length,
    validationSummary,
  });

  // Convert GeneratedFile to preview input format
  const filesForPreview = generatedFiles.map((file) => ({
    path: file.path,
    action: file.action as 'create' | 'modify' | 'delete',
    content: file.content || '',
    originalContent: undefined, // Would need original content for diff
  }));

  const previewResult = await generateCodePreview({
    files: filesForPreview,
    summary,
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Generate Code Preview',
    stepNumber,
    totalSteps,
    status: 'completed',
    startedAt: new Date(previewStart),
    completedAt: new Date(),
    metadata: {
      totalFiles: previewResult.preview.totalFiles,
      totalLinesChanged: previewResult.preview.totalLinesChanged,
    },
  });

  // Step 2: Post approval question to Linear
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Post Approval Request',
    stepNumber: stepNumber + 1,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const postStart = Date.now();

  // Build approval question text
  const questionText = buildApprovalQuestion({
    taskIdentifier: task.identifier,
    prTitle,
    branchName,
    fileCount: generatedFiles.length,
    validationSummary,
  });

  // Post question to Linear with preview
  const postResult = await postCodeQuestion({
    projectId,
    taskId,
    linearId,
    questionType: 'approval',
    question: questionText,
    preview: previewResult.preview,
    metadata: {
      workflowId: parentWorkflowId,
      stepNumber: stepNumber + 1,
      totalSteps,
      context: `Pre-PR approval for ${task.identifier}`,
      postedAt: new Date(),
      timeoutHours,
      taskIdentifier: task.identifier,
    },
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Post Approval Request',
    stepNumber: stepNumber + 1,
    totalSteps,
    status: 'completed',
    startedAt: new Date(postStart),
    completedAt: new Date(),
    metadata: {
      questionId: postResult.questionId,
      commentId: postResult.commentId,
    },
  });

  return {
    questionId: postResult.questionId,
    commentId: postResult.commentId,
    waitingForResponse: true,
    preview: {
      totalFiles: previewResult.preview.totalFiles,
      totalLinesChanged: previewResult.preview.totalLinesChanged,
      summary,
    },
  };
}

// ============================================
// Helper Functions
// ============================================

interface PreviewSummaryInput {
  branchName: string;
  prTitle: string;
  commitMessage: string;
  fileCount: number;
  validationSummary?: {
    success: boolean;
    testsRun: number;
    testsPassed: number;
    lintPassed: boolean;
    typecheckPassed: boolean;
  };
}

/**
 * Build summary text for code preview
 */
function buildPreviewSummary(input: PreviewSummaryInput): string {
  const { branchName, prTitle, commitMessage, fileCount, validationSummary } = input;

  let summary = `**Branch:** \`${branchName}\`\n`;
  summary += `**PR Title:** ${prTitle}\n`;
  summary += `**Commit:** ${commitMessage}\n`;
  summary += `**Files:** ${fileCount}\n\n`;

  if (validationSummary) {
    const status = validationSummary.success ? '✅ Passed' : '❌ Failed';
    summary += `**Validation:** ${status}\n`;
    summary += `- Lint: ${validationSummary.lintPassed ? '✅' : '❌'}\n`;
    summary += `- Typecheck: ${validationSummary.typecheckPassed ? '✅' : '❌'}\n`;
    summary += `- Tests: ${validationSummary.testsPassed}/${validationSummary.testsRun}\n`;
  }

  return summary;
}

interface ApprovalQuestionInput {
  taskIdentifier: string;
  prTitle: string;
  branchName: string;
  fileCount: number;
  validationSummary?: {
    success: boolean;
    testsRun: number;
    testsPassed: number;
    lintPassed: boolean;
    typecheckPassed: boolean;
  };
}

/**
 * Build approval question text
 */
function buildApprovalQuestion(input: ApprovalQuestionInput): string {
  const { taskIdentifier, prTitle, branchName, fileCount, validationSummary } = input;

  let question = `## Pre-PR Approval Request\n\n`;
  question += `Code generation for **${taskIdentifier}** is complete and ready for review.\n\n`;

  question += `### Details\n`;
  question += `- **PR Title:** ${prTitle}\n`;
  question += `- **Branch:** \`${branchName}\`\n`;
  question += `- **Files Changed:** ${fileCount}\n\n`;

  if (validationSummary) {
    question += `### Validation Results\n`;
    if (validationSummary.success) {
      question += `✅ All checks passed\n`;
    } else {
      question += `⚠️ Some checks failed\n`;
    }
    question += `- Lint: ${validationSummary.lintPassed ? '✅' : '❌'}\n`;
    question += `- Typecheck: ${validationSummary.typecheckPassed ? '✅' : '❌'}\n`;
    question += `- Tests: ${validationSummary.testsPassed}/${validationSummary.testsRun} passed\n\n`;
  }

  question += `Please review the code preview below and:\n`;
  question += `- Reply with \`APPROVE\` to create the PR\n`;
  question += `- Reply with \`REJECT:reason\` to request changes\n`;

  return question;
}
