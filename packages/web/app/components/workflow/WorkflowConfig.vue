<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4"
    >
      <p class="text-red-800 dark:text-red-200 text-sm">{{ error }}</p>
      <button
        @click="reload"
        class="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
      >
        Try again
      </button>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Phase Configurations -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phase Configuration</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enable or disable phases and configure which automations run during each phase.
        </p>
        <div class="space-y-4">
          <PhaseConfig
            phase="refinement"
            :config="config.phases.refinement"
            :ai-models="aiModels"
            :oauth-connections="oauthConnections"
            @update:config="(c) => updatePhaseConfig('refinement', c)"
          />
          <PhaseConfig
            phase="userStory"
            :config="config.phases.userStory"
            :ai-models="aiModels"
            :oauth-connections="oauthConnections"
            @update:config="(c) => updatePhaseConfig('userStory', c)"
          />
          <PhaseConfig
            phase="technicalPlan"
            :config="config.phases.technicalPlan"
            :ai-models="aiModels"
            :oauth-connections="oauthConnections"
            @update:config="(c) => updatePhaseConfig('technicalPlan', c)"
          />
        </div>
      </div>

      <!-- Save/Reset Buttons -->
      <div class="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <span
            v-if="hasChanges"
            class="text-sm text-amber-600 dark:text-amber-400"
          >
            You have unsaved changes
          </span>
          <span
            v-else
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            No changes to save
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            :disabled="!hasChanges"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            @click="reset"
          >
            Reset
          </button>
          <button
            type="button"
            :disabled="!hasChanges || saving"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            @click="saveConfig"
          >
            <svg
              v-if="saving"
              class="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, toRef } from 'vue'
import { useWorkflowConfig } from '@/composables/useWorkflowConfig'
import type { AutomationConfig } from '@/composables/useWorkflowConfig'
import PhaseConfig from './PhaseConfig.vue'

interface OAuthConnection {
  provider: string
  isActive: boolean
}

interface Props {
  projectId: string
  initialConfig?: AutomationConfig | null
  oauthConnections?: OAuthConnection[]
}

interface Emits {
  (e: 'saved'): void
}

const props = withDefaults(defineProps<Props>(), {
  initialConfig: null,
  oauthConnections: () => [],
})

const emit = defineEmits<Emits>()

// Use the composable
const projectIdRef = toRef(() => props.projectId)
const {
  config,
  aiModels,
  loading,
  saving,
  error,
  hasChanges,
  load,
  save,
  reset,
} = useWorkflowConfig(projectIdRef)

// Load on mount
onMounted(async () => {
  await load(props.initialConfig)
})

// Reload function for error state
const reload = async () => {
  await load(props.initialConfig)
}

// Update phase config
const updatePhaseConfig = (
  phase: 'refinement' | 'userStory' | 'technicalPlan',
  phaseConfig: any
) => {
  config.value.phases[phase] = phaseConfig
}

// Save config
const saveConfig = async () => {
  try {
    await save()
    emit('saved')
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}
</script>
