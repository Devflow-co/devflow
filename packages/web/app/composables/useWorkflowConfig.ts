/**
 * Workflow Configuration Composable
 *
 * Manages automation configuration state and AI models.
 * Used by the WorkflowConfig component.
 */

import { ref, computed } from 'vue'
import type { Ref } from 'vue'

// Types mirroring @devflow/common (avoiding direct import for web compatibility)
interface RefinementFeatures {
  enableAutoStatusUpdate: boolean
  enableRagContext: boolean
  enableDocumentationAnalysis: boolean
  enableFigmaContext: boolean
  enableSentryContext: boolean
  enableGitHubIssueContext: boolean
  enablePOQuestions: boolean
  enableContextDocuments: boolean
  enableSubtaskCreation: boolean
}

interface RefinementFeatureModels {
  poQuestions?: string
  subtaskCreation?: string
}

interface UserStoryFeatures {
  enableAutoStatusUpdate: boolean
  enableTaskSplitting: boolean
  reuseCodebaseContext: boolean
  reuseDocumentationContext: boolean
}

interface UserStoryFeatureModels {
  taskSplitting?: string
}

interface TechnicalPlanFeatures {
  enableAutoStatusUpdate: boolean
  enableBestPracticesQuery: boolean
  enableCouncilAI: boolean
  reuseCodebaseContext: boolean
  reuseDocumentationContext: boolean
}

interface TechnicalPlanFeatureModels {
  bestPractices?: string
}

interface PhaseConfig<T, M = Record<string, never>> {
  enabled: boolean
  aiModel: string
  features: T
  featureModels?: M
}

interface TechnicalPlanPhaseConfig extends PhaseConfig<TechnicalPlanFeatures, TechnicalPlanFeatureModels> {
  councilModels?: string[]
  councilChairmanModel?: string
}

export interface AutomationConfig {
  version: 1
  phases: {
    refinement: PhaseConfig<RefinementFeatures, RefinementFeatureModels>
    userStory: PhaseConfig<UserStoryFeatures, UserStoryFeatureModels>
    technicalPlan: TechnicalPlanPhaseConfig
  }
}

export interface AIModelInfo {
  id: string
  name: string
  provider: string
  description: string
  tier: 'fast' | 'balanced' | 'premium'
  costTier: 1 | 2 | 3
  recommendedFor: string[]
}

export interface OAuthConnection {
  provider: string
  isActive: boolean
}

// Default configuration (matches @devflow/common defaults)
const DEFAULT_AI_MODEL = 'anthropic/claude-sonnet-4'
const DEFAULT_BEST_PRACTICES_MODEL = 'perplexity/sonar-pro'

const DEFAULT_CONFIG: AutomationConfig = {
  version: 1,
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
      featureModels: {},
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
      featureModels: {},
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
      featureModels: {
        bestPractices: DEFAULT_BEST_PRACTICES_MODEL,
      },
      councilModels: [
        'anthropic/claude-sonnet-4',
        'openai/gpt-4o',
        'google/gemini-2.0-flash-exp',
      ],
      councilChairmanModel: 'anthropic/claude-sonnet-4',
    },
  },
}

export function useWorkflowConfig(projectId: Ref<string>) {
  // State
  // Deep clone helper that handles reactive proxies
  const deepClone = <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj))
  }

  const config = ref<AutomationConfig>(deepClone(DEFAULT_CONFIG))
  const originalConfig = ref<AutomationConfig>(deepClone(DEFAULT_CONFIG))
  const aiModels = ref<AIModelInfo[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const hasChanges = computed(() => {
    return JSON.stringify(config.value) !== JSON.stringify(originalConfig.value)
  })

  // API helper
  const getApiBase = (): string => {
    if (import.meta.client) {
      try {
        const runtimeConfig = useRuntimeConfig()
        return String(runtimeConfig.public.apiBase || 'http://localhost:3001/api/v1')
      } catch {
        return 'http://localhost:3001/api/v1'
      }
    }
    return 'http://localhost:3001/api/v1'
  }

  const apiFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const url = `${getApiBase()}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Load AI models
  const loadMetadata = async () => {
    try {
      const modelsResponse = await apiFetch<{ models: AIModelInfo[] }>('/config/ai-models')
      aiModels.value = modelsResponse.models
    } catch (e: any) {
      console.error('Failed to load workflow config metadata:', e)
      error.value = e.message
    }
  }

  // Initialize config from project data
  const initializeConfig = (initialConfig?: AutomationConfig | null) => {
    if (initialConfig) {
      config.value = deepClone(initialConfig)
      originalConfig.value = deepClone(initialConfig)
    } else {
      config.value = deepClone(DEFAULT_CONFIG)
      originalConfig.value = deepClone(DEFAULT_CONFIG)
    }
  }

  // Load everything
  const load = async (initialConfig?: AutomationConfig | null) => {
    try {
      loading.value = true
      error.value = null
      await loadMetadata()
      initializeConfig(initialConfig)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // Update phase config
  const updatePhase = <K extends keyof AutomationConfig['phases']>(
    phase: K,
    updates: Partial<AutomationConfig['phases'][K]>
  ) => {
    config.value.phases[phase] = {
      ...config.value.phases[phase],
      ...updates,
    } as AutomationConfig['phases'][K]
  }

  // Update a specific feature flag
  const updateFeature = <K extends keyof AutomationConfig['phases']>(
    phase: K,
    featureKey: string,
    value: boolean
  ) => {
    const phaseConfig = config.value.phases[phase]
    ;(phaseConfig.features as any)[featureKey] = value
  }

  // Update a feature-specific model override
  const updateFeatureModel = <K extends keyof AutomationConfig['phases']>(
    phase: K,
    featureModelKey: string,
    model: string
  ) => {
    const phaseConfig = config.value.phases[phase]
    if (!phaseConfig.featureModels) {
      ;(phaseConfig as any).featureModels = {}
    }
    if (model) {
      ;(phaseConfig.featureModels as any)[featureModelKey] = model
    } else {
      // Remove the override if empty (use phase default)
      delete (phaseConfig.featureModels as any)[featureModelKey]
    }
  }

  // Save config to API
  const save = async () => {
    try {
      saving.value = true
      error.value = null

      await apiFetch(`/projects/${projectId.value}`, {
        method: 'PUT',
        body: JSON.stringify({
          config: {
            automation: config.value,
          },
        }),
      })

      // Update original to match saved
      originalConfig.value = deepClone(config.value)
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      saving.value = false
    }
  }

  // Reset to original config
  const reset = () => {
    config.value = deepClone(originalConfig.value)
  }

  // Check if OAuth is connected for a feature
  const isOAuthConnected = (
    provider: string,
    oauthConnections?: OAuthConnection[]
  ): boolean => {
    if (!oauthConnections) return false
    return oauthConnections.some(
      (conn) => conn.provider === provider && conn.isActive
    )
  }

  return {
    // State
    config,
    aiModels,
    loading,
    saving,
    error,

    // Computed
    hasChanges,

    // Actions
    load,
    updatePhase,
    updateFeature,
    updateFeatureModel,
    save,
    reset,
    isOAuthConnected,
  }
}
