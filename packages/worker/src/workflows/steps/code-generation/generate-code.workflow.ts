/**
 * Generate Code Step Workflow - Phase 4 Code Generation
 *
 * Generates code using AI from technical plan and codebase context.
 * Uses Ollama (local LLM) for privacy-first code generation.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type * as codeGenActivities from '@/activities/code-generation.activities';
import type { WorkflowConfig, TechnicalPlanGenerationOutput, GeneratedFile, StepAIMetrics } from '@devflow/common';

const { logWorkflowProgress } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

const { generateCodeFromPlan } = proxyActivities<typeof codeGenActivities>({
  startToCloseTimeout: '10 minutes', // Code generation can take time
  retry: { maximumAttempts: 2 },
});

// ============================================
// Types
// ============================================

export interface GenerateCodeWorkflowInput {
  projectId: string;
  taskId: string;
  config?: WorkflowConfig;
  /** Workflow ID for progress logging */
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

  /** Codebase context (RAG chunks) */
  codebaseContext?: string;

  /** Full file contents for files to modify */
  fullFileContents?: Array<{
    path: string;
    content: string;
  }>;

  /** Error context from previous retry attempts */
  errorContext?: string;

  /** Number of previous retry attempts */
  previousAttempts: number;

  /** Max retry attempts allowed */
  maxRetries: number;
}

export interface GenerateCodeWorkflowOutput {
  /** Generated files */
  files: GeneratedFile[];
  /** Branch name for the changes */
  branchName: string;
  /** PR title */
  prTitle: string;
  /** PR description */
  prDescription: string;
  /** Commit message */
  commitMessage: string;
  /** AI metrics for logging */
  aiMetrics?: StepAIMetrics;
}

// ============================================
// Workflow
// ============================================

/**
 * Generate code workflow for code generation phase.
 * Calls AI (Ollama) to generate code from technical plan and context.
 */
export async function generateCodeWorkflow(
  input: GenerateCodeWorkflowInput
): Promise<GenerateCodeWorkflowOutput> {
  const {
    projectId,
    taskId,
    parentWorkflowId,
    organizationId,
    task,
    technicalPlan,
    codebaseContext,
    fullFileContents,
    errorContext,
    previousAttempts,
    maxRetries,
  } = input;

  const isRetry = previousAttempts > 0;
  const stepName = isRetry
    ? `Generate Code (Retry ${previousAttempts}/${maxRetries})`
    : 'Generate Code';

  // Step: Generate code with AI
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName,
    stepNumber: 1,
    totalSteps: 1,
    status: 'in_progress',
    startedAt: new Date(),
    metadata: {
      isRetry,
      previousAttempts,
      hasErrorContext: !!errorContext,
    },
  });

  const genStart = Date.now();

  // Build RAG context object
  const ragContext = codebaseContext
    ? {
        chunks: parseCodebaseContextToChunks(codebaseContext),
      }
    : undefined;

  // Build enhanced description with error context if retrying
  let enhancedDescription = task.description || '';
  if (errorContext) {
    enhancedDescription += `\n\n## IMPORTANT: Previous Attempt Failed\n\n${errorContext}\n\nPlease fix the issues mentioned above.`;
  }

  // Generate code using AI activity
  const result = await generateCodeFromPlan({
    task: {
      ...task,
      description: enhancedDescription,
    },
    technicalPlan,
    projectId,
    taskId,
    organizationId,
    workflowId: parentWorkflowId,
    ragContext,
    fullFileContents,
  });

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName,
    stepNumber: 1,
    totalSteps: 1,
    status: 'completed',
    startedAt: new Date(genStart),
    completedAt: new Date(),
    metadata: {
      filesGenerated: result.code.files.length,
      branchName: result.code.branchName,
      latencyMs: result.aiMetrics?.latencyMs,
      model: 'ollama',
      isRetry,
    },
  });

  return {
    files: result.code.files,
    branchName: result.code.branchName,
    prTitle: result.code.prTitle,
    prDescription: result.code.prDescription,
    commitMessage: result.code.commitMessage,
    aiMetrics: result.aiMetrics,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse codebase context string into RAG chunks
 */
function parseCodebaseContextToChunks(
  context: string
): Array<{ filePath: string; content: string; score: number; language: string }> {
  const chunks: Array<{ filePath: string; content: string; score: number; language: string }> = [];

  // Parse code blocks with file paths
  const codeBlockRegex = /### `([^`]+)`[^\n]*\n\n```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(context)) !== null) {
    chunks.push({
      filePath: match[1],
      content: match[3],
      score: 1.0,
      language: match[2] || 'text',
    });
  }

  return chunks;
}
