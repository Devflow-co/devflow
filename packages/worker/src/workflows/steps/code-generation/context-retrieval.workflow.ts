/**
 * Context Retrieval Step Workflow - Phase 4 Code Generation
 *
 * Retrieves technical plan, codebase context, and full file contents.
 */

import { proxyActivities, executeChild } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type * as codeGenActivities from '@/activities/code-generation';
import { getPhaseDocumentWorkflow } from '../common/get-phase-document.workflow';
import type { WorkflowConfig } from '@devflow/common';

const { logWorkflowProgress } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

const { fetchFilesFromGitHub } = proxyActivities<typeof codeGenActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
});

// ============================================
// Types
// ============================================

export interface ContextRetrievalInput {
  projectId: string;
  taskId: string;
  linearId: string;
  config?: WorkflowConfig;
  /** Workflow ID for progress logging */
  parentWorkflowId: string;
}

export interface ParsedTechnicalPlan {
  summary?: string;
  architecture?: Array<{
    approach: string;
    components: Array<{ name: string; responsibility: string; interactions: string[] }>;
  }>;
  implementationSteps?: Array<{
    order: number;
    title: string;
    description: string;
    files: string[];
    estimatedEffort: string;
  }>;
  filesAffected?: string[];
  testingStrategy?: {
    unitTests: string[];
    integrationTests: string[];
    e2eTests?: string[];
  };
  /** Identified risks and mitigations */
  risks?: string[];
}

export interface CodebaseContextChunk {
  filePath: string;
  content: string;
  score: number;
  language: string;
  startLine?: number;
  endLine?: number;
  chunkType?: string;
}

export interface FullFileContent {
  path: string;
  content: string;
  sha?: string;
}

export interface ContextRetrievalOutput {
  technicalPlan: ParsedTechnicalPlan;
  technicalPlanRaw: string | null;
  codebaseContext: CodebaseContextChunk[] | null;
  fullFileContents: FullFileContent[];
  filesNotFound: string[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse technical plan document content
 */
function parseTechnicalPlan(content: string | null): ParsedTechnicalPlan {
  if (!content) return {};

  // Simple parsing - extract sections from markdown
  const plan: ParsedTechnicalPlan = {};

  // Extract summary (first paragraph or section)
  const summaryMatch = content.match(/## Summary\n([\s\S]*?)(?=\n##|$)/);
  if (summaryMatch) {
    plan.summary = summaryMatch[1].trim();
  }

  // Extract files affected (look for file paths)
  const fileMatches = content.match(/`([^`]+\.(ts|tsx|js|jsx|py|go|rs|java|kt|swift|rb))`/g);
  if (fileMatches) {
    plan.filesAffected = [...new Set(fileMatches.map(m => m.replace(/`/g, '')))];
  }

  // Extract implementation steps
  const stepsMatch = content.match(/## Implementation Steps?\n([\s\S]*?)(?=\n##|$)/);
  if (stepsMatch) {
    const stepsContent = stepsMatch[1];
    const stepMatches = stepsContent.match(/\d+\.\s+\*\*([^*]+)\*\*([^]*?)(?=\d+\.\s+\*\*|$)/g);
    if (stepMatches) {
      plan.implementationSteps = stepMatches.map((step, index) => {
        const titleMatch = step.match(/\d+\.\s+\*\*([^*]+)\*\*/);
        const filesInStep = step.match(/`([^`]+\.(ts|tsx|js|jsx|py|go|rs|java|kt|swift|rb))`/g);
        return {
          order: index + 1,
          title: titleMatch ? titleMatch[1].trim() : `Step ${index + 1}`,
          description: step.replace(/\d+\.\s+\*\*[^*]+\*\*/, '').trim(),
          files: filesInStep ? [...new Set(filesInStep.map(f => f.replace(/`/g, '')))] : [],
          estimatedEffort: 'medium',
        };
      });
    }
  }

  // Extract risks section
  const risksMatch = content.match(/## Risks?\n([\s\S]*?)(?=\n##|$)/);
  if (risksMatch) {
    const risksContent = risksMatch[1];
    // Extract bullet points or numbered items
    const riskItems = risksContent.match(/[-*]\s+(.+)/g) || risksContent.match(/\d+\.\s+(.+)/g);
    if (riskItems) {
      plan.risks = riskItems.map(r => r.replace(/^[-*\d.]+\s+/, '').trim());
    }
  }

  return plan;
}

/**
 * Parse codebase context document content
 */
function parseCodebaseContext(content: string | null): CodebaseContextChunk[] | null {
  if (!content) return null;

  const chunks: CodebaseContextChunk[] = [];

  // Look for code blocks with file paths
  const codeBlockRegex = /### `([^`]+)`[\s\S]*?```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    chunks.push({
      filePath: match[1],
      content: match[3],
      score: 1.0, // Default score from document
      language: match[2] || 'text',
    });
  }

  return chunks.length > 0 ? chunks : null;
}

// ============================================
// Workflow
// ============================================

/**
 * Context retrieval workflow for code generation phase.
 * Fetches technical plan, codebase context, and full file contents.
 */
export async function contextRetrievalWorkflow(
  input: ContextRetrievalInput
): Promise<ContextRetrievalOutput> {
  const { projectId, taskId, linearId, config, parentWorkflowId } = input;
  const features = config?.automation?.phases?.codeGeneration?.features;
  const reuseTechnicalPlan = features?.reuseTechnicalPlan ?? true;
  const reuseCodebaseContext = features?.reuseCodebaseContext ?? true;

  let stepNumber = 1;
  const totalSteps = 4;

  // Step 1: Get Technical Plan document
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Get Technical Plan Document',
    stepNumber,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
  });

  const planStart = Date.now();
  let technicalPlanRaw: string | null = null;

  if (reuseTechnicalPlan) {
    const planDoc = await executeChild(getPhaseDocumentWorkflow, {
      workflowId: `context-plan-${taskId}-${Date.now()}`,
      args: [{ projectId, linearId, phase: 'technical_plan' as const }],
    });
    technicalPlanRaw = planDoc.content;
  }

  const technicalPlan = parseTechnicalPlan(technicalPlanRaw);

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Get Technical Plan Document',
    stepNumber,
    totalSteps,
    status: 'completed',
    startedAt: new Date(planStart),
    completedAt: new Date(),
    metadata: {
      hasDocument: !!technicalPlanRaw,
      filesCount: technicalPlan.filesAffected?.length || 0,
      stepsCount: technicalPlan.implementationSteps?.length || 0,
    },
  });
  stepNumber++;

  // Step 2: Parse technical plan (quick local operation)
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Parse Technical Plan',
    stepNumber,
    totalSteps,
    status: 'completed',
    startedAt: new Date(),
    completedAt: new Date(),
    metadata: {
      architectureCount: technicalPlan.architecture?.length || 0,
      stepsCount: technicalPlan.implementationSteps?.length || 0,
      filesCount: technicalPlan.filesAffected?.length || 0,
    },
  });
  stepNumber++;

  // Step 3: Get Codebase Context document
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: 'Get Codebase Context Document',
    stepNumber,
    totalSteps,
    status: reuseCodebaseContext ? 'in_progress' : 'skipped',
    startedAt: new Date(),
  });

  let codebaseContext: CodebaseContextChunk[] | null = null;

  if (reuseCodebaseContext) {
    const contextStart = Date.now();
    const contextDoc = await executeChild(getPhaseDocumentWorkflow, {
      workflowId: `context-rag-${taskId}-${Date.now()}`,
      args: [{ projectId, linearId, phase: 'codebase_context' as const }],
    });
    codebaseContext = parseCodebaseContext(contextDoc.content);

    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Get Codebase Context Document',
      stepNumber,
      totalSteps,
      status: 'completed',
      startedAt: new Date(contextStart),
      completedAt: new Date(),
      metadata: { hasContext: !!codebaseContext, chunksCount: codebaseContext?.length || 0 },
    });
  } else {
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Get Codebase Context Document (disabled)',
      stepNumber,
      totalSteps,
      status: 'skipped',
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { reason: 'reuseCodebaseContext is disabled' },
    });
  }
  stepNumber++;

  // Step 4: Fetch full file contents from GitHub
  const filesAffected = technicalPlan.filesAffected || [];
  let fullFileContents: FullFileContent[] = [];
  let filesNotFound: string[] = [];

  if (filesAffected.length > 0) {
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Fetch Full Files from GitHub',
      stepNumber,
      totalSteps,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const fetchStart = Date.now();
    const fetchResult = await fetchFilesFromGitHub({
      projectId,
      filePaths: filesAffected,
    });

    fullFileContents = fetchResult.files;
    filesNotFound = fetchResult.notFound;

    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Fetch Full Files from GitHub',
      stepNumber,
      totalSteps,
      status: 'completed',
      startedAt: new Date(fetchStart),
      completedAt: new Date(),
      metadata: {
        filesRequested: filesAffected.length,
        filesFetched: fullFileContents.length,
        filesNotFound: filesNotFound.length,
        notFoundFiles: filesNotFound,
      },
    });
  } else {
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Fetch Full Files from GitHub (no files)',
      stepNumber,
      totalSteps,
      status: 'skipped',
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { reason: 'No files affected in technical plan' },
    });
  }

  return {
    technicalPlan,
    technicalPlanRaw,
    codebaseContext,
    fullFileContents,
    filesNotFound,
  };
}
