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

// ============================================
// Phase Configuration
// ============================================

/**
 * Base configuration for a workflow phase
 */
export interface BasePhaseConfig<T> {
  /** Whether this phase is enabled */
  enabled: boolean;
  /** AI model ID to use for this phase (e.g., 'anthropic/claude-sonnet-4') */
  aiModel: string;
  /** Feature flags for this phase */
  features: T;
}

export type RefinementPhaseConfig = BasePhaseConfig<RefinementFeatures>;
export type UserStoryPhaseConfig = BasePhaseConfig<UserStoryFeatures>;

export interface TechnicalPlanPhaseConfig extends BasePhaseConfig<TechnicalPlanFeatures> {
  /** Models to use for Council AI (if enableCouncilAI is true) */
  councilModels?: string[];
  /** Chairman model for Council AI final decision */
  councilChairmanModel?: string;
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
  };
}

// ============================================
// AI Model Types
// ============================================

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'meta';
export type ModelTier = 'fast' | 'balanced' | 'premium';
export type CostTier = 1 | 2 | 3;
export type PhaseName = 'refinement' | 'userStory' | 'technicalPlan';

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
  },
};
