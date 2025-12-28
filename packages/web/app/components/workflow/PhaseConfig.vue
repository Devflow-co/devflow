<template>
  <div
    :class="[
      'border rounded-lg p-4 transition-opacity',
      config.enabled
        ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
    ]"
  >
    <!-- Phase Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <span class="text-xl">{{ phaseIcon }}</span>
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-white">{{ phaseTitle }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ phaseDescription }}</p>
        </div>
      </div>
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

    <!-- Phase Content (only visible when enabled) -->
    <div v-if="config.enabled" class="space-y-4">
      <!-- Trigger Status Badge -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400">Trigger Status:</span>
        <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {{ triggerStatus }}
        </span>
      </div>

      <!-- AI Model Selector -->
      <AIModelSelector
        :model-value="config.aiModel"
        :models="aiModels"
        label="AI Model"
        @update:model-value="updateAiModel"
      />

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
            @update:model-value="(value) => updateFeature(feature.key, value)"
          />
        </div>
      </div>

      <!-- Council AI Config (Technical Plan only) -->
      <div v-if="phase === 'technicalPlan' && getFeatureValue('enableCouncilAI')" class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Council AI Models</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Select multiple models for diverse perspectives. The chairman model makes the final decision.
        </p>
        <!-- Simplified: just show the council is configured -->
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Council AI is enabled with default models.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AIModelSelector from './AIModelSelector.vue'
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
}

interface FeatureDefinition {
  key: string
  label: string
  requiredOAuth: string | null
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
    { key: 'enablePOQuestions', label: 'PO Questions', requiredOAuth: null },
    { key: 'enableContextDocuments', label: 'Context Documents', requiredOAuth: null },
    { key: 'enableSubtaskCreation', label: 'Auto Subtask Creation', requiredOAuth: null },
  ],
  userStory: [
    { key: 'enableAutoStatusUpdate', label: 'Auto Status Updates', requiredOAuth: null },
    { key: 'enableTaskSplitting', label: 'Task Splitting', requiredOAuth: null },
    { key: 'reuseCodebaseContext', label: 'Reuse Codebase Context', requiredOAuth: null },
    { key: 'reuseDocumentationContext', label: 'Reuse Documentation Context', requiredOAuth: null },
  ],
  technicalPlan: [
    { key: 'enableAutoStatusUpdate', label: 'Auto Status Updates', requiredOAuth: null },
    { key: 'enableBestPracticesQuery', label: 'Best Practices Query', requiredOAuth: null },
    { key: 'enableCouncilAI', label: 'Council AI', requiredOAuth: null },
    { key: 'reuseCodebaseContext', label: 'Reuse Codebase Context', requiredOAuth: null },
    { key: 'reuseDocumentationContext', label: 'Reuse Documentation Context', requiredOAuth: null },
  ],
}

const featureDefinitions = computed(() => FEATURE_DEFINITIONS[props.phase] || [])

// Get feature value
const getFeatureValue = (key: string): boolean => {
  return props.config.features[key] ?? false
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

const updateAiModel = (model: string) => {
  emit('update:config', {
    ...props.config,
    aiModel: model,
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
</script>
