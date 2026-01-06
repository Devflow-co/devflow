<template>
  <div class="github-app-selector">
    <!-- Selection Type -->
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Repository Access
      </label>
      <div class="space-y-2">
        <label class="flex items-start p-3 border rounded-lg cursor-pointer transition-colors"
          :class="selectionType === 'all'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          <input
            type="radio"
            v-model="selectionType"
            value="all"
            class="mt-1 text-blue-600 focus:ring-blue-500"
          />
          <div class="ml-3 flex-1">
            <span class="block text-sm font-medium text-gray-900 dark:text-white">
              All repositories from selected organizations
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              Automatically access all current and future repositories in selected organizations
            </span>
          </div>
        </label>

        <label class="flex items-start p-3 border rounded-lg cursor-pointer transition-colors"
          :class="selectionType === 'selected'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          <input
            type="radio"
            v-model="selectionType"
            value="selected"
            class="mt-1 text-blue-600 focus:ring-blue-500"
          />
          <div class="ml-3 flex-1">
            <span class="block text-sm font-medium text-gray-900 dark:text-white">
              Only selected repositories
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              Choose specific repositories to access
            </span>
          </div>
        </label>
      </div>
    </div>

    <!-- Organization Selection (if "all") -->
    <div v-if="selectionType === 'all'" class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Select Organizations
      </label>
      <div v-if="availableOrgs.length === 0" class="text-sm text-gray-500 dark:text-gray-400 italic">
        No organizations found. Repositories from personal account will be used.
      </div>
      <div v-else class="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <label
          v-for="org in availableOrgs"
          :key="org"
          class="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded cursor-pointer"
        >
          <input
            type="checkbox"
            :value="org"
            v-model="selectedOrgs"
            class="text-blue-600 focus:ring-blue-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ org }}</span>
        </label>
      </div>
    </div>

    <!-- Repository Selection (if "selected") -->
    <div v-else class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Select Repositories
      </label>

      <!-- Search -->
      <div class="mb-3">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search repositories..."
            class="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <svg
            class="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <!-- Repository List -->
      <div v-if="filteredRepos.length === 0" class="text-sm text-gray-500 dark:text-gray-400 italic">
        {{ searchQuery ? 'No repositories match your search.' : 'No repositories found.' }}
      </div>
      <div v-else class="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <label
          v-for="repo in filteredRepos"
          :key="repo"
          class="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded cursor-pointer"
        >
          <input
            type="checkbox"
            :value="repo"
            v-model="selectedRepos"
            class="text-blue-600 focus:ring-blue-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300 font-mono">{{ repo }}</span>
        </label>
      </div>

      <!-- Selected Count -->
      <div v-if="selectedRepos.length > 0" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {{ selectedRepos.length }} {{ selectedRepos.length === 1 ? 'repository' : 'repositories' }} selected
      </div>
    </div>

    <!-- Sync Info -->
    <div v-if="installation?.lastSyncedAt" class="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>Last synced: {{ formatDate(installation.lastSyncedAt) }}</span>
    </div>

    <!-- Error Message -->
    <div v-if="installation?.syncError" class="mb-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">Sync Error</p>
          <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ installation.syncError }}</p>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center gap-3">
      <button
        @click="handleSave"
        :disabled="loading || !hasChanges"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ loading ? 'Saving...' : 'Save Selection' }}
      </button>

      <button
        @click="handleSync"
        :disabled="loading"
        class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {{ loading ? 'Syncing...' : 'Sync from GitHub' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useIntegrationsStore } from '@/stores/integrations'

interface Props {
  projectId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  saved: []
  synced: []
}>()

const integrationsStore = useIntegrationsStore()
const { githubAppInstallation, loading } = storeToRefs(integrationsStore)

const installation = computed(() => githubAppInstallation.value)

// Local state
const selectionType = ref<'all' | 'selected'>('all')
const selectedRepos = ref<string[]>([])
const selectedOrgs = ref<string[]>([])
const searchQuery = ref('')

// Available options from installation
const availableRepos = computed(() => {
  return installation.value?.selectedRepos || []
})

const availableOrgs = computed(() => {
  return installation.value?.selectedOrgs || []
})

// Filtered repositories based on search
const filteredRepos = computed(() => {
  if (!searchQuery.value) {
    return availableRepos.value
  }
  const query = searchQuery.value.toLowerCase()
  return availableRepos.value.filter((repo) => repo.toLowerCase().includes(query))
})

// Check if there are unsaved changes
const hasChanges = computed(() => {
  if (!installation.value) return false

  if (selectionType.value !== installation.value.repositorySelection) {
    return true
  }

  if (selectionType.value === 'all') {
    return JSON.stringify([...selectedOrgs.value].sort()) !==
           JSON.stringify([...installation.value.selectedOrgs].sort())
  } else {
    return JSON.stringify([...selectedRepos.value].sort()) !==
           JSON.stringify([...installation.value.selectedRepos].sort())
  }
})

// Initialize from installation data
const initializeFromInstallation = () => {
  if (!installation.value) return

  selectionType.value = installation.value.repositorySelection
  selectedRepos.value = [...installation.value.selectedRepos]
  selectedOrgs.value = [...installation.value.selectedOrgs]
}

// Watch for installation changes
watch(installation, () => {
  initializeFromInstallation()
}, { immediate: true })

// Actions
const handleSave = async () => {
  try {
    const selection = {
      selectionType: selectionType.value,
      repos: selectionType.value === 'selected' ? selectedRepos.value : undefined,
      orgs: selectionType.value === 'all' ? selectedOrgs.value : undefined,
    }

    await integrationsStore.updateGitHubRepoSelection(props.projectId, selection)
    emit('saved')
  } catch (e) {
    console.error('Failed to save repository selection:', e)
  }
}

const handleSync = async () => {
  try {
    await integrationsStore.fetchGitHubAppInstallation(props.projectId)
    emit('synced')
  } catch (e) {
    console.error('Failed to sync from GitHub:', e)
  }
}

// Utilities
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

// Initialize on mount
onMounted(() => {
  initializeFromInstallation()
})
</script>
