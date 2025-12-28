/**
 * Automation Config Helpers
 *
 * Functions for merging, validating, and working with automation configurations.
 */

import {
  AutomationConfig,
  AIModelInfo,
  PhaseName,
  OAuthProvider,
  FeatureOAuthRequirement,
  DEFAULT_AUTOMATION_CONFIG,
  RefinementFeatures,
  UserStoryFeatures,
  TechnicalPlanFeatures,
} from '../types/automation-config.types';

// ============================================
// Available AI Models
// ============================================

export const AVAILABLE_AI_MODELS: AIModelInfo[] = [
  // Anthropic
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Latest Claude model with excellent reasoning',
    tier: 'premium',
    costTier: 3,
    recommendedFor: ['refinement', 'userStory', 'technicalPlan'],
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Fast and capable, great balance of speed and quality',
    tier: 'balanced',
    costTier: 2,
    recommendedFor: ['refinement', 'userStory', 'technicalPlan'],
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fastest Claude model, best for simple tasks',
    tier: 'fast',
    costTier: 1,
    recommendedFor: ['refinement'],
  },
  // OpenAI
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Powerful multimodal model from OpenAI',
    tier: 'premium',
    costTier: 2,
    recommendedFor: ['refinement', 'userStory', 'technicalPlan'],
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Cost-effective GPT-4o variant',
    tier: 'fast',
    costTier: 1,
    recommendedFor: ['refinement'],
  },
  // Google
  {
    id: 'google/gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Fast Google model with good reasoning',
    tier: 'balanced',
    costTier: 2,
    recommendedFor: ['refinement', 'userStory', 'technicalPlan'],
  },
  // Meta
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'meta',
    description: 'Open source model, cost-effective',
    tier: 'balanced',
    costTier: 1,
    recommendedFor: ['refinement', 'userStory'],
  },
];

// ============================================
// Feature OAuth Requirements
// ============================================

export const REFINEMENT_FEATURE_OAUTH: FeatureOAuthRequirement[] = [
  { featureKey: 'enableRagContext', label: 'RAG Context Retrieval', requiredOAuth: null },
  { featureKey: 'enableDocumentationAnalysis', label: 'Documentation Analysis', requiredOAuth: null },
  { featureKey: 'enableFigmaContext', label: 'Figma Design Context', requiredOAuth: 'FIGMA' },
  { featureKey: 'enableSentryContext', label: 'Sentry Error Context', requiredOAuth: 'SENTRY' },
  { featureKey: 'enableGitHubIssueContext', label: 'GitHub Issue Context', requiredOAuth: 'GITHUB' },
  { featureKey: 'enablePOQuestions', label: 'PO Questions', requiredOAuth: null },
  { featureKey: 'enableContextDocuments', label: 'Context Documents', requiredOAuth: null },
  { featureKey: 'enableSubtaskCreation', label: 'Auto Subtask Creation', requiredOAuth: null },
];

export const USER_STORY_FEATURE_OAUTH: FeatureOAuthRequirement[] = [
  { featureKey: 'enableTaskSplitting', label: 'Task Splitting', requiredOAuth: null },
  { featureKey: 'reuseCodebaseContext', label: 'Reuse Codebase Context', requiredOAuth: null },
  { featureKey: 'reuseDocumentationContext', label: 'Reuse Documentation Context', requiredOAuth: null },
];

export const TECHNICAL_PLAN_FEATURE_OAUTH: FeatureOAuthRequirement[] = [
  { featureKey: 'enableBestPracticesQuery', label: 'Best Practices Query', requiredOAuth: null },
  { featureKey: 'enableCouncilAI', label: 'Council AI', requiredOAuth: null },
  { featureKey: 'reuseCodebaseContext', label: 'Reuse Codebase Context', requiredOAuth: null },
  { featureKey: 'reuseDocumentationContext', label: 'Reuse Documentation Context', requiredOAuth: null },
];

/**
 * Get OAuth requirements for features in a phase
 */
export function getFeatureOAuthRequirements(phase: PhaseName): FeatureOAuthRequirement[] {
  switch (phase) {
    case 'refinement':
      return REFINEMENT_FEATURE_OAUTH;
    case 'userStory':
      return USER_STORY_FEATURE_OAUTH;
    case 'technicalPlan':
      return TECHNICAL_PLAN_FEATURE_OAUTH;
    default:
      return [];
  }
}

/**
 * Get the OAuth provider required for a specific feature
 */
export function getRequiredOAuthForFeature(
  phase: PhaseName,
  featureKey: string
): OAuthProvider | null {
  const requirements = getFeatureOAuthRequirements(phase);
  const requirement = requirements.find((r) => r.featureKey === featureKey);
  return requirement?.requiredOAuth ?? null;
}

// ============================================
// Merge & Validation Functions
// ============================================

/**
 * Deep merge a partial automation config with defaults
 */
export function mergeWithDefaults(
  partial?: Partial<AutomationConfig> | null
): AutomationConfig {
  if (!partial) {
    return structuredClone(DEFAULT_AUTOMATION_CONFIG);
  }

  const defaults = DEFAULT_AUTOMATION_CONFIG;

  return {
    version: partial.version ?? defaults.version,
    templateName: partial.templateName,
    phases: {
      refinement: {
        enabled: partial.phases?.refinement?.enabled ?? defaults.phases.refinement.enabled,
        aiModel: partial.phases?.refinement?.aiModel ?? defaults.phases.refinement.aiModel,
        features: {
          ...defaults.phases.refinement.features,
          ...partial.phases?.refinement?.features,
        } as RefinementFeatures,
      },
      userStory: {
        enabled: partial.phases?.userStory?.enabled ?? defaults.phases.userStory.enabled,
        aiModel: partial.phases?.userStory?.aiModel ?? defaults.phases.userStory.aiModel,
        features: {
          ...defaults.phases.userStory.features,
          ...partial.phases?.userStory?.features,
        } as UserStoryFeatures,
      },
      technicalPlan: {
        enabled: partial.phases?.technicalPlan?.enabled ?? defaults.phases.technicalPlan.enabled,
        aiModel: partial.phases?.technicalPlan?.aiModel ?? defaults.phases.technicalPlan.aiModel,
        features: {
          ...defaults.phases.technicalPlan.features,
          ...partial.phases?.technicalPlan?.features,
        } as TechnicalPlanFeatures,
        councilModels: partial.phases?.technicalPlan?.councilModels,
        councilChairmanModel: partial.phases?.technicalPlan?.councilChairmanModel,
      },
    },
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate an automation configuration
 */
export function validateAutomationConfig(config: AutomationConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check version
  if (config.version !== 1) {
    errors.push(`Unsupported config version: ${config.version}`);
  }

  // Check at least one phase is enabled
  const enabledPhases = [
    config.phases.refinement.enabled,
    config.phases.userStory.enabled,
    config.phases.technicalPlan.enabled,
  ].filter(Boolean);

  if (enabledPhases.length === 0) {
    errors.push('At least one workflow phase must be enabled');
  }

  // Validate AI models
  const validModelIds = AVAILABLE_AI_MODELS.map((m) => m.id);

  const modelValidations = [
    { phase: 'refinement', model: config.phases.refinement.aiModel },
    { phase: 'userStory', model: config.phases.userStory.aiModel },
    { phase: 'technicalPlan', model: config.phases.technicalPlan.aiModel },
  ];

  for (const { phase, model } of modelValidations) {
    if (model && !validModelIds.includes(model)) {
      warnings.push(`Unknown AI model "${model}" for ${phase} phase. Will use default.`);
    }
  }

  // Validate Council AI models if enabled
  if (config.phases.technicalPlan.features.enableCouncilAI) {
    const councilModels = config.phases.technicalPlan.councilModels || [];
    if (councilModels.length < 2) {
      warnings.push('Council AI works best with at least 2 models');
    }
    for (const model of councilModels) {
      if (!validModelIds.includes(model)) {
        warnings.push(`Unknown Council AI model: ${model}`);
      }
    }
  }

  // Check feature dependencies
  if (config.phases.userStory.features.reuseCodebaseContext && !config.phases.refinement.enabled) {
    warnings.push('User Story "Reuse Codebase Context" requires Refinement phase');
  }

  if (config.phases.technicalPlan.features.reuseCodebaseContext && !config.phases.refinement.enabled) {
    warnings.push('Technical Plan "Reuse Codebase Context" requires Refinement phase');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a config matches a specific template
 */
export function matchesTemplate(
  config: AutomationConfig,
  templateName: string
): boolean {
  // Only check if templateName matches - actual config may have been customized
  return config.templateName === templateName;
}

/**
 * Get AI model info by ID
 */
export function getAIModelInfo(modelId: string): AIModelInfo | undefined {
  return AVAILABLE_AI_MODELS.find((m) => m.id === modelId);
}

/**
 * Get AI models grouped by provider
 */
export function getAIModelsByProvider(): Record<string, AIModelInfo[]> {
  const grouped: Record<string, AIModelInfo[]> = {};
  for (const model of AVAILABLE_AI_MODELS) {
    if (!grouped[model.provider]) {
      grouped[model.provider] = [];
    }
    grouped[model.provider].push(model);
  }
  return grouped;
}

/**
 * Get recommended models for a specific phase
 */
export function getRecommendedModelsForPhase(phase: PhaseName): AIModelInfo[] {
  return AVAILABLE_AI_MODELS.filter((m) => m.recommendedFor.includes(phase));
}
