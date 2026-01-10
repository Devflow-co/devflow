/**
 * Automation Configuration Types for Workflow Configuration UI
 *
 * Defines feature flags, phase configurations, and AI model settings
 * that control which automated actions run during each workflow phase.
 */

// ============================================
// Phase Feature Flags
// ============================================

/**
 * Feature flags for the Refinement phase (Phase 1)
 */
export interface RefinementFeatures {
  /** Automatically update Linear issue status (In Progress, Ready, Failed) */
  enableAutoStatusUpdate: boolean;
  /** Enable RAG context retrieval from codebase */
  enableRagContext: boolean;
  /** Enable documentation analysis (project structure, deps, conventions) */
  enableDocumentationAnalysis: boolean;
  /** Enable Figma context extraction (requires Figma OAuth) */
  enableFigmaContext: boolean;
  /** Enable Sentry error analysis (requires Sentry OAuth) */
  enableSentryContext: boolean;
  /** Enable GitHub issue context extraction (requires GitHub OAuth) */
  enableGitHubIssueContext: boolean;
  /** Post questions for PO as Linear comments */
  enablePOQuestions: boolean;
  /** Create context documents in Linear */
  enableContextDocuments: boolean;
  /** Auto-create subtasks for L/XL complexity */
  enableSubtaskCreation: boolean;
}

/**
 * Feature flags for the User Story phase (Phase 2)
 */
export interface UserStoryFeatures {
  /** Automatically update Linear issue status (In Progress, Ready, Failed) */
  enableAutoStatusUpdate: boolean;
  /** Enable automatic task splitting based on refinement */
  enableTaskSplitting: boolean;
  /** Reuse codebase context document from Phase 1 */
  reuseCodebaseContext: boolean;
  /** Reuse documentation context document from Phase 1 */
  reuseDocumentationContext: boolean;
}

/**
 * Feature flags for the Technical Plan phase (Phase 3)
 */
export interface TechnicalPlanFeatures {
  /** Automatically update Linear issue status (In Progress, Ready, Failed) */
  enableAutoStatusUpdate: boolean;
  /** Query best practices from external sources */
  enableBestPracticesQuery: boolean;
  /** Use Council AI (multi-model consensus) */
  enableCouncilAI: boolean;
  /** Reuse codebase context document from Phase 1 */
  reuseCodebaseContext: boolean;
  /** Reuse documentation context document from Phase 1 */
  reuseDocumentationContext: boolean;
}

/**
 * Feature flags for the Code Generation phase (Phase 4)
 * Uses local LLM (Ollama) - no cloud fallback for privacy
 */
export interface CodeGenerationFeatures {
  /** Automatically update Linear issue status (In Progress, Code Review, Failed) */
  enableAutoStatusUpdate: boolean;
  /** Reuse codebase context document from Phase 1 */
  reuseCodebaseContext: boolean;
  /** Reuse technical plan document from Phase 3 */
  reuseTechnicalPlan: boolean;
  /** Enable guardrails validation for file paths (prevent sensitive file access) */
  enableGuardrails: boolean;
  /** Create PR as draft (always true for safety - requires human review) */
  createDraftPR: boolean;
}

// ============================================
// Feature Model Overrides
// ============================================

/**
 * Per-feature AI model overrides for Refinement phase
 * If not set, falls back to phase's aiModel
 */
export interface RefinementFeatureModels {
  /** Model for PO Questions generation */
  poQuestions?: string;
  /** Model for Auto Subtask Creation */
  subtaskCreation?: string;
}

/**
 * Per-feature AI model overrides for User Story phase
 * If not set, falls back to phase's aiModel
 */
export interface UserStoryFeatureModels {
  /** Model for Task Splitting */
  taskSplitting?: string;
}

/**
 * Per-feature AI model overrides for Technical Plan phase
 * If not set, falls back to phase's aiModel or specific defaults
 */
export interface TechnicalPlanFeatureModels {
  /** Model for Best Practices Query (default: perplexity/sonar-pro) */
  bestPractices?: string;
}

// ============================================
// Phase Configuration
// ============================================

/**
 * Base configuration for a workflow phase
 */
export interface BasePhaseConfig<T, M = Record<string, never>> {
  /** Whether this phase is enabled */
  enabled: boolean;
  /** AI model ID to use for this phase (e.g., 'anthropic/claude-sonnet-4') */
  aiModel: string;
  /** Feature flags for this phase */
  features: T;
  /** Per-feature AI model overrides */
  featureModels?: M;
}

export interface RefinementPhaseConfig extends BasePhaseConfig<RefinementFeatures, RefinementFeatureModels> {}

export interface UserStoryPhaseConfig extends BasePhaseConfig<UserStoryFeatures, UserStoryFeatureModels> {}

export interface TechnicalPlanPhaseConfig extends BasePhaseConfig<TechnicalPlanFeatures, TechnicalPlanFeatureModels> {
  /** Models to use for Council AI (if enableCouncilAI is true) */
  councilModels?: string[];
  /** Chairman model for Council AI final decision */
  councilChairmanModel?: string;
}

export interface CodeGenerationPhaseConfig extends BasePhaseConfig<CodeGenerationFeatures> {
  /** Note: Uses local Ollama model, aiModel specifies Ollama model name (e.g., 'deepseek-coder:6.7b') */
}

// ============================================
// Full Automation Configuration
// ============================================

/**
 * Complete automation configuration for a project.
 * Controls which automated actions run during each workflow phase.
 */
export interface AutomationConfig {
  /** Schema version for future migrations */
  version: 1;
  /** Per-phase configuration */
  phases: {
    refinement: RefinementPhaseConfig;
    userStory: UserStoryPhaseConfig;
    technicalPlan: TechnicalPlanPhaseConfig;
    codeGeneration: CodeGenerationPhaseConfig;
  };
}

// ============================================
// AI Model Types
// ============================================

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'meta';
export type ModelTier = 'fast' | 'balanced' | 'premium';
export type CostTier = 1 | 2 | 3;
export type PhaseName = 'refinement' | 'userStory' | 'technicalPlan' | 'codeGeneration';

export interface AIModelInfo {
  /** Model ID used in API calls (e.g., 'anthropic/claude-sonnet-4') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider name */
  provider: AIProvider;
  /** Short description */
  description: string;
  /** Performance tier */
  tier: ModelTier;
  /** Cost tier (1 = cheapest, 3 = most expensive) */
  costTier: CostTier;
  /** Recommended for these phases */
  recommendedFor: PhaseName[];
}

// ============================================
// OAuth Requirements
// ============================================

export type OAuthProvider = 'GITHUB' | 'LINEAR' | 'FIGMA' | 'SENTRY';

export interface FeatureOAuthRequirement {
  featureKey: string;
  label: string;
  requiredOAuth: OAuthProvider | null;
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_AI_MODEL = 'anthropic/claude-sonnet-4';
export const DEFAULT_BEST_PRACTICES_MODEL = 'perplexity/sonar-pro';

export const DEFAULT_REFINEMENT_FEATURES: RefinementFeatures = {
  enableAutoStatusUpdate: true,
  enableRagContext: true,
  enableDocumentationAnalysis: true,
  enableFigmaContext: true,
  enableSentryContext: true,
  enableGitHubIssueContext: true,
  enablePOQuestions: true,
  enableContextDocuments: true,
  enableSubtaskCreation: true,
};

export const DEFAULT_USER_STORY_FEATURES: UserStoryFeatures = {
  enableAutoStatusUpdate: true,
  enableTaskSplitting: true,
  reuseCodebaseContext: true,
  reuseDocumentationContext: true,
};

export const DEFAULT_TECHNICAL_PLAN_FEATURES: TechnicalPlanFeatures = {
  enableAutoStatusUpdate: true,
  enableBestPracticesQuery: true,
  enableCouncilAI: false,
  reuseCodebaseContext: true,
  reuseDocumentationContext: true,
};

export const DEFAULT_CODE_GENERATION_FEATURES: CodeGenerationFeatures = {
  enableAutoStatusUpdate: true,
  reuseCodebaseContext: true,
  reuseTechnicalPlan: true,
  enableGuardrails: true,
  createDraftPR: true, // Always true for safety - requires human review
};

/** Default Ollama model for code generation (local LLM) */
export const DEFAULT_OLLAMA_CODE_MODEL = 'deepseek-coder:6.7b';

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  version: 1,
  phases: {
    refinement: {
      enabled: true,
      aiModel: DEFAULT_AI_MODEL,
      features: DEFAULT_REFINEMENT_FEATURES,
    },
    userStory: {
      enabled: true,
      aiModel: DEFAULT_AI_MODEL,
      features: DEFAULT_USER_STORY_FEATURES,
    },
    technicalPlan: {
      enabled: true,
      aiModel: DEFAULT_AI_MODEL,
      features: DEFAULT_TECHNICAL_PLAN_FEATURES,
    },
    codeGeneration: {
      enabled: true,
      aiModel: DEFAULT_OLLAMA_CODE_MODEL, // Local Ollama model
      features: DEFAULT_CODE_GENERATION_FEATURES,
    },
  },
};
