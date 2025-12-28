/**
 * Technical Plan Workflow - Phase 3 of Three-Phase Agile Workflow
 *
 * Generates detailed technical implementation plans from user stories.
 * Focus: Architecture, implementation steps, testing strategy, risk analysis
 * Uses RAG context for codebase-aware planning
 */

import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowConfig, AutomationConfig, TechnicalPlanPhaseConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';
import type * as activities from '@/activities';

// Proxy activities with 10-minute timeout (AI generation takes time)
const {
  syncLinearTask,
  updateLinearTask,
  fetchBestPractices,
  saveBestPracticesDocument,
  generateTechnicalPlan,
  appendTechnicalPlanToLinearIssue,
  getPhaseDocumentContent,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export interface TechnicalPlanWorkflowInput {
  taskId: string;
  projectId: string;
  config?: WorkflowConfig;
}

export interface TechnicalPlanWorkflowResult {
  success: boolean;
  phase: 'technical_plan';
  message: string;
  plan?: any;
}

/**
 * Parse user story from Linear Document content
 * Used when User Story is stored in a separate document (new format)
 * Document format is cleaner - direct markdown structure
 */
function parseUserStoryFromDocument(documentContent: string): any {
  // Document format has clear H2 sections with ## headers
  const actorMatch = documentContent.match(/\*\*As a\*\* ([^,\n]+)/);
  const goalMatch = documentContent.match(/\*\*I want\*\* ([^,\n]+)/);
  const benefitMatch = documentContent.match(/\*\*So that\*\* ([^.\n]+)/);

  const actor = actorMatch ? actorMatch[1].trim() : 'user';
  const goal = goalMatch ? goalMatch[1].trim() : '';
  const benefit = benefitMatch ? benefitMatch[1].trim() : '';

  // Extract acceptance criteria
  const criteriaMatch = documentContent.match(/## Acceptance Criteria\n\n([\s\S]*?)(?=\n---|\n## |$)/);
  const acceptanceCriteria = criteriaMatch
    ? criteriaMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  // Extract definition of done
  const dodMatch = documentContent.match(/## Definition of Done\n\n([\s\S]*?)(?=\n---|\n## |$)/);
  const definitionOfDone = dodMatch
    ? dodMatch[1]
        .split('\n')
        .filter((line) => line.match(/^-/))
        .map((line) => line.replace(/^-\s*(\[[ x]\]\s*)?/, '').trim())
    : [];

  // Extract business value
  const businessValueMatch = documentContent.match(/## Business Value\n\n([\s\S]*?)(?=\n---|\n## |$)/);
  const businessValue = businessValueMatch ? businessValueMatch[1].trim() : '';

  // Extract story points
  const storyPointsMatch = documentContent.match(/\*\*Story Points:\*\* (\d+)/);
  const storyPoints = storyPointsMatch ? parseInt(storyPointsMatch[1], 10) : 5;

  return {
    userStory: {
      actor,
      goal,
      benefit,
    },
    acceptanceCriteria,
    definitionOfDone,
    businessValue,
    storyPoints,
  };
}

/**
 * Parse Codebase Context document back to RAG-like format
 * Used to reconstruct RAG context from the stored markdown document
 */
function parseCodebaseContextDocument(documentContent: string): {
  chunks: Array<{
    filePath: string;
    content: string;
    score: number;
    language: string;
    startLine?: number;
    endLine?: number;
    chunkType?: string;
  }>;
  retrievalTimeMs: number;
  totalChunks: number;
} | null {
  if (!documentContent) return null;

  const chunks: Array<{
    filePath: string;
    content: string;
    score: number;
    language: string;
    startLine?: number;
    endLine?: number;
    chunkType?: string;
  }> = [];

  // Match each code section: ### 1. `path/to/file.ts`
  // Format: **Score:** 92.3% | **Language:** typescript
  // **Lines:** 45-120
  // **Type:** class
  // ```typescript
  // code...
  // ```
  const sectionRegex = /###\s*\d+\.\s*`([^`]+)`\n\n\*\*Score:\*\*\s*([\d.]+)%\s*\|\s*\*\*Language:\*\*\s*(\w+)(?:\n\*\*Lines:\*\*\s*(\d+)-(\d+))?(?:\n\*\*Type:\*\*\s*(\w+))?[\s\S]*?```\w*\n([\s\S]*?)```/g;

  let match;
  while ((match = sectionRegex.exec(documentContent)) !== null) {
    const [, filePath, scoreStr, language, startLineStr, endLineStr, chunkType, content] = match;

    chunks.push({
      filePath,
      content: content.trim(),
      score: parseFloat(scoreStr) / 100, // Convert percentage to 0-1 range
      language,
      startLine: startLineStr ? parseInt(startLineStr, 10) : undefined,
      endLine: endLineStr ? parseInt(endLineStr, 10) : undefined,
      chunkType: chunkType || undefined,
    });
  }

  if (chunks.length === 0) return null;

  return {
    chunks,
    retrievalTimeMs: 0, // Not available from document
    totalChunks: chunks.length,
  };
}

/**
 * Extract user story from Linear issue description (legacy format)
 * Used as fallback when User Story is embedded in issue description
 */
function extractUserStoryFromDescription(description: string): any {
  // Simple extraction for now
  // The user story is appended as markdown in the format:
  // # User Story
  // > Generated by DevFlow - Phase 2: User Story
  // ...

  const userStoryMatch = description.match(/# User Story[\s\S]*?(?=\n# |$)/);
  if (!userStoryMatch) {
    // Try phase section format (## 2️⃣ Phase 2: User Story)
    const phaseMatch = description.match(/## 2️⃣ Phase 2: User Story[\s\S]*?(?=\n## [123]️⃣|$)/);
    if (phaseMatch) {
      return parseUserStoryFromDocument(phaseMatch[0]);
    }

    // If no user story found, return minimal user story object
    return {
      userStory: {
        actor: 'user',
        goal: description.split('\n')[0] || 'Complete the task',
        benefit: 'improve the application',
      },
      acceptanceCriteria: [],
      definitionOfDone: [],
      businessValue: '',
      storyPoints: 5,
    };
  }

  const userStoryText = userStoryMatch[0];

  // Extract user story components
  const actorMatch = userStoryText.match(/\*\*As a\*\* ([^,\n]+)/);
  const goalMatch = userStoryText.match(/\*\*I want\*\* ([^,\n]+)/);
  const benefitMatch = userStoryText.match(/\*\*So that\*\* ([^.\n]+)/);

  const actor = actorMatch ? actorMatch[1].trim() : 'user';
  const goal = goalMatch ? goalMatch[1].trim() : '';
  const benefit = benefitMatch ? benefitMatch[1].trim() : '';

  // Extract acceptance criteria
  const criteriaMatch = userStoryText.match(/## Acceptance Criteria\n\n([\s\S]*?)(?=\n## |$)/);
  const acceptanceCriteria = criteriaMatch
    ? criteriaMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  // Extract definition of done
  const dodMatch = userStoryText.match(/## Definition of Done\n\n([\s\S]*?)(?=\n## |$)/);
  const definitionOfDone = dodMatch
    ? dodMatch[1]
        .split('\n')
        .filter((line) => line.match(/^-/))
        .map((line) => line.replace(/^-\s*/, '').trim())
    : [];

  // Extract business value
  const businessValueMatch = userStoryText.match(/## Business Value\n\n([\s\S]*?)(?=\n## |$)/);
  const businessValue = businessValueMatch ? businessValueMatch[1].trim() : '';

  // Extract story points
  const storyPointsMatch = userStoryText.match(/\*\*Story Points:\*\* (\d+)/);
  const storyPoints = storyPointsMatch ? parseInt(storyPointsMatch[1], 10) : 5;

  return {
    userStory: {
      actor,
      goal,
      benefit,
    },
    acceptanceCriteria,
    definitionOfDone,
    businessValue,
    storyPoints,
  };
}

/**
 * Technical Plan Workflow
 * Phase 3: Create detailed technical implementation plan with codebase context
 */
export async function technicalPlanWorkflow(
  input: TechnicalPlanWorkflowInput
): Promise<TechnicalPlanWorkflowResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  // Get automation config with defaults
  const automation: TechnicalPlanPhaseConfig = config.automation?.phases?.technicalPlan ||
    DEFAULT_AUTOMATION_CONFIG.phases.technicalPlan;
  const features = automation.features;

  try {
    // Step 1: Sync task from Linear
    const task = await syncLinearTask({
      taskId: input.taskId,
      projectId: input.projectId,
    });

    // Step 2: Update status to Plan In Progress (conditional)
    if (features.enableAutoStatusUpdate) {
      await updateLinearTask({
        projectId: input.projectId,
        linearId: task.linearId,
        updates: { status: LINEAR_STATUSES.planInProgress },
      });
    }

    // Step 3: Load Codebase Context document (created in Phase 1) - conditional
    let ragContext: ReturnType<typeof parseCodebaseContextDocument> = null;
    if (features.reuseCodebaseContext) {
      const codebaseContextDoc = await getPhaseDocumentContent({
        projectId: input.projectId,
        linearId: task.linearId,
        phase: 'codebase_context',
      });

      // Parse document back to RAG-like format
      ragContext = codebaseContextDoc.content
        ? parseCodebaseContextDocument(codebaseContextDoc.content)
        : null;

      if (ragContext) {
        console.log('[technicalPlanWorkflow] Codebase context loaded from document with', ragContext.chunks.length, 'chunks');
      } else {
        console.log('[technicalPlanWorkflow] No codebase context document found');
      }
    } else {
      console.log('[technicalPlanWorkflow] Codebase context reuse disabled');
    }

    // Step 3.5: Load Documentation Context document (created in Phase 1) - conditional
    let documentationContext: string | undefined;
    if (features.reuseDocumentationContext) {
      const documentationContextDoc = await getPhaseDocumentContent({
        projectId: input.projectId,
        linearId: task.linearId,
        phase: 'documentation_context',
      });

      if (documentationContextDoc.content) {
        console.log('[technicalPlanWorkflow] Documentation context loaded from document');
        documentationContext = documentationContextDoc.content;
      } else {
        console.log('[technicalPlanWorkflow] No documentation context document found');
      }
    } else {
      console.log('[technicalPlanWorkflow] Documentation context reuse disabled');
    }

    // Step 4: Get User Story - try document first, then fallback to description
    let userStory: any;

    // Try to get from Linear Document first (new format)
    const userStoryDoc = await getPhaseDocumentContent({
      projectId: input.projectId,
      linearId: task.linearId,
      phase: 'user_story',
    });

    if (userStoryDoc.content) {
      // Parse from document content
      console.log('[technicalPlanWorkflow] User story loaded from document');
      userStory = parseUserStoryFromDocument(userStoryDoc.content);
    } else {
      // Fallback to description extraction (backward compatibility)
      console.log('[technicalPlanWorkflow] User story extracted from description (fallback)');
      userStory = extractUserStoryFromDescription(task.description);
    }

    // Step 5: Fetch best practices from Perplexity (conditional)
    const taskLanguage = ragContext?.chunks?.[0]?.language;
    let bestPracticesResult: Awaited<ReturnType<typeof fetchBestPractices>> | undefined;

    if (features.enableBestPracticesQuery) {
      bestPracticesResult = await fetchBestPractices({
        task: {
          title: task.title,
          description: task.description,
        },
        projectId: input.projectId,
        context: taskLanguage
          ? {
              language: taskLanguage,
              framework: undefined, // TODO: Extract framework from RAG context
            }
          : undefined,
      });

      // Step 5b: Save best practices as a Linear document
      if (bestPracticesResult.bestPractices && bestPracticesResult.bestPractices !== 'Unable to fetch best practices at this time.') {
        await saveBestPracticesDocument({
          projectId: input.projectId,
          linearId: task.linearId,
          bestPractices: bestPracticesResult,
          taskContext: {
            title: task.title,
            language: taskLanguage,
            framework: undefined,
          },
        });
        console.log('[technicalPlanWorkflow] Best practices document created');
      }
    } else {
      console.log('[technicalPlanWorkflow] Best practices query disabled');
    }

    // Step 6: Generate technical plan with best practices
    // Pass aiModel and Council AI configuration from automation config
    const result = await generateTechnicalPlan({
      task,
      projectId: input.projectId,
      userStory,
      ragContext,
      bestPractices: bestPracticesResult,
      documentationContext,
      aiModel: automation.aiModel,
      enableCouncilAI: features.enableCouncilAI,
      councilModels: automation.councilModels,
      councilChairmanModel: automation.councilChairmanModel,
    });

    // Step 7: Append technical plan to Linear issue (with council summary if enabled)
    await appendTechnicalPlanToLinearIssue({
      projectId: input.projectId,
      linearId: task.linearId,
      plan: result.plan,
      contextUsed: result.contextUsed,
      council: result.council,
      bestPractices: bestPracticesResult,
    });

    // Step 8: Update status to Plan Ready (conditional)
    if (features.enableAutoStatusUpdate) {
      await updateLinearTask({
        projectId: input.projectId,
        linearId: task.linearId,
        updates: { status: LINEAR_STATUSES.planReady },
      });
    }

    return {
      success: true,
      phase: 'technical_plan',
      message: `Technical plan generated for task ${task.identifier}`,
      plan: result.plan,
    };
  } catch (error) {
    // Update status to Plan Failed (conditional)
    if (features.enableAutoStatusUpdate) {
      try {
        const task = await syncLinearTask({
          taskId: input.taskId,
          projectId: input.projectId,
        });

        await updateLinearTask({
          projectId: input.projectId,
          linearId: task.linearId,
          updates: { status: LINEAR_STATUSES.planFailed },
        });
      } catch (updateError) {
        // Log but don't throw - original error is more important
        console.error('Failed to update status to planFailed:', updateError);
      }
    }

    // Throw original error
    throw ApplicationFailure.create({
      message: `Technical plan workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'TechnicalPlanWorkflowFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
