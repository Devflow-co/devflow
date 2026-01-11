/**
 * Ambiguity Detection Step Workflow - Phase 4 Code Generation V3
 *
 * Detects ambiguities in the technical plan before code generation.
 * Posts clarification question to Linear if ambiguities found.
 *
 * Note: Signal handling for responses happens in the parent orchestrator.
 * This workflow only detects and posts the question.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type * as codeGenActivities from '@/activities/code-generation.activities';
import type * as interactiveActivities from '@/activities/interactive.activities';
import type { WorkflowConfig, TechnicalPlanGenerationOutput } from '@devflow/common';
import type { CodeQuestionOption } from '../../signals/code-question-response.signal';

const { logWorkflowProgress } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

const { detectAmbiguityBeforeGeneration } = proxyActivities<typeof codeGenActivities>({
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

export interface AmbiguityDetectionWorkflowInput {
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
    description: string;
    identifier: string;
  };

  /** Technical plan from Phase 3 */
  technicalPlan: TechnicalPlanGenerationOutput;

  /** Codebase context (RAG chunks as string) */
  codebaseContext?: string;

  /** Current step number in parent workflow */
  stepNumber: number;
  /** Total steps in parent workflow */
  totalSteps: number;
}

export interface AmbiguityDetectionWorkflowOutput {
  /** Whether ambiguities were detected */
  hasAmbiguities: boolean;

  /** If ambiguities found, the question ID for signal matching */
  questionId?: string;

  /** If ambiguities found, the options for the PO to choose from */
  options?: CodeQuestionOption[];

  /** If ambiguities found, the formatted question text */
  questionText?: string;

  /** Linear comment ID where question was posted */
  commentId?: string;

  /** Whether the workflow should wait for a response */
  waitingForResponse: boolean;

  /** Detection confidence */
  confidence: 'high' | 'medium' | 'low';

  /** Raw detection output for logging */
  detectionResult?: {
    ambiguityCount: number;
    ambiguityTypes: string[];
  };
}

// ============================================
// Workflow
// ============================================

/**
 * Ambiguity detection workflow for code generation phase (V3).
 * Detects ambiguities in technical plan and posts clarification question.
 */
export async function ambiguityDetectionWorkflow(
  input: AmbiguityDetectionWorkflowInput
): Promise<AmbiguityDetectionWorkflowOutput> {
  const {
    projectId,
    taskId,
    linearId,
    config,
    parentWorkflowId,
    organizationId,
    task,
    technicalPlan,
    codebaseContext,
    stepNumber,
    totalSteps,
  } = input;

  const timeoutHours = config?.automation?.phases?.codeGeneration?.features?.humanResponseTimeoutHours ?? 24;

  // Step 1: Detect ambiguities
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Detect Ambiguities',
    stepNumber,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const detectStart = Date.now();

  const detection = await detectAmbiguityBeforeGeneration({
    task,
    technicalPlan,
    projectId,
    codebaseContext,
    organizationId,
    workflowId: parentWorkflowId,
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Detect Ambiguities',
    stepNumber,
    totalSteps,
    status: 'completed',
    startedAt: new Date(detectStart),
    completedAt: new Date(),
    metadata: {
      hasAmbiguities: detection.hasAmbiguities,
      ambiguityCount: detection.ambiguities.length,
      confidence: detection.confidence,
    },
  });

  // If no ambiguities, return early
  if (!detection.hasAmbiguities || detection.ambiguities.length === 0) {
    return {
      hasAmbiguities: false,
      waitingForResponse: false,
      confidence: detection.confidence,
    };
  }

  // Step 2: Post clarification question to Linear
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Post Clarification Question',
    stepNumber: stepNumber + 1,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const postStart = Date.now();

  // Build question text from detected ambiguities
  const questionText = buildClarificationQuestion(detection.analysis, detection.ambiguities);

  // Build options from the first ambiguity's options
  const primaryAmbiguity = detection.ambiguities[0];
  const options: CodeQuestionOption[] = primaryAmbiguity.options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    description: opt.description,
    pros: opt.pros,
    cons: opt.cons,
    recommended: opt.recommended,
  }));

  // Post question to Linear
  const postResult = await postCodeQuestion({
    projectId,
    taskId,
    linearId,
    questionType: 'clarification',
    question: questionText,
    options,
    metadata: {
      workflowId: parentWorkflowId,
      stepNumber: stepNumber + 1,
      totalSteps,
      context: `Ambiguity detected in technical plan for ${task.identifier}`,
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
    stepName: 'Post Clarification Question',
    stepNumber: stepNumber + 1,
    totalSteps,
    status: 'completed',
    startedAt: new Date(postStart),
    completedAt: new Date(),
    metadata: {
      questionId: postResult.questionId,
      commentId: postResult.commentId,
      optionCount: options.length,
    },
  });

  return {
    hasAmbiguities: true,
    questionId: postResult.questionId,
    options,
    questionText,
    commentId: postResult.commentId,
    waitingForResponse: true,
    confidence: detection.confidence,
    detectionResult: {
      ambiguityCount: detection.ambiguities.length,
      ambiguityTypes: detection.ambiguities.map((a) => a.type),
    },
  };
}

// ============================================
// Helper Functions
// ============================================

interface DetectedAmbiguity {
  id: string;
  type: 'architectural' | 'integration' | 'behavior' | 'data' | 'api';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  options: Array<{
    id: string;
    label: string;
    description: string;
    pros: string[];
    cons: string[];
    recommended: boolean;
  }>;
}

/**
 * Build clarification question text from detected ambiguities
 */
function buildClarificationQuestion(analysis: string, ambiguities: DetectedAmbiguity[]): string {
  let question = `${analysis}\n\n`;

  if (ambiguities.length === 1) {
    const amb = ambiguities[0];
    question += `**${amb.title}** (${amb.type}, impact: ${amb.impact})\n\n`;
    question += `${amb.description}\n\n`;
    question += `Please choose an approach:`;
  } else {
    question += `The following ambiguities were detected:\n\n`;
    for (const amb of ambiguities) {
      question += `- **${amb.title}** (${amb.type}, impact: ${amb.impact}): ${amb.description}\n`;
    }
    question += `\nPlease choose an approach for the primary ambiguity:`;
  }

  return question;
}
