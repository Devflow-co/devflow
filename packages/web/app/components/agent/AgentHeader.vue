<script setup lang="ts">
/**
 * AgentHeader - Minimal header for the agent chat interface
 */

import type { ConnectionStatus } from '~/types/agent.types'

const props = defineProps<{
  connectionStatus: ConnectionStatus
}>()

const emit = defineEmits<{
  newChat: []
}>()

const projectsStore = useProjectsStore()
const settingsStore = useSettingsStore()
const router = useRouter()

// Fetch data on mount
onMounted(async () => {
  if (!projectsStore.hasProjects) {
    await projectsStore.fetchProjects()
    projectsStore.restoreSelectedProject()
  }
  if (!settingsStore.userProfile) {
    await settingsStore.fetchUserProfile()
  }
})

/**
 * Connection status indicator
 */
const connectionIndicator = computed(() => {
  switch (props.connectionStatus) {
    case 'connected':
      return { color: 'bg-green-500', title: 'Connecté' }
    case 'connecting':
      return { color: 'bg-yellow-500 animate-pulse', title: 'Connexion...' }
    case 'disconnected':
      return { color: 'bg-gray-400', title: 'Déconnecté' }
    case 'error':
      return { color: 'bg-red-500', title: 'Erreur de connexion' }
  }
})

// User dropdown
const showUserMenu = ref(false)

function handleLogout() {
  // Clear all stores and redirect to login
  settingsStore.reset()
  projectsStore.selectProject(null)
  navigateTo('/login')
}
</script>

<template>
  <header class="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
    <!-- Left: Logo + New Chat -->
    <div class="flex items-center gap-3">
      <!-- Logo/Title -->
      <button
        class="flex items-center gap-2 rounded-lg px-2 py-1 text-lg font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800"
        title="Nouvelle conversation"
        @click="emit('newChat')"
      >
        <span>🤖</span>
        <span class="hidden sm:inline">DevFlow</span>
      </button>
    </div>

    <!-- Center: Project Selector -->
    <div class="flex items-center gap-2">
      <select
        :value="projectsStore.selectedProjectId"
        class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 outline-none transition-colors hover:border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        @change="(e) => projectsStore.selectProject((e.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>Sélectionner un projet</option>
        <option
          v-for="project in projectsStore.projects"
          :key="project.id"
          :value="project.id"
        >
          {{ project.name }}
        </option>
      </select>
    </div>

    <!-- Right: Status + Settings + User -->
    <div class="flex items-center gap-3">
      <!-- Connection status -->
      <div
        class="h-2 w-2 rounded-full"
        :class="connectionIndicator.color"
        :title="connectionIndicator.title"
      />

      <!-- Settings -->
      <NuxtLink
        to="/settings/profile"
        class="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        title="Paramètres"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </NuxtLink>

      <!-- User avatar dropdown -->
      <div class="relative">
        <button
          class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-400"
          @click="showUserMenu = !showUserMenu"
        >
          <img
            v-if="settingsStore.userProfile?.avatar"
            :src="settingsStore.userProfile.avatar"
            alt="Avatar"
            class="h-full w-full object-cover"
          />
          <span v-else>
            {{ settingsStore.userProfile?.name?.charAt(0) || settingsStore.userProfile?.email?.charAt(0) || '?' }}
          </span>
        </button>

        <!-- Dropdown menu -->
        <div
          v-if="showUserMenu"
          class="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          @click="showUserMenu = false"
        >
          <div class="border-b border-gray-200 px-4 py-2 dark:border-gray-700">
            <div class="truncate text-sm font-medium text-gray-900 dark:text-white">
              {{ settingsStore.userProfile?.name || 'Utilisateur' }}
            </div>
            <div class="truncate text-xs text-gray-500">
              {{ settingsStore.userProfile?.email }}
            </div>
          </div>
          <NuxtLink
            to="/settings/profile"
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Mon profil
          </NuxtLink>
          <NuxtLink
            to="/dashboard"
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Dashboard
          </NuxtLink>
          <button
            class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="handleLogout"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </div>

    <!-- Click outside to close menu -->
    <div
      v-if="showUserMenu"
      class="fixed inset-0 z-40"
      @click="showUserMenu = false"
    />
  </header>
</template>
