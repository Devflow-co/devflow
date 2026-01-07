<template>
  <div
    :class="[
      'border rounded-lg p-4 transition-opacity',
      config.enabled
        ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
    ]"
  >
    <!-- Phase Header - Inline layout with model selector and toggle -->
    <div class="flex items-center justify-between gap-4 mb-4">
      <div class="flex items-center gap-3 min-w-0">
        <span class="text-xl flex-shrink-0">{{ phaseIcon }}</span>
        <div class="min-w-0">
          <h3 class="font-semibold text-gray-900 dark:text-white truncate">{{ phaseTitle }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ phaseDescription }}</p>
        </div>
      </div>

      <!-- Model selector and toggle inline -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <!-- Compact AI Model Selector -->
        <select
          :value="config.aiModel"
          :disabled="!config.enabled"
          class="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed max-w-[180px]"
          @change="handleModelChange"
        >
          <optgroup
            v-for="(providerModels, provider) in modelsByProvider"
            :key="provider"
            :label="formatProviderName(provider)"
          >
            <option
              v-for="model in providerModels"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }}
            </option>
          </optgroup>
        </select>

        <!-- Enable/Disable toggle -->
        <button
          type="button"
          role="switch"
          :aria-checked="config.enabled"
          :class="[
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
            config.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          ]"
          @click="togglePhase"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              config.enabled ? 'translate-x-5' : 'translate-x-0'
            ]"
          />
        </button>
      </div>
    </div>

    <!-- Phase Content (only visible when enabled) -->
    <div v-if="config.enabled" class="space-y-4">
      <!-- Trigger Status Badge -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400">Trigger Status:</span>
        <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {{ triggerStatus }}
        </span>
      </div>

      <!-- Feature Toggles -->
      <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Features</h4>
        <div class="space-y-1">
          <FeatureToggle
            v-for="feature in featureDefinitions"
            :key="feature.key"
            :model-value="getFeatureValue(feature.key)"
            :label="feature.label"
            :required-o-auth="feature.requiredOAuth"
            :oauth-connected="isOAuthConnected(feature.requiredOAuth)"
            :uses-a-i="feature.usesAI"
            :show-model-selector="!!feature.featureModelKey"
            :selected-model="getFeatureModel(feature.featureModelKey)"
            :ai-models="aiModels"
            @update:model-value="(value) => updateFeature(feature.key, value)"
            @update:selected-model="(model) => feature.featureModelKey && updateFeatureModel(feature.featureModelKey, model)"
          />
        </div>
      </div>

      <!-- Council AI Config (Technical Plan only) -->
      <div v-if="phase === 'technicalPlan' && getFeatureValue('enableCouncilAI')" class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Council AI Models</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Select multiple models for diverse perspectives. The chairman model synthesizes the final decision.
        </p>

        <div class="space-y-4">
          <!-- Council Models Multi-Select -->
          <AIModelMultiSelector
            :model-value="councilModels"
            :models="aiModels"
            label="Council Models"
            :min-selection="2"
            :max-selection="5"
            @update:model-value="updateCouncilModels"
          />

          <!-- Chairman Model Selector -->
          <div v-if="councilModels.length > 0" class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Chairman Model
            </label>
            <select
              :value="councilChairmanModel"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @change="handleChairmanChange"
            >
              <option
                v-for="model in selectedCouncilModelInfos"
                :key="model.id"
                :value="model.id"
              >
                {{ model.name }}
              </option>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              The chairman synthesizes all council responses into the final decision.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AIModelMultiSelector from './AIModelMultiSelector.vue'
import FeatureToggle from './FeatureToggle.vue'

interface AIModelInfo {
  id: string
  name: string
  provider: string
  description: string
  tier: 'fast' | 'balanced' | 'premium'
  costTier: 1 | 2 | 3
  recommendedFor: string[]
}

interface PhaseConfig {
  enabled: boolean
  aiModel: string
  features: Record<string, boolean>
  featureModels?: Record<string, string>
  councilModels?: string[]
  councilChairmanModel?: string
}

interface FeatureDefinition {
  key: string
  label: string
  requiredOAuth: string | null
  usesAI?: boolean
  featureModelKey?: string
}

interface OAuthConnection {
  provider: string
  isActive: boolean
}

interface Props {
  phase: 'refinement' | 'userStory' | 'technicalPlan'
  config: PhaseConfig
  aiModels: AIModelInfo[]
  oauthConnections?: OAuthConnection[]
}

interface Emits {
  (e: 'update:config', config: PhaseConfig): void
}

const props = withDefaults(defineProps<Props>(), {
  oauthConnections: () => [],
})

const emit = defineEmits<Emits>()

// Default council models
const DEFAULT_COUNCIL_MODELS = [
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o',
  'google/gemini-2.0-flash-exp',
]

// Council models (with defaults)
const councilModels = computed(() => props.config.councilModels ?? DEFAULT_COUNCIL_MODELS)
const councilChairmanModel = computed(() => props.config.councilChairmanModel ?? councilModels.value[0] ?? '')

// Get model infos for selected council models
const selectedCouncilModelInfos = computed(() => {
  return councilModels.value
    .map((id) => props.aiModels.find((m) => m.id === id))
    .filter((m): m is AIModelInfo => m !== undefined)
})

// Group models by provider for the inline selector
const modelsByProvider = computed(() => {
  const grouped: Record<string, AIModelInfo[]> = {}
  for (const model of props.aiModels) {
    const provider = model.provider
    if (!grouped[provider]) {
      grouped[provider] = []
    }
    grouped[provider]!.push(model)
  }
  return grouped
})

// Format provider name
const formatProviderName = (provider: string): string => {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    meta: 'Meta',
  }
  return names[provider] || provider
}

// Phase metadata
const phaseMetadata = {
  refinement: {
    title: 'Phase 1: Refinement',
    description: 'Clarify requirements and gather context',
    icon: '1️⃣',
    triggerStatus: 'To Refinement',
  },
  userStory: {
    title: 'Phase 2: User Story',
    description: 'Generate user stories from refinement',
    icon: '2️⃣',
    triggerStatus: 'To User Story',
  },
  technicalPlan: {
    title: 'Phase 3: Technical Plan',
    description: 'Create implementation plans',
    icon: '3️⃣',
    triggerStatus: 'To Plan',
  },
}

const phaseTitle = computed(() => phaseMetadata[props.phase].title)
const phaseDescription = computed(() => phaseMetadata[props.phase].description)
const phaseIcon = computed(() => phaseMetadata[props.phase].icon)
const triggerStatus = computed(() => phaseMetadata[props.phase].triggerStatus)

// Feature definitions per phase
const FEATURE_DEFINITIONS: Record<string, FeatureDefinition[]> = {
  refinement: [
    { key: 'enableAutoStatusUpdate', label: 'Auto Status Updates', requiredOAuth: null },
    { key: 'enableRagContext', label: 'RAG Context Retrieval', requiredOAuth: null },
    { key: 'enableDocumentationAnalysis', label: 'Documentation Analysis', requiredOAuth: null },
    { key: 'enableFigmaContext', label: 'Figma Design Context', requiredOAuth: 'FIGMA' },
    { key: 'enableSentryContext', label: 'Sentry Error Context', requiredOAuth: 'SENTRY' },
    { key: 'enableGitHubIssueContext', label: 'GitHub Issue Context', requiredOAuth: 'GITHUB' },
    { key: 'enablePOQuestions', label: 'PO Questions', requiredOAuth: null, usesAI: true, featureModelKey: 'poQuestions' },
    { key: 'enableContextDocuments', label: 'Context Documents', requiredOAuth: null },
    { key: 'enableSubtaskCreation', label: 'Auto Subtask Creation', requiredOAuth: null, usesAI: true, featureModelKey: 'subtaskCreation' },
  ],
  userStory: [
    { key: 'enableAutoStatusUpdate', label: 'Auto Status Updates', requiredOAuth: null },
    { key: 'enableTaskSplitting', label: 'Task Splitting', requiredOAuth: null, usesAI: true, featureModelKey: 'taskSplitting' },
    { key: 'reuseCodebaseContext', label: 'Reuse Codebase Context', requiredOAuth: null },
    { key: 'reuseDocumentationContext', label: 'Reuse Documentation Context', requiredOAuth: null },
  ],
  technicalPlan: [
    { key: 'enableAutoStatusUpdate', label: 'Auto Status Updates', requiredOAuth: null },
    { key: 'enableBestPracticesQuery', label: 'Best Practices Query', requiredOAuth: null, usesAI: true, featureModelKey: 'bestPractices' },
    { key: 'enableCouncilAI', label: 'Council AI', requiredOAuth: null, usesAI: true },
    { key: 'reuseCodebaseContext', label: 'Reuse Codebase Context', requiredOAuth: null },
    { key: 'reuseDocumentationContext', label: 'Reuse Documentation Context', requiredOAuth: null },
  ],
}

const featureDefinitions = computed(() => FEATURE_DEFINITIONS[props.phase] || [])

// Get feature value
const getFeatureValue = (key: string): boolean => {
  return props.config.features[key] ?? false
}

// Get feature model value
const getFeatureModel = (featureModelKey: string | undefined): string => {
  if (!featureModelKey) return ''
  return props.config.featureModels?.[featureModelKey] ?? ''
}

// Check OAuth connection
const isOAuthConnected = (provider: string | null): boolean => {
  if (!provider) return true
  return props.oauthConnections.some(
    (conn) => conn.provider === provider && conn.isActive
  )
}

// Update handlers
const togglePhase = () => {
  emit('update:config', {
    ...props.config,
    enabled: !props.config.enabled,
  })
}

const handleModelChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:config', {
    ...props.config,
    aiModel: target.value,
  })
}

const updateFeature = (key: string, value: boolean) => {
  emit('update:config', {
    ...props.config,
    features: {
      ...props.config.features,
      [key]: value,
    },
  })
}

const updateFeatureModel = (featureModelKey: string, model: string) => {
  const currentModels = { ...props.config.featureModels }
  if (model) {
    currentModels[featureModelKey] = model
  } else {
    // Remove the key if empty (use default)
    delete currentModels[featureModelKey]
  }
  emit('update:config', {
    ...props.config,
    featureModels: currentModels,
  })
}

// Council AI handlers
const updateCouncilModels = (models: string[]) => {
  // If chairman is not in the new selection, update it to first model
  const newChairman = models.includes(councilChairmanModel.value)
    ? councilChairmanModel.value
    : models[0] ?? ''

  emit('update:config', {
    ...props.config,
    councilModels: models,
    councilChairmanModel: newChairman,
  })
}

const handleChairmanChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:config', {
    ...props.config,
    councilChairmanModel: target.value,
  })
}
</script>
