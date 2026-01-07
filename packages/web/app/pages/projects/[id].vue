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
          <!-- GitHub App Section -->
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-900 dark:bg-gray-700">
                  <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    GitHub App (Granular Access)
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    Select specific repositories or organizations
                  </p>
                </div>
              </div>

              <div v-if="githubAppInstallation">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300">
                  Installed
                </span>
              </div>
            </div>

            <!-- Not Installed State -->
            <div v-if="!githubAppInstallation" class="space-y-4">
              <div class="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                  </svg>
                  <div class="flex-1 text-sm">
                    <p class="font-medium text-blue-800 dark:text-blue-200 mb-1">Better Repository Control</p>
                    <p class="text-blue-700 dark:text-blue-300 mb-2">
                      GitHub Apps allow you to <strong>select specific repositories or entire organizations</strong> instead of granting access to all repositories.
                    </p>
                    <ul class="mt-2 pl-4 space-y-1 text-blue-700 dark:text-blue-300">
                      <li>✓ Choose individual repositories</li>
                      <li>✓ Select entire organizations</li>
                      <li>✓ Modify selection after installation</li>
                      <li>✓ More secure and precise access control</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                @click="handleInstallGitHubApp"
                :disabled="integrationsLoading"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ integrationsLoading ? 'Installing...' : 'Install GitHub App' }}
              </button>
            </div>

            <!-- Installed State -->
            <div v-else class="space-y-4">
              <div class="flex items-center justify-between mb-4">
                <div class="text-sm text-gray-700 dark:text-gray-300">
                  <div class="flex items-center gap-2 mb-1">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span class="font-medium">{{ githubAppInstallation.accountLogin }}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">({{ githubAppInstallation.accountType }})</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>
                      {{ githubAppInstallation.repositorySelection === 'all'
                        ? `All repos from ${githubAppInstallation.selectedOrgs.length} org(s)`
                        : `${githubAppInstallation.selectedRepos.length} selected repo(s)` }}
                    </span>
                  </div>
                </div>

                <button
                  @click="handleUninstallGitHubApp"
                  :disabled="integrationsLoading"
                  class="px-3 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Uninstall
                </button>
              </div>

              <!-- Repository Selection Component -->
              <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Repository Selection</h4>
                <GitHubAppSelector
                  :project-id="projectId"
                  @saved="handleGitHubAppSaved"
                  @synced="handleGitHubAppSynced"
                />
              </div>
            </div>
          </div>

          <!-- Linear Integration -->
          <IntegrationCard
            provider="LINEAR"
            :project-id="selectedProject.id"
            @connected="handleIntegrationChange"
            @disconnected="handleIntegrationChange"
          >
            <template #info>
              <div class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                  </svg>
                  <div class="flex-1 text-sm">
                    <p class="font-medium text-blue-800 dark:text-blue-200 mb-1">Workspace Access</p>
                    <p class="text-blue-700 dark:text-blue-300">
                      This connection grants access to <strong>all teams and issues</strong> in your Linear workspace.
                    </p>
                    <details class="mt-2">
                      <summary class="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                        What can DevFlow access?
                      </summary>
                      <ul class="mt-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs space-y-1">
                        <li>• Read and update issues</li>
                        <li>• Create comments</li>
                        <li>• Update issue status</li>
                        <li>• Read team and project information</li>
                      </ul>
                    </details>
                  </div>
                </div>
              </div>
            </template>
          </IntegrationCard>

          <!-- Figma Integration -->
          <IntegrationCard
            provider="FIGMA"
            :project-id="selectedProject.id"
            @connected="handleIntegrationChange"
            @disconnected="handleIntegrationChange"
          >
            <template #info>
              <div class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                  </svg>
                  <div class="flex-1 text-sm">
                    <p class="font-medium text-blue-800 dark:text-blue-200 mb-1">File Access</p>
                    <p class="text-blue-700 dark:text-blue-300">
                      This connection grants access to <strong>all files and teams</strong> you have access to in Figma.
                    </p>
                    <details class="mt-2">
                      <summary class="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                        What can DevFlow access?
                      </summary>
                      <ul class="mt-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs space-y-1">
                        <li>• Read file content and designs</li>
                        <li>• Read comments on files</li>
                        <li>• View your user profile</li>
                        <li>• Access shared team files</li>
                      </ul>
                    </details>
                  </div>
                </div>
              </div>
            </template>
            <template #config>
              <form @submit.prevent="saveIntegrationConfig" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Figma File Key
                  </label>
                  <div class="flex gap-2">
                    <input
                      v-model="configForm.figmaFileKey"
                      type="text"
                      placeholder="TfJw2zsGB11mbievCt5c3n"
                      class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      @click="openFigmaFilePicker"
                      class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    >
                      Browse Files
                    </button>
                  </div>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Found in Figma URL between /file/ and / or click "Browse Files" to select
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
            <template #info>
              <div class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                  </svg>
                  <div class="flex-1 text-sm">
                    <p class="font-medium text-blue-800 dark:text-blue-200 mb-1">Organization Access</p>
                    <p class="text-blue-700 dark:text-blue-300">
                      This connection grants read-only access to <strong>all projects and events</strong> in your Sentry organization.
                    </p>
                    <details class="mt-2">
                      <summary class="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                        What can DevFlow access?
                      </summary>
                      <ul class="mt-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs space-y-1">
                        <li>• Read error events and issues</li>
                        <li>• View project information</li>
                        <li>• Access organization data</li>
                        <li>• Read stack traces and metadata</li>
                      </ul>
                      <p class="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        Note: DevFlow has read-only access and cannot modify Sentry data.
                      </p>
                    </details>
                  </div>
                </div>
              </div>
            </template>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useIntegrationsStore } from '@/stores/integrations'
import { storeToRefs } from 'pinia'
import IntegrationCard from '@/components/IntegrationCard.vue'
import GitHubAppSelector from '@/components/GitHubAppSelector.vue'
import WorkflowConfig from '@/components/workflow/WorkflowConfig.vue'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const projectId = computed(() => route.params.id as string)

const projectsStore = useProjectsStore()
const integrationsStore = useIntegrationsStore()
const { selectedProject, loading: projectsLoading } = storeToRefs(projectsStore)
const { integrationConfig, connections, githubAppInstallation, loading: integrationsLoading } = storeToRefs(integrationsStore)

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

// Handle OAuth popup messages (for auto-refresh after connection)
const handleOAuthMessage = async (event: MessageEvent) => {
  // Verify origin matches our app
  if (event.origin !== window.location.origin) {
    return
  }

  // Check if this is an OAuth success message
  if (event.data?.type === 'OAUTH_SUCCESS' || event.data?.type === 'GITHUB_APP_SUCCESS') {
    console.log('OAuth success message received, refreshing integrations...')
    try {
      await Promise.all([
        integrationsStore.fetchConnections(projectId.value),
        integrationsStore.fetchIntegrationConfig(projectId.value),
        integrationsStore.fetchGitHubAppInstallation(projectId.value).catch(() => {}),
      ])
      resetConfigForm()
    } catch (e) {
      console.error('Failed to refresh integrations:', e)
    }
  }
}

// Load project data
onMounted(async () => {
  // Listen for OAuth popup messages
  window.addEventListener('message', handleOAuthMessage)

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
      integrationsStore.fetchGitHubAppInstallation(projectId.value).catch(() => {
        // Ignore errors if GitHub App is not installed
      }),
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

// Cleanup message listener
onUnmounted(() => {
  window.removeEventListener('message', handleOAuthMessage)
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

const openFigmaFilePicker = () => {
  const width = 800
  const height = 600
  const left = (window.screen.width / 2) - (width / 2)
  const top = (window.screen.height / 2) - (height / 2)

  window.open(
    `/oauth/figma/select-file?projectId=${projectId.value}`,
    'Figma File Picker',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
  )
}

const handleWorkflowConfigSaved = async () => {
  // Refresh project data to get updated config
  await projectsStore.fetchProjects()
}

// GitHub App handlers
const handleInstallGitHubApp = async () => {
  try {
    await integrationsStore.installGitHubApp(projectId.value)
    // After successful installation, fetch the installation data
    await integrationsStore.fetchGitHubAppInstallation(projectId.value)
  } catch (e: any) {
    alert(`Failed to install GitHub App: ${e.message}`)
  }
}

const handleUninstallGitHubApp = async () => {
  if (!confirm('Are you sure you want to uninstall the GitHub App? This will remove access to all repositories.')) {
    return
  }

  try {
    await integrationsStore.uninstallGitHubApp(projectId.value)
  } catch (e: any) {
    alert(`Failed to uninstall GitHub App: ${e.message}`)
  }
}

const handleGitHubAppSaved = async () => {
  // Refresh installation data after save
  await integrationsStore.fetchGitHubAppInstallation(projectId.value)
}

const handleGitHubAppSynced = async () => {
  // Data is already refreshed by the sync operation
  // No additional action needed
}
</script>
