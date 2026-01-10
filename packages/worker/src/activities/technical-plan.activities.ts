/**
 * Technical Plan Activities - Phase 3 of Three-Phase Agile Workflow
 *
 * Generates detailed technical implementation plans from user stories.
 * Focus: Architecture, implementation steps, testing strategy, risk analysis
 * Uses RAG context for codebase-aware planning
 */

import axios from 'axios';
import { createLogger, extractAIMetrics } from '@devflow/common';
import type {
  TechnicalPlanGenerationInput,
  TechnicalPlanGenerationOutput,
  UserStoryGenerationOutput,
  CouncilSummary,
  StepAIMetrics,
  StepResultSummary,
} from '@devflow/common';
import {
  createCodeAgentDriver,
  extractSpecGenerationContext,
  formatContextForAI,
  loadPrompts,
  createCouncilService,
} from '@devflow/sdk';
import type { CodebaseContext } from '@devflow/sdk';
import { analyzeRepositoryContext } from '@/activities/codebase.activities';
import { trackLLMUsage, getOrganizationIdFromProject } from '../utils/usage-tracking';

const logger = createLogger('TechnicalPlanActivities');

export interface GenerateTechnicalPlanInput {
  task: any;
  userStory: UserStoryGenerationOutput;
  projectId: string;
  /** Task ID for usage tracking aggregation */
  taskId?: string;
  /** Organization ID for usage tracking (will be looked up if not provided) */
  organizationId?: string;
  /** Workflow ID for usage tracking */
  workflowId?: string;
  ragContext?: {
    chunks: Array<{
      filePath: string;
      content: string;
      score: number;
      language: string;
    }>;
    retrievalTimeMs: number;
    totalChunks: number;
  };
  bestPractices?: FetchBestPracticesOutput;
  /** Documentation context markdown (from Phase 1 document) */
  documentationContext?: string;
  /** AI model to use for generation (from automation config) */
  aiModel?: string;
  /** Feature flag: enable Council AI for multi-model deliberation */
  enableCouncilAI?: boolean;
  /** Council AI models to use */
  councilModels?: string[];
  /** Council chairman model for final decision */
  councilChairmanModel?: string;
}

export interface GenerateTechnicalPlanOutput {
  plan: TechnicalPlanGenerationOutput;
  contextUsed?: {
    language: string;
    framework?: string;
    dependencies: number;
    conventions: number;
    filesAnalyzed: string[];
    usingRAG: boolean;
  };
  council?: CouncilSummary;
  /** AI metrics for workflow step logging */
  aiMetrics?: StepAIMetrics;
  /** Result summary for workflow step logging */
  resultSummary?: StepResultSummary;
}

/**
 * Fetch best practices for a given task using Perplexity
 */
export interface FetchBestPracticesInput {
  task: {
    title: string;
    description: string;
  };
  projectId: string;
  /** Task ID for usage tracking aggregation */
  taskId?: string;
  /** Organization ID for usage tracking (will be looked up if not provided) */
  organizationId?: string;
  /** Workflow ID for usage tracking */
  workflowId?: string;
  context?: {
    language: string;
    framework?: string;
  };
  /** AI model to use for best practices (defaults to perplexity/sonar-pro) */
  aiModel?: string;
}

export interface FetchBestPracticesOutput {
  bestPractices: string;
  sources?: string[];
  perplexityModel: string;
}

export async function fetchBestPractices(
  input: FetchBestPracticesInput
): Promise<FetchBestPracticesOutput> {
  // Use aiModel from input, fallback to default
  const modelToUse = input.aiModel || 'perplexity/sonar-pro';

  logger.info('Fetching best practices', {
    taskTitle: input.task.title,
    projectId: input.projectId,
    model: modelToUse,
  });

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Build concise context-aware query for Perplexity
    const techStack = input.context
      ? [input.context.language, input.context.framework].filter(Boolean).join(' / ')
      : '';

    const query = `Best practices for implementing: "${input.task.title}"${techStack ? ` (${techStack})` : ''}

Context: ${input.task.description.slice(0, 500)}${input.task.description.length > 500 ? '...' : ''}

Provide a concise summary (max 500 words) with:
- Key implementation patterns
- Common pitfalls to avoid
- Security/performance tips if relevant

Be specific and actionable. Skip generic advice.`;

    // Measure API latency
    const startTime = Date.now();

    // Call model via OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: modelToUse,
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: 2048,
        // Enable detailed usage tracking from OpenRouter
        usage: { include: true },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://devflow.dev',
          'X-Title': 'DevFlow - Best Practices',
        },
      }
    );

    const latencyMs = Date.now() - startTime;
    const data = response.data;
    const usage = data.usage || {};

    const bestPractices = data.choices[0].message.content;
    const model = data.model;

    logger.info('Best practices fetched successfully', {
      length: bestPractices.length,
      model,
      latencyMs,
    });

    // Track LLM usage for billing/analytics
    const orgId = input.organizationId || await getOrganizationIdFromProject(input.projectId);
    if (orgId && input.workflowId) {
      await trackLLMUsage({
        organizationId: orgId,
        workflowId: input.workflowId,
        provider: 'openrouter',
        model: modelToUse,
        response: {
          content: bestPractices,
          usage: {
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
            inputCost: usage.prompt_cost || usage.input_cost,
            outputCost: usage.completion_cost || usage.output_cost,
            totalCost: usage.total_cost,
            latencyMs,
            cached: usage.cache_hit || false,
          },
          model,
          finishReason: data.choices[0].finish_reason,
          requestId: data.id,
        },
        context: {
          taskId: input.taskId,
          projectId: input.projectId,
          phase: 'technical_plan',
        },
      });
    }

    return {
      bestPractices,
      perplexityModel: model,
    };
  } catch (error) {
    logger.error('Failed to fetch best practices from Perplexity', error);
    // Return empty best practices instead of failing the entire workflow
    return {
      bestPractices: 'Unable to fetch best practices at this time.',
      perplexityModel: 'perplexity/sonar-pro',
    };
  }
}

/**
 * Generate technical plan from user story using AI with codebase context
 */
export async function generateTechnicalPlan(
  input: GenerateTechnicalPlanInput
): Promise<GenerateTechnicalPlanOutput> {
  logger.info('Generating technical plan', {
    taskTitle: input.task.title,
    projectId: input.projectId,
    hasRAGContext: !!input.ragContext,
  });

  try {
    // Step 1: Build codebase context (RAG or legacy analysis)
    let codebaseContext: CodebaseContext;
    let usingRAG = false;

    if (input.ragContext && input.ragContext.chunks.length > 0) {
      logger.info('Using RAG context for technical plan', {
        chunks: input.ragContext.chunks.length,
        retrievalTime: input.ragContext.retrievalTimeMs,
      });

      usingRAG = true;

      // Build context from RAG chunks
      const languages = [
        ...new Set(input.ragContext.chunks.map((c) => c.language)),
      ];
      const primaryLanguage = languages[0] || 'unknown';

      codebaseContext = {
        structure: {
          language: primaryLanguage,
          framework: undefined,
          directories: [],
          mainPaths: {},
          fileCount: input.ragContext.chunks.length,
          summary: 'Context retrieved via RAG',
        },
        dependencies: {
          production: {},
          dev: {},
          mainLibraries: [],
          summary: 'No dependency information available from RAG',
        },
        similarCode: input.ragContext.chunks.map((chunk) => ({
          path: chunk.filePath,
          content: chunk.content,
          relevanceScore: chunk.score * 100,
          reason: `RAG retrieval (score: ${chunk.score.toFixed(2)})`,
        })),
        documentation: {
          readme: '',
          conventions: [],
          patterns: [],
          summary: 'No documentation scanned',
        },
        timestamp: new Date(),
      };
    } else {
      logger.info('No RAG context, using legacy repository analysis');

      codebaseContext = await analyzeRepositoryContext({
        projectId: input.projectId,
        taskDescription: input.task.description,
      });
    }

    // Step 2: Extract spec context for AI
    const specContext = extractSpecGenerationContext(codebaseContext);

    logger.info('Codebase context prepared', {
      language: specContext.language,
      framework: specContext.framework,
      dependencies: specContext.dependencies.length,
      usingRAG,
    });

    // Step 3: Build combined context (documentation + codebase)
    let combinedContext = '';
    if (input.documentationContext) {
      combinedContext += input.documentationContext + '\n\n---\n\n';
    }
    combinedContext += formatContextForAI(codebaseContext);

    // Step 4: Load prompts with user story, context, and best practices
    const prompts = await loadPrompts('technical-plan', {
      userStoryActor: input.userStory.userStory.actor,
      userStoryGoal: input.userStory.userStory.goal,
      userStoryBenefit: input.userStory.userStory.benefit,
      acceptanceCriteria: input.userStory.acceptanceCriteria
        .map((c, i) => `${i + 1}. ${c}`)
        .join('\n'),
      projectLanguage: specContext.language,
      projectFramework: specContext.framework || 'Not specified',
      projectDependencies: specContext.dependencies.join(', '),
      codebaseContext: combinedContext,
      bestPractices: input.bestPractices?.bestPractices || 'No best practices available',
    });

    // Step 5: Generate with AI (council or single model)
    // Use enableCouncilAI from automation config, fallback to env var
    const useCouncil = input.enableCouncilAI ?? (process.env.ENABLE_COUNCIL === 'true');

    let plan: TechnicalPlanGenerationOutput;
    let councilSummary: CouncilSummary | undefined = undefined;
    let aiMetrics: StepAIMetrics | undefined = undefined;
    let resultSummary: StepResultSummary | undefined = undefined;

    if (useCouncil) {
      // Use councilModels from automation config, fallback to env var or defaults
      const councilModelsToUse = input.councilModels ||
        (process.env.COUNCIL_MODELS
          ? process.env.COUNCIL_MODELS.split(',').map((m) => m.trim())
          : ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-exp']);

      // Use councilChairmanModel from automation config, fallback to env var or default
      const chairmanModelToUse = input.councilChairmanModel ||
        process.env.COUNCIL_CHAIRMAN_MODEL ||
        'anthropic/claude-sonnet-4';

      logger.info('Using LLM Council for technical plan', {
        models: councilModelsToUse,
        chairman: chairmanModelToUse,
      });

      const council = createCouncilService(
        process.env.OPENROUTER_API_KEY || '',
        {
          enabled: true,
          models: councilModelsToUse,
          chairmanModel: chairmanModelToUse,
          timeout: parseInt(process.env.COUNCIL_TIMEOUT || '120000'),
        }
      );

      const result = await council.deliberate<TechnicalPlanGenerationOutput>(
        prompts,
        parseTechnicalPlanResponse
      );

      logger.info('Council technical plan generation complete', {
        topRankedModel: result.summary.topRankedModel,
        agreementLevel: result.summary.agreementLevel,
      });

      plan = result.finalOutput;
      councilSummary = result.summary;

      // Build metrics from council summary (detailed model metrics not in CouncilSummary)
      aiMetrics = {
        model: councilSummary.topRankedModel,
        provider: 'openrouter',
        inputTokens: 0, // Not available in council summary
        outputTokens: 0, // Not available in council summary
        totalCost: 0, // Not available in council summary
        latencyMs: 0, // Not available in council summary
        cached: false,
      };
      resultSummary = {
        type: 'technical_plan',
        summary: `Council deliberation: ${councilSummary.agreementLevel} agreement, ${plan.implementationSteps?.length || 0} steps, top model: ${councilSummary.topRankedModel}`,
        itemsCount: plan.implementationSteps?.length || 0,
      };
    } else {
      // Single model generation
      // Use aiModel from automation config, fallback to env var or default
      const modelToUse = input.aiModel || process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
      logger.info('Using single model generation for technical plan', { model: modelToUse });

      const agent = createCodeAgentDriver({
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: modelToUse,
      });

      const response = await agent.generate(prompts);
      plan = parseTechnicalPlanResponse(response.content);

      // Extract AI metrics for logging (single model mode)
      aiMetrics = extractAIMetrics(response, 'openrouter');
      resultSummary = {
        type: 'technical_plan',
        summary: `Generated ${plan.implementationSteps?.length || 0} implementation steps, ${plan.risks?.length || 0} risks identified`,
        itemsCount: plan.implementationSteps?.length || 0,
        wordCount: response.content.split(/\s+/).length,
      };

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
            phase: 'technical_plan',
          },
        });
      }

      logger.info('Technical plan generated successfully', {
        model: modelToUse,
        usageTracked: !!(orgId && input.workflowId),
        aiMetrics: {
          inputTokens: aiMetrics.inputTokens,
          outputTokens: aiMetrics.outputTokens,
          totalCost: aiMetrics.totalCost,
          latencyMs: aiMetrics.latencyMs,
        },
      });
    }

    return {
      plan,
      contextUsed: {
        language: specContext.language,
        framework: specContext.framework,
        dependencies: specContext.dependencies.length,
        conventions: specContext.conventions.length,
        filesAnalyzed: codebaseContext.similarCode?.map((c) => c.path) || [],
        usingRAG,
      },
      council: councilSummary,
      aiMetrics,
      resultSummary,
    };
  } catch (error) {
    logger.error('Failed to generate technical plan', error);
    throw error;
  }
}

/**
 * Parse JSON response from AI into TechnicalPlanGenerationOutput
 */
function parseTechnicalPlanResponse(
  content: string
): TechnicalPlanGenerationOutput {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonString);

    return {
      architecture: parsed.architecture || [],
      implementationSteps: parsed.implementationSteps || [],
      testingStrategy: parsed.testingStrategy || '',
      risks: parsed.risks || [],
      estimatedTime: parsed.estimatedTime || 180,
      dependencies: parsed.dependencies,
      technicalDecisions: parsed.technicalDecisions,
      filesAffected: parsed.filesAffected,
    };
  } catch (error) {
    logger.error('Failed to parse technical plan response', error as Error, { content });
    throw new Error(
      `Failed to parse technical plan JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

