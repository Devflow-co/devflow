/**
 * Workflow Automation Templates
 *
 * Pre-defined configurations for common use cases.
 * Users can select a template as a starting point and customize from there.
 */

import {
  AutomationConfig,
  TemplateInfo,
  TemplateName,
  DEFAULT_AI_MODEL,
} from '../types/automation-config.types';

// ============================================
// Template Definitions
// ============================================

/**
 * Standard Template
 * Balanced configuration with common automations enabled.
 * Good default for most projects.
 */
export const STANDARD_TEMPLATE: AutomationConfig = {
  version: 1,
  templateName: 'standard',
  phases: {
    refinement: {
      enabled: true,
      aiModel: DEFAULT_AI_MODEL,
      features: {
        enableAutoStatusUpdate: true,
        enableRagContext: true,
        enableDocumentationAnalysis: true,
        enableFigmaContext: true,
        enableSentryContext: true,
        enableGitHubIssueContext: true,
        enablePOQuestions: true,
        enableContextDocuments: true,
        enableSubtaskCreation: true,
      },
    },
    userStory: {
      enabled: true,
      aiModel: DEFAULT_AI_MODEL,
      features: {
        enableAutoStatusUpdate: true,
        enableTaskSplitting: true,
        reuseCodebaseContext: true,
        reuseDocumentationContext: true,
      },
    },
    technicalPlan: {
      enabled: true,
      aiModel: DEFAULT_AI_MODEL,
      features: {
        enableAutoStatusUpdate: true,
        enableBestPracticesQuery: true,
        enableCouncilAI: false,
        reuseCodebaseContext: true,
        reuseDocumentationContext: true,
      },
    },
  },
};

/**
 * Minimal Template
 * Fast and cost-effective. Only essential automations.
 * Good for simple tasks or budget-conscious usage.
 */
export const MINIMAL_TEMPLATE: AutomationConfig = {
  version: 1,
  templateName: 'minimal',
  phases: {
    refinement: {
      enabled: true,
      aiModel: 'anthropic/claude-3-haiku',
      features: {
        enableAutoStatusUpdate: true,
        enableRagContext: false,
        enableDocumentationAnalysis: false,
        enableFigmaContext: false,
        enableSentryContext: false,
        enableGitHubIssueContext: false,
        enablePOQuestions: true,
        enableContextDocuments: false,
        enableSubtaskCreation: false,
      },
    },
    userStory: {
      enabled: false,
      aiModel: 'anthropic/claude-3-haiku',
      features: {
        enableAutoStatusUpdate: true,
        enableTaskSplitting: false,
        reuseCodebaseContext: false,
        reuseDocumentationContext: false,
      },
    },
    technicalPlan: {
      enabled: false,
      aiModel: 'anthropic/claude-3-haiku',
      features: {
        enableAutoStatusUpdate: true,
        enableBestPracticesQuery: false,
        enableCouncilAI: false,
        reuseCodebaseContext: false,
        reuseDocumentationContext: false,
      },
    },
  },
};

/**
 * Advanced Template
 * All features enabled including Council AI.
 * Maximum quality output but higher cost and latency.
 */
export const ADVANCED_TEMPLATE: AutomationConfig = {
  version: 1,
  templateName: 'advanced',
  phases: {
    refinement: {
      enabled: true,
      aiModel: 'anthropic/claude-sonnet-4',
      features: {
        enableAutoStatusUpdate: true,
        enableRagContext: true,
        enableDocumentationAnalysis: true,
        enableFigmaContext: true,
        enableSentryContext: true,
        enableGitHubIssueContext: true,
        enablePOQuestions: true,
        enableContextDocuments: true,
        enableSubtaskCreation: true,
      },
    },
    userStory: {
      enabled: true,
      aiModel: 'anthropic/claude-sonnet-4',
      features: {
        enableAutoStatusUpdate: true,
        enableTaskSplitting: true,
        reuseCodebaseContext: true,
        reuseDocumentationContext: true,
      },
    },
    technicalPlan: {
      enabled: true,
      aiModel: 'anthropic/claude-sonnet-4',
      features: {
        enableAutoStatusUpdate: true,
        enableBestPracticesQuery: true,
        enableCouncilAI: true,
        reuseCodebaseContext: true,
        reuseDocumentationContext: true,
      },
      councilModels: [
        'anthropic/claude-sonnet-4',
        'openai/gpt-4o',
        'google/gemini-2.0-flash-exp',
      ],
      councilChairmanModel: 'anthropic/claude-sonnet-4',
    },
  },
};

// ============================================
// Template Metadata (for UI)
// ============================================

export const TEMPLATE_METADATA: Record<TemplateName, TemplateInfo> = {
  standard: {
    name: 'standard',
    displayName: 'Standard',
    description: 'Balanced configuration with common automations. Good for most projects.',
    icon: '⚡',
    features: [
      'All 3 phases enabled',
      'Auto Linear status updates',
      'RAG context retrieval',
      'External integrations (Figma, Sentry)',
      'PO questions & context documents',
    ],
    costTier: 'medium',
  },
  minimal: {
    name: 'minimal',
    displayName: 'Minimal',
    description: 'Fast and cost-effective. Only essential automations enabled.',
    icon: '🚀',
    features: [
      'Refinement phase only',
      'Auto Linear status updates',
      'PO questions enabled',
      'Uses Claude Haiku (fastest)',
      'Lowest cost',
    ],
    costTier: 'low',
  },
  advanced: {
    name: 'advanced',
    displayName: 'Advanced',
    description: 'Maximum quality with all features including Council AI.',
    icon: '🏆',
    features: [
      'All 3 phases enabled',
      'Auto Linear status updates',
      'All automations enabled',
      'Council AI for technical plans',
      'Multi-model consensus',
    ],
    costTier: 'high',
  },
};

// ============================================
// Template Helpers
// ============================================

/**
 * Get all available templates
 */
export function getTemplates(): AutomationConfig[] {
  return [STANDARD_TEMPLATE, MINIMAL_TEMPLATE, ADVANCED_TEMPLATE];
}

/**
 * Get template metadata for UI display
 */
export function getTemplateMetadata(): TemplateInfo[] {
  return Object.values(TEMPLATE_METADATA);
}

/**
 * Get a template by name
 */
export function getTemplate(name: TemplateName): AutomationConfig {
  switch (name) {
    case 'standard':
      return STANDARD_TEMPLATE;
    case 'minimal':
      return MINIMAL_TEMPLATE;
    case 'advanced':
      return ADVANCED_TEMPLATE;
    default:
      return STANDARD_TEMPLATE;
  }
}

/**
 * Get template info by name
 */
export function getTemplateInfo(name: TemplateName): TemplateInfo {
  return TEMPLATE_METADATA[name] || TEMPLATE_METADATA.standard;
}
