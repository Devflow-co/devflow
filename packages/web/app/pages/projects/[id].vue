<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="pageLoading" class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <!-- Error State -->
      <div
        v-else-if="pageError"
        class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center"
      >
        <p class="text-red-800 dark:text-red-200 font-medium">{{ pageError }}</p>
        <NuxtLink
          to="/projects"
          class="mt-4 inline-block px-4 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium transition-colors"
        >
          Back to Projects
        </NuxtLink>
      </div>

      <!-- Project Content -->
      <div v-else-if="selectedProject">
        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
          <div class="flex items-center gap-4">
            <NuxtLink
              to="/projects"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </NuxtLink>
            <div>
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                {{ selectedProject.name }}
              </h1>
              <p v-if="selectedProject.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {{ selectedProject.description }}
              </p>
            </div>
          </div>
          <button
            @click="activeTab = 'settings'"
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            Edit Project
          </button>
        </div>

        <!-- Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav class="flex gap-8" aria-label="Tabs">
            <button
              @click="activeTab = 'integrations'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'integrations'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
              ]"
            >
              Integrations
            </button>
            <button
              @click="activeTab = 'workflow'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'workflow'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
              ]"
            >
              Workflow
            </button>
            <button
              @click="activeTab = 'settings'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
              ]"
            >
              Settings
            </button>
          </nav>
        </div>

        <!-- Tab Content: Integrations -->
        <div v-if="activeTab === 'integrations'" class="space-y-6">
          <!-- GitHub Integration -->
          <IntegrationCard
            provider="GITHUB"
            :project-id="selectedProject.id"
            @connected="handleIntegrationChange"
            @disconnected="handleIntegrationChange"
          >
            <template #config>
              <form @submit.prevent="saveIntegrationConfig" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Repository
                  </label>
                  <input
                    v-model="configForm.githubIssuesRepo"
                    type="text"
                    placeholder="owner/repo"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    e.g. facebook/react
                  </p>
                </div>
                <button
                  type="submit"
                  :disabled="integrationConfigLoading"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {{ integrationConfigLoading ? 'Saving...' : 'Save Configuration' }}
                </button>
              </form>
            </template>
          </IntegrationCard>

          <!-- Linear Integration -->
          <IntegrationCard
            provider="LINEAR"
            :project-id="selectedProject.id"
            @connected="handleIntegrationChange"
            @disconnected="handleIntegrationChange"
          />

          <!-- Figma Integration -->
          <IntegrationCard
            provider="FIGMA"
            :project-id="selectedProject.id"
            @connected="handleIntegrationChange"
            @disconnected="handleIntegrationChange"
          >
            <template #config>
              <form @submit.prevent="saveIntegrationConfig" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Figma File Key
                  </label>
                  <input
                    v-model="configForm.figmaFileKey"
                    type="text"
                    placeholder="TfJw2zsGB11mbievCt5c3n"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Found in Figma URL between /file/ and /
                  </p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Node ID (Optional)
                  </label>
                  <input
                    v-model="configForm.figmaNodeId"
                    type="text"
                    placeholder="0-1"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Specific node to extract context from
                  </p>
                </div>
                <button
                  type="submit"
                  :disabled="integrationConfigLoading"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {{ integrationConfigLoading ? 'Saving...' : 'Save Configuration' }}
                </button>
              </form>
            </template>
          </IntegrationCard>

          <!-- Sentry Integration -->
          <IntegrationCard
            provider="SENTRY"
            :project-id="selectedProject.id"
            @connected="handleIntegrationChange"
            @disconnected="handleIntegrationChange"
          >
            <template #config>
              <form @submit.prevent="saveIntegrationConfig" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Organization Slug
                  </label>
                  <input
                    v-model="configForm.sentryOrgSlug"
                    type="text"
                    placeholder="my-organization"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Slug
                  </label>
                  <input
                    v-model="configForm.sentryProjectSlug"
                    type="text"
                    placeholder="my-project"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  :disabled="integrationConfigLoading"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {{ integrationConfigLoading ? 'Saving...' : 'Save Configuration' }}
                </button>
              </form>
            </template>
          </IntegrationCard>
        </div>

        <!-- Tab Content: Workflow -->
        <div v-if="activeTab === 'workflow'">
          <WorkflowConfig
            :project-id="selectedProject.id"
            :initial-config="selectedProject.config?.automation"
            :oauth-connections="oauthConnections"
            @saved="handleWorkflowConfigSaved"
          />
        </div>

        <!-- Tab Content: Settings -->
        <div v-if="activeTab === 'settings'">
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">Project Settings</h2>
            <form @submit.prevent="saveProjectSettings" class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name
                </label>
                <input
                  v-model="settingsForm.name"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  v-model="settingsForm.description"
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Repository URL
                </label>
                <input
                  v-model="settingsForm.repository"
                  type="url"
                  placeholder="https://github.com/owner/repo"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workspace Path
                </label>
                <input
                  v-model="settingsForm.workspacePath"
                  type="text"
                  placeholder="/path/to/workspace"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div class="flex items-center gap-4">
                <button
                  type="submit"
                  :disabled="settingsLoading"
                  class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {{ settingsLoading ? 'Saving...' : 'Save Changes' }}
                </button>
                <button
                  type="button"
                  @click="resetSettingsForm"
                  class="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useIntegrationsStore } from '@/stores/integrations'
import { storeToRefs } from 'pinia'
import IntegrationCard from '@/components/IntegrationCard.vue'
import WorkflowConfig from '@/components/workflow/WorkflowConfig.vue'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const projectId = computed(() => route.params.id as string)

const projectsStore = useProjectsStore()
const integrationsStore = useIntegrationsStore()
const { selectedProject, loading: projectsLoading } = storeToRefs(projectsStore)
const { integrationConfig, connections, loading: integrationsLoading } = storeToRefs(integrationsStore)

// OAuth connections formatted for WorkflowConfig component
const oauthConnections = computed(() => {
  return connections.value.map((conn) => ({
    provider: conn.provider,
    isActive: conn.isActive && !conn.refreshFailed,
  }))
})

const activeTab = ref<'integrations' | 'workflow' | 'settings'>('integrations')
const pageLoading = ref(true)
const pageError = ref<string | null>(null)

// Settings form
const settingsForm = ref({
  name: '',
  description: '',
  repository: '',
  workspacePath: '',
})
const settingsLoading = ref(false)

// Integration config form
const configForm = ref({
  figmaFileKey: '',
  figmaNodeId: '',
  sentryOrgSlug: '',
  sentryProjectSlug: '',
  githubIssuesRepo: '',
})
const integrationConfigLoading = ref(false)

// Load project data
onMounted(async () => {
  try {
    pageLoading.value = true
    pageError.value = null

    // Select project if not already selected
    if (selectedProject.value?.id !== projectId.value) {
      projectsStore.selectProject(projectId.value)
      // Fetch full project list if needed
      if (!selectedProject.value) {
        await projectsStore.fetchProjects()
      }
    }

    if (!selectedProject.value) {
      pageError.value = 'Project not found'
      return
    }

    // Load integrations data
    await Promise.all([
      integrationsStore.fetchConnections(projectId.value),
      integrationsStore.fetchIntegrationConfig(projectId.value),
    ])

    // Initialize forms
    resetSettingsForm()
    resetConfigForm()
  } catch (e: any) {
    pageError.value = e.message || 'Failed to load project'
  } finally {
    pageLoading.value = false
  }
})

// Watch for integration config changes
watch(integrationConfig, (newConfig) => {
  if (newConfig) {
    resetConfigForm()
  }
})

const resetSettingsForm = () => {
  if (selectedProject.value) {
    settingsForm.value = {
      name: selectedProject.value.name || '',
      description: selectedProject.value.description || '',
      repository: selectedProject.value.repository || '',
      workspacePath: selectedProject.value.workspacePath || '',
    }
  }
}

const resetConfigForm = () => {
  if (integrationConfig.value) {
    configForm.value = {
      figmaFileKey: integrationConfig.value.figmaFileKey || '',
      figmaNodeId: integrationConfig.value.figmaNodeId || '',
      sentryOrgSlug: integrationConfig.value.sentryOrgSlug || '',
      sentryProjectSlug: integrationConfig.value.sentryProjectSlug || '',
      githubIssuesRepo: integrationConfig.value.githubIssuesRepo || '',
    }
  }
}

const saveProjectSettings = async () => {
  try {
    settingsLoading.value = true
    await projectsStore.updateProject(projectId.value, settingsForm.value)
    activeTab.value = 'integrations'
  } catch (e: any) {
    alert(`Failed to save project settings: ${e.message}`)
  } finally {
    settingsLoading.value = false
  }
}

const saveIntegrationConfig = async () => {
  try {
    integrationConfigLoading.value = true
    await integrationsStore.updateIntegrationConfig(projectId.value, configForm.value)
    alert('Integration configuration saved successfully')
  } catch (e: any) {
    alert(`Failed to save integration configuration: ${e.message}`)
  } finally {
    integrationConfigLoading.value = false
  }
}

const handleIntegrationChange = async () => {
  // Refresh connections list after connect/disconnect
  await integrationsStore.fetchConnections(projectId.value)
}

const handleWorkflowConfigSaved = async () => {
  // Refresh project data to get updated config
  await projectsStore.fetchProjects()
}
</script>
