/**
 * User Story Activities - Phase 2 of Three-Phase Agile Workflow
 *
 * Generates formal user stories from refined requirements.
 * Focus: User story format, acceptance criteria, definition of done, story points
 */

import { createLogger, extractAIMetrics } from '@devflow/common';
import type {
  RefinementOutput,
  UserStoryGenerationOutput,
  StepAIMetrics,
  StepResultSummary,
} from '@devflow/common';
import { createCodeAgentDriver, loadPrompts } from '@devflow/sdk';
import { trackLLMUsage, getOrganizationIdFromProject } from '../utils/usage-tracking';

const logger = createLogger('UserStoryActivities');

export interface GenerateUserStoryInput {
  task: {
    title: string;
    description: string;
    priority: string;
  };
  refinement: RefinementOutput;
  projectId: string;
  /** Task ID for usage tracking aggregation */
  taskId?: string;
  /** Organization ID for usage tracking (will be looked up if not provided) */
  organizationId?: string;
  /** Workflow ID for usage tracking */
  workflowId?: string;
  /** Codebase context markdown (from Phase 1 document) */
  codebaseContext?: string;
  /** Documentation context markdown (from Phase 1 document) */
  documentationContext?: string;
  /** AI model to use for generation (from automation config) */
  aiModel?: string;
}

export interface GenerateUserStoryOutput {
  userStory: UserStoryGenerationOutput;
  /** AI metrics for workflow step logging */
  aiMetrics?: StepAIMetrics;
  /** Result summary for workflow step logging */
  resultSummary?: StepResultSummary;
}

/**
 * Generate user story from refinement using AI
 */
export async function generateUserStory(
  input: GenerateUserStoryInput
): Promise<GenerateUserStoryOutput> {
  logger.info('Generating user story', {
    taskTitle: input.task.title,
    projectId: input.projectId,
    hasCodebaseContext: !!input.codebaseContext,
    hasDocumentationContext: !!input.documentationContext,
  });

  try {
    // Build combined context (documentation + codebase)
    let combinedContext = '';
    if (input.documentationContext) {
      combinedContext += input.documentationContext + '\n\n---\n\n';
    }
    if (input.codebaseContext) {
      combinedContext += input.codebaseContext;
    }
    if (!combinedContext) {
      combinedContext = 'No context available';
    }

    // Load prompts with refinement context and combined context
    const prompts = await loadPrompts('user-story', {
      taskTitle: input.task.title,
      taskPriority: input.task.priority,
      refinementContext: input.refinement.businessContext,
      refinementObjectives: input.refinement.objectives.join('\n- '),
      codebaseContext: combinedContext,
    });

    // Generate with AI (single model - council only for Phase 3)
    // Use aiModel from automation config, fallback to env var or default
    const modelToUse = input.aiModel || process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
    logger.info('Generating user story with model', { model: modelToUse });

    const agent = createCodeAgentDriver({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: modelToUse,
    });

    const response = await agent.generate(prompts);
    const userStory = parseUserStoryResponse(response.content);

    // Track LLM usage for billing/analytics
    const orgId = input.organizationId || await getOrganizationIdFromProject(input.projectId);
    if (orgId && input.workflowId) {
      await trackLLMUsage({
        organizationId: orgId,
        workflowId: input.workflowId,
        provider: 'openrouter',
        model: modelToUse,
        response,
        context: {
          taskId: input.taskId,
          projectId: input.projectId,
          phase: 'user_story',
        },
      });
    }

    // Extract AI metrics for logging
    const aiMetrics = extractAIMetrics(response, 'openrouter');

    // Build result summary
    const resultSummary: StepResultSummary = {
      type: 'user_story',
      summary: `Generated user story with ${userStory.acceptanceCriteria?.length || 0} acceptance criteria, ${userStory.storyPoints || 0} story points`,
      itemsCount: userStory.acceptanceCriteria?.length || 0,
      wordCount: response.content.split(/\s+/).length,
    };

    logger.info('User story generated successfully', {
      model: modelToUse,
      usageTracked: !!(orgId && input.workflowId),
      aiMetrics: {
        inputTokens: aiMetrics.inputTokens,
        outputTokens: aiMetrics.outputTokens,
        totalCost: aiMetrics.totalCost,
        latencyMs: aiMetrics.latencyMs,
      },
    });

    return { userStory, aiMetrics, resultSummary };
  } catch (error) {
    logger.error('Failed to generate user story', error);
    throw error;
  }
}

/**
 * Parse JSON response from AI into UserStoryGenerationOutput
 */
function parseUserStoryResponse(content: string): UserStoryGenerationOutput {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonString);

    return {
      userStory: {
        actor: parsed.userStory?.actor || 'user',
        goal: parsed.userStory?.goal || '',
        benefit: parsed.userStory?.benefit || '',
      },
      acceptanceCriteria: parsed.acceptanceCriteria || [],
      definitionOfDone: parsed.definitionOfDone || [],
      businessValue: parsed.businessValue || '',
      storyPoints: parsed.storyPoints || 5,
    };
  } catch (error) {
    logger.error('Failed to parse user story response', error as Error, { content });
    throw new Error(
      `Failed to parse user story JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

