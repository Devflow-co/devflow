<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your DevFlow projects and integrations
          </p>
        </div>
        <NuxtLink
          to="/projects/new"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Project
        </NuxtLink>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <!-- Error State -->
      <div
        v-else-if="error"
        class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center"
      >
        <svg
          class="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p class="text-red-800 dark:text-red-200 font-medium mb-2">Failed to load projects</p>
        <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
        <button
          @click="fetchProjects"
          class="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="projects.length === 0"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center"
      >
        <svg
          class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No projects yet</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Create your first project to start managing your integrations and workflows.
        </p>
        <NuxtLink
          to="/projects/new"
          class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Your First Project
        </NuxtLink>
      </div>

      <!-- Projects Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="project in projects"
          :key="project.id"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer group relative"
          @click="navigateToProject(project.id)"
        >
          <!-- Delete Button -->
          <button
            @click.stop="handleDelete(project.id, project.name)"
            class="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete project"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>

          <!-- Project Info -->
          <div class="mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate pr-8">
              {{ project.name }}
            </h3>
            <p v-if="project.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {{ project.description }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Created {{ formatDate(project.createdAt) }}
            </p>
          </div>

          <!-- Stats -->
          <div v-if="project._count" class="flex items-center gap-4 mb-4 text-sm">
            <div class="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <span>{{ project._count.tasks }} tasks</span>
            </div>
            <div class="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span>{{ project._count.workflows }} workflows</span>
            </div>
          </div>

          <!-- Integration Status Badges -->
          <div class="flex flex-wrap gap-2">
            <StatusBadge :status="getIntegrationStatus(project, 'GITHUB')" />
            <StatusBadge :status="getIntegrationStatus(project, 'LINEAR')" />
            <StatusBadge :status="getIntegrationStatus(project, 'FIGMA')" />
            <StatusBadge :status="getIntegrationStatus(project, 'SENTRY')" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import StatusBadge from '@/components/StatusBadge.vue'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const projectsStore = useProjectsStore()
const { projects, loading, error } = storeToRefs(projectsStore)

onMounted(async () => {
  try {
    await projectsStore.fetchProjects()
  } catch (e) {
    console.error('Failed to fetch projects:', e)
  }
})

const navigateToProject = (projectId: string) => {
  router.push(`/projects/${projectId}`)
}

const handleDelete = async (projectId: string, projectName: string) => {
  if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
    return
  }

  try {
    await projectsStore.deleteProject(projectId)
  } catch (e: any) {
    alert(`Failed to delete project: ${e.message}`)
  }
}

const getIntegrationStatus = (project: any, provider: string): 'connected' | 'disconnected' | 'not_configured' => {
  if (!project.oauthConnections) return 'not_configured'

  const connection = project.oauthConnections.find((c: any) => c.provider === provider && c.isActive)
  if (connection) {
    return connection.refreshFailed ? 'disconnected' : 'connected'
  }

  return 'not_configured'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`

  return date.toLocaleDateString()
}
</script>
