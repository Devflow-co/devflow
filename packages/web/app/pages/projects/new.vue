<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center gap-4 mb-4">
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
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Create New Project</h1>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 ml-14">
          Set up a new DevFlow project to manage your integrations and workflows.
        </p>
      </div>

      <!-- Error Alert -->
      <div
        v-if="error"
        class="mb-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4"
      >
        <div class="flex items-start gap-3">
          <svg
            class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800 dark:text-red-200">Failed to create project</p>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error }}</p>
          </div>
          <button
            @click="error = null"
            class="text-red-400 hover:text-red-600 dark:hover:text-red-200"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Form -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 shadow-sm">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Project Name -->
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name
              <span class="text-red-500">*</span>
            </label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              required
              placeholder="My Awesome Project"
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              :class="{ 'border-red-500': validationErrors.name }"
            />
            <p v-if="validationErrors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.name }}
            </p>
          </div>

          <!-- Description -->
          <div>
            <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              v-model="form.description"
              rows="4"
              placeholder="A brief description of your project..."
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional. Helps team members understand the project's purpose.
            </p>
          </div>

          <!-- Repository URL -->
          <div>
            <label for="repository" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Repository URL
            </label>
            <input
              id="repository"
              v-model="form.repository"
              type="url"
              placeholder="https://github.com/owner/repo"
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              :class="{ 'border-red-500': validationErrors.repository }"
            />
            <p v-if="validationErrors.repository" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.repository }}
            </p>
            <p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional. Link to your GitHub, GitLab, or Bitbucket repository.
            </p>
          </div>

          <!-- Workspace Path -->
          <div>
            <label for="workspacePath" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Workspace Path
            </label>
            <input
              id="workspacePath"
              v-model="form.workspacePath"
              type="text"
              placeholder="/path/to/workspace"
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional. Local path where the project code is located.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              :disabled="loading"
              class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg
                v-if="loading"
                class="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ loading ? 'Creating Project...' : 'Create Project' }}
            </button>
            <NuxtLink
              to="/projects"
              class="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              Cancel
            </NuxtLink>
          </div>
        </form>
      </div>

      <!-- Info Box -->
      <div class="mt-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg
            class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd"
            />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Next Steps</p>
            <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
              After creating your project, you'll be able to connect OAuth integrations
              (GitHub, Linear, Figma, Sentry) and start managing your workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const projectsStore = useProjectsStore()

const form = ref({
  name: '',
  description: '',
  repository: '',
  workspacePath: '',
})

const loading = ref(false)
const error = ref<string | null>(null)
const validationErrors = ref<Record<string, string>>({})

const validateForm = (): boolean => {
  validationErrors.value = {}

  if (!form.value.name.trim()) {
    validationErrors.value.name = 'Project name is required'
  } else if (form.value.name.length < 3) {
    validationErrors.value.name = 'Project name must be at least 3 characters'
  } else if (form.value.name.length > 100) {
    validationErrors.value.name = 'Project name must be less than 100 characters'
  }

  if (form.value.repository && !isValidUrl(form.value.repository)) {
    validationErrors.value.repository = 'Please enter a valid URL'
  }

  return Object.keys(validationErrors.value).length === 0
}

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  try {
    loading.value = true
    error.value = null

    const project = await projectsStore.createProject({
      name: form.value.name.trim(),
      description: form.value.description.trim() || undefined,
      repository: form.value.repository.trim() || undefined,
      workspacePath: form.value.workspacePath.trim() || undefined,
    })

    // Redirect to project detail page
    router.push(`/projects/${project.id}`)
  } catch (e: any) {
    error.value = e.message || 'An unexpected error occurred'
    // Scroll to top to show error
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } finally {
    loading.value = false
  }
}
</script>
