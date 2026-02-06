/**
 * Solution Detection Step Workflow - Phase 4 Code Generation V3
 *
 * Detects multiple possible solutions when container validation fails.
 * Posts solution choice question to Linear if multiple solutions exist.
 *
 * Note: Signal handling for responses happens in the parent orchestrator.
 * This workflow only detects and posts the question.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type * as codeGenActivities from '@/activities/code-generation';
import type * as interactiveActivities from '@/activities/interactive.activities';
import type { WorkflowConfig, TechnicalPlanGenerationOutput, GeneratedFile, ExecuteInContainerOutput } from '@devflow/common';
import type { CodeQuestionOption } from '../../signals/code-question-response.signal';

const { logWorkflowProgress } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

const { detectMultipleSolutions } = proxyActivities<typeof codeGenActivities>({
  startToCloseTimeout: '3 minutes',
  retry: { maximumAttempts: 2 },
});

const { postCodeQuestion } = proxyActivities<typeof interactiveActivities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

// ============================================
// Types
// ============================================

export interface SolutionDetectionWorkflowInput {
  projectId: string;
  taskId: string;
  linearId: string;
  config?: WorkflowConfig;
  /** Workflow ID for progress logging and signal handling */
  parentWorkflowId: string;
  /** Organization ID for usage tracking */
  organizationId?: string;

  /** Task information */
  task: {
    id: string;
    linearId: string;
    title: string;
    identifier: string;
  };

  /** Generated files that failed validation */
  generatedFiles: GeneratedFile[];

  /** Container execution result with failure details */
  containerResult: ExecuteInContainerOutput;

  /** Technical plan for context */
  technicalPlan: TechnicalPlanGenerationOutput;

  /** Codebase context */
  codebaseContext?: string;

  /** Current attempt number */
  attemptNumber: number;
  /** Max retry attempts */
  maxAttempts: number;

  /** Current step number in parent workflow */
  stepNumber: number;
  /** Total steps in parent workflow */
  totalSteps: number;
}

export interface SolutionDetectionWorkflowOutput {
  /** Whether multiple solutions were detected */
  hasMultipleSolutions: boolean;

  /** If multiple solutions, the question ID for signal matching */
  questionId?: string;

  /** If multiple solutions, the options for the PO to choose from */
  options?: CodeQuestionOption[];

  /** If multiple solutions, the formatted question text */
  questionText?: string;

  /** Linear comment ID where question was posted */
  commentId?: string;

  /** Whether the workflow should wait for a response */
  waitingForResponse: boolean;

  /** If single solution, the auto-fix context for retry */
  singleSolutionContext?: string;

  /** Error analysis from detection */
  errorAnalysis: {
    phase: 'lint' | 'typecheck' | 'test';
    errorType: string;
    file: string;
    message: string;
    rootCause: string;
  };

  /** Recommended solution ID (if multiple) */
  recommendation?: string;
}

// ============================================
// Workflow
// ============================================

/**
 * Solution detection workflow for code generation phase (V3).
 * Detects multiple solutions after validation failure and posts choice question.
 */
export async function solutionDetectionWorkflow(
  input: SolutionDetectionWorkflowInput
): Promise<SolutionDetectionWorkflowOutput> {
  const {
    projectId,
    taskId,
    linearId,
    config,
    parentWorkflowId,
    organizationId,
    task,
    generatedFiles,
    containerResult,
    technicalPlan,
    codebaseContext,
    attemptNumber,
    maxAttempts,
    stepNumber,
    totalSteps,
  } = input;

  const timeoutHours = config?.automation?.phases?.codeGeneration?.features?.humanResponseTimeoutHours ?? 24;

  // Step 1: Detect solutions
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Detect Solution Options',
    stepNumber,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const detectStart = Date.now();

  const detection = await detectMultipleSolutions({
    task,
    generatedFiles,
    containerResult,
    technicalPlan,
    codebaseContext,
    attemptNumber,
    maxAttempts,
    projectId,
    organizationId,
    workflowId: parentWorkflowId,
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Detect Solution Options',
    stepNumber,
    totalSteps,
    status: 'completed',
    startedAt: new Date(detectStart),
    completedAt: new Date(),
    metadata: {
      hasMultipleSolutions: detection.hasMultipleSolutions,
      solutionCount: detection.solutions?.length || (detection.solution ? 1 : 0),
      errorType: detection.errorAnalysis.errorType,
      failedPhase: detection.errorAnalysis.phase,
    },
  });

  // If single solution, return context for auto-retry
  if (!detection.hasMultipleSolutions || !detection.solutions || detection.solutions.length === 0) {
    const singleSolution = detection.solution;
    return {
      hasMultipleSolutions: false,
      waitingForResponse: false,
      singleSolutionContext: singleSolution
        ? `${singleSolution.description}\n\nChanges needed:\n${singleSolution.changes}`
        : undefined,
      errorAnalysis: detection.errorAnalysis,
    };
  }

  // Step 2: Post solution choice question to Linear
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Post Solution Choice Question',
    stepNumber: stepNumber + 1,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const postStart = Date.now();

  // Build question text from detection
  const questionText = buildSolutionChoiceQuestion(detection.errorAnalysis, detection.solutions);

  // Build options from solutions
  const options: CodeQuestionOption[] = detection.solutions.map((sol) => ({
    id: sol.id,
    label: sol.label,
    description: `${sol.description}\n\n**Changes:** ${sol.changes}`,
    pros: sol.pros,
    cons: sol.cons,
    recommended: sol.recommended,
    effort: sol.risk === 'low' ? 'low' : sol.risk === 'high' ? 'high' : 'medium',
  }));

  // Post question to Linear
  const postResult = await postCodeQuestion({
    projectId,
    taskId,
    linearId,
    questionType: 'solution_choice',
    question: questionText,
    options,
    metadata: {
      workflowId: parentWorkflowId,
      stepNumber: stepNumber + 1,
      totalSteps,
      context: `Validation failed for ${task.identifier} - multiple solutions available`,
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
    stepName: 'Post Solution Choice Question',
    stepNumber: stepNumber + 1,
    totalSteps,
    status: 'completed',
    startedAt: new Date(postStart),
    completedAt: new Date(),
    metadata: {
      questionId: postResult.questionId,
      commentId: postResult.commentId,
      optionCount: options.length,
      recommendation: detection.recommendation,
    },
  });

  return {
    hasMultipleSolutions: true,
    questionId: postResult.questionId,
    options,
    questionText,
    commentId: postResult.commentId,
    waitingForResponse: true,
    errorAnalysis: detection.errorAnalysis,
    recommendation: detection.recommendation,
  };
}

// ============================================
// Helper Functions
// ============================================

interface SolutionOption {
  id: string;
  label: string;
  description: string;
  changes: string;
  pros: string[];
  cons: string[];
  risk: 'low' | 'medium' | 'high';
  recommended: boolean;
}

interface ErrorAnalysis {
  phase: 'lint' | 'typecheck' | 'test';
  errorType: string;
  file: string;
  message: string;
  rootCause: string;
}

/**
 * Build solution choice question text from error analysis and solutions
 */
function buildSolutionChoiceQuestion(
  errorAnalysis: ErrorAnalysis,
  solutions: SolutionOption[]
): string {
  let question = `## Validation Failed - Solution Choice Required\n\n`;

  question += `**Error in ${errorAnalysis.phase}:** ${errorAnalysis.errorType}\n`;
  question += `- File: \`${errorAnalysis.file}\`\n`;
  question += `- Message: ${errorAnalysis.message}\n`;
  question += `- Root cause: ${errorAnalysis.rootCause}\n\n`;

  question += `Multiple solutions are available to fix this issue.\n\n`;
  question += `Please choose an approach:`;

  return question;
}
