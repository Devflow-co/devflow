/**
 * Usage Tracking Helper - Records LLM usage metrics to the database
 */

import { PrismaClient, UsageType } from '@prisma/client';
import type { AgentResponse, AgentUsage } from '@devflow/common';

// Singleton Prisma instance to avoid recreating on every call
let prismaInstance: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

// Default pricing for LLM tokens (used as fallback if OpenRouter doesn't return cost)
const DEFAULT_INPUT_TOKEN_PRICE = 0.000003; // $3 per 1M tokens
const DEFAULT_OUTPUT_TOKEN_PRICE = 0.000015; // $15 per 1M tokens

/**
 * Record a single usage record to the database
 */
async function recordUsage(params: {
  organizationId: string;
  type: UsageType;
  quantity: number;
  unit: string;
  unitPrice: number;
  resourceId?: string;
  resourceType?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const prisma = getPrisma();
  const now = new Date();
  const totalCost = params.quantity * params.unitPrice;

  await prisma.usageRecord.create({
    data: {
      organizationId: params.organizationId,
      type: params.type,
      quantity: params.quantity,
      unit: params.unit,
      unitPrice: params.unitPrice,
      totalCost,
      resourceId: params.resourceId,
      resourceType: params.resourceType,
      metadata: params.metadata as any,
      periodStart: now,
      periodEnd: now,
    },
  });
}

/**
 * Record LLM usage from an AI provider response (unified method)
 * Uses cost from OpenRouter response instead of internal pricing
 */
async function recordLLMUsage(params: {
  organizationId: string;
  workflowId: string;
  provider: string;
  model: string;
  usage: AgentUsage;
  requestId?: string;
  context?: {
    taskId?: string;
    projectId?: string;
    phase?: 'refinement' | 'user_story' | 'technical_plan' | 'code_generation';
  };
}): Promise<void> {
  const { organizationId, workflowId, provider, model, usage, requestId, context } = params;

  // Common metadata for both records (includes context for aggregation)
  const metadata = {
    provider,
    model,
    requestId,
    latencyMs: usage.latencyMs,
    cached: usage.cached,
    // Context for task/phase aggregation
    taskId: context?.taskId,
    projectId: context?.projectId,
    phase: context?.phase,
  };

  // Calculate unit prices from OpenRouter costs (or fallback to default pricing)
  const inputUnitPrice =
    usage.inputCost && usage.inputTokens > 0
      ? usage.inputCost / usage.inputTokens
      : DEFAULT_INPUT_TOKEN_PRICE;

  const outputUnitPrice =
    usage.outputCost && usage.outputTokens > 0
      ? usage.outputCost / usage.outputTokens
      : DEFAULT_OUTPUT_TOKEN_PRICE;

  // Record input tokens
  if (usage.inputTokens > 0) {
    await recordUsage({
      organizationId,
      type: UsageType.LLM_TOKENS_INPUT,
      quantity: usage.inputTokens,
      unit: 'tokens',
      unitPrice: inputUnitPrice,
      resourceId: workflowId,
      resourceType: 'workflow',
      metadata,
    });
  }

  // Record output tokens
  if (usage.outputTokens > 0) {
    await recordUsage({
      organizationId,
      type: UsageType.LLM_TOKENS_OUTPUT,
      quantity: usage.outputTokens,
      unit: 'tokens',
      unitPrice: outputUnitPrice,
      resourceId: workflowId,
      resourceType: 'workflow',
      metadata,
    });
  }
}

/**
 * Track LLM usage from an AI provider response
 * Call this after every AI generation to record metrics
 */
export async function trackLLMUsage(params: {
  organizationId: string;
  workflowId: string;
  provider: string;
  model: string;
  response: AgentResponse;
  /** Optional context for aggregation by task/phase */
  context?: {
    taskId?: string;
    projectId?: string;
    phase?: 'refinement' | 'user_story' | 'technical_plan' | 'code_generation';
  };
}): Promise<void> {
  const { organizationId, workflowId, provider, model, response, context } = params;

  try {
    await recordLLMUsage({
      organizationId,
      workflowId,
      provider,
      model,
      usage: response.usage,
      requestId: response.requestId,
      context,
    });
  } catch (error) {
    // Log but don't throw - we don't want usage tracking failures to break workflows
    console.error('[UsageTracking] Failed to record LLM usage:', error);
  }
}

/**
 * Get organization ID from project ID
 * Useful when activities only have projectId but need organizationId for tracking
 */
export async function getOrganizationIdFromProject(projectId: string): Promise<string | null> {
  try {
    const orgProject = await getPrisma().organizationProject.findFirst({
      where: { projectId },
      select: { organizationId: true },
    });
    return orgProject?.organizationId ?? null;
  } catch (error) {
    console.error('[UsageTracking] Failed to get organizationId:', error);
    return null;
  }
}
