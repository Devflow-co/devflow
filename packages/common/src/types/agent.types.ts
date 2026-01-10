/**
 * Agent Types - For AI code agents
 */

/**
 * Image content for vision-capable models
 */
export interface AgentImage {
  type: 'base64';
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string;
}

export interface AgentPrompt {
  system: string;
  user: string;
  /** Optional images for vision-capable models (Figma screenshots, etc.) */
  images?: AgentImage[];
}

/**
 * Token usage and cost metrics from AI providers
 */
export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  // Cost metrics (from OpenRouter API response)
  inputCost?: number; // Cost for input tokens (USD)
  outputCost?: number; // Cost for output tokens (USD)
  totalCost?: number; // Total cost for the call (USD)
  // Performance metrics
  latencyMs?: number; // API response time in milliseconds
  cached?: boolean; // Whether the response came from cache
}

export interface AgentResponse {
  content: string;
  usage: AgentUsage;
  model: string;
  finishReason?: string;
  requestId?: string; // OpenRouter request ID for tracking
}

export interface SpecGenerationInput {
  task: {
    title: string;
    description: string;
    priority: string;
  };
  project: {
    language: string;
    framework?: string;
    dependencies?: string[];
    conventions?: string[];
    patterns?: string[];
  };
  existingFiles?: string[];
  codebaseContext?: string;
}

export interface SpecGenerationOutput {
  architecture: string[];
  implementationSteps: string[];
  testingStrategy: string;
  risks: string[];
  estimatedTime: number;
  dependencies?: string[];
  technicalDecisions?: string[];
}

export interface CodeGenerationInput {
  task: {
    title: string;
    description: string;
  };
  spec: SpecGenerationOutput;
  projectStructure: string;
  relevantFiles: Array<{
    path: string;
    content: string;
  }>;
  conventions?: string[];
  dependencies?: string[];
}

export interface CodeGenerationOutput {
  files: Array<{
    path: string;
    action: 'create' | 'update' | 'delete';
    content: string;
    reason: string;
  }>;
  commitMessage: string;
  prDescription: string;
}

export interface FixGenerationInput {
  errorLogs: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  testFailures?: Array<{
    name: string;
    message: string;
    stackTrace?: string;
  }>;
  previousAttempts?: number;
}

export interface FixGenerationOutput {
  files: Array<{
    path: string;
    content: string;
    reason: string;
  }>;
  analysis: string;
  commitMessage: string;
}

/**
 * Three-Phase Agile Workflow Types
 */

// Phase 1: Refinement Output
export interface RefinementOutput {
  taskType: 'feature' | 'bug' | 'enhancement' | 'chore'; // Type détecté
  suggestedTitle: string; // Reformulated title in English (clear, actionable)
  reformulatedDescription: string; // Reformulated description in English (detailed, structured)
  businessContext: string; // Contexte métier clarifié
  objectives: string[]; // Objectifs business identifiés
  questionsForPO?: string[]; // Questions pour le Product Owner
  suggestedSplit?: {
    // Découpage suggéré si story trop grosse
    reason: string;
    proposedStories: Array<{
      title: string;
      description: string;
      dependencies?: number[]; // Indices 0-based des sous-tâches dépendantes
      acceptanceCriteria?: string[]; // Critères d'acceptation spécifiques
    }>;
  };
  preliminaryAcceptanceCriteria: string[]; // Critères préliminaires
  complexityEstimate: 'XS' | 'S' | 'M' | 'L' | 'XL'; // T-shirt sizing
}

// Phase 2: User Story Output
export interface UserStoryGenerationOutput {
  userStory: {
    actor: string; // "As a [user type]"
    goal: string; // "I want [goal]"
    benefit: string; // "So that [benefit]"
  };
  acceptanceCriteria: string[];
  definitionOfDone: string[];
  businessValue: string;
  storyPoints: number; // Story points (Fibonacci: 1,2,3,5,8,13,21)
}

// Phase 3: Technical Plan Input
export interface TechnicalPlanGenerationInput {
  task: { title: string; description: string; priority: string };
  userStory: UserStoryGenerationOutput;
  project: {
    language: string;
    framework?: string;
    dependencies?: string[];
    conventions?: string[];
    patterns?: string[];
  };
  codebaseContext?: string;
}

// Phase 3: Technical Plan Output
export interface TechnicalPlanGenerationOutput {
  architecture: string[];
  implementationSteps: string[];
  testingStrategy: string;
  risks: string[];
  estimatedTime: number;
  dependencies?: string[];
  technicalDecisions?: string[];
  filesAffected?: string[]; // Files that will be modified
}

/**
 * Step Metadata Types for Workflow Logging
 * Used to enrich workflow step logs with detailed metrics
 */

// AI metrics extracted from AgentResponse for workflow logging
export interface StepAIMetrics {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  latencyMs: number;
  cached?: boolean;
  requestId?: string;
}

// Result summary for workflow step (without full content)
export interface StepResultSummary {
  type: 'refinement' | 'user_story' | 'technical_plan' | 'code_generation' | 'context' | 'linear' | 'figma' | 'sentry' | 'github';
  summary?: string;
  itemsCount?: number;
  wordCount?: number;
}

// External API call tracking
export interface StepExternalCall {
  service: 'linear' | 'figma' | 'sentry' | 'github' | 'slack' | 'qdrant';
  action: string;
  success: boolean;
  latencyMs?: number;
  details?: string;
}

// Context statistics
export interface StepContextStats {
  ragChunks?: number;
  figmaFrames?: number;
  sentryIssues?: number;
  filesAnalyzed?: number;
  docsRetrieved?: number;
}

// Full step metadata for logging
export interface StepMetadata {
  ai?: StepAIMetrics;
  result?: StepResultSummary;
  externalCalls?: StepExternalCall[];
  context?: StepContextStats;
  [key: string]: unknown;
}

// Helper to extract AI metrics from AgentResponse
export function extractAIMetrics(response: AgentResponse, provider: string = 'openrouter'): StepAIMetrics {
  return {
    model: response.model,
    provider,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    totalCost: response.usage.totalCost || 0,
    latencyMs: response.usage.latencyMs || 0,
    cached: response.usage.cached,
    requestId: response.requestId,
  };
}
