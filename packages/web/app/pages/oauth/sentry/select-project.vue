<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <div class="max-w-4xl mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <!-- Header -->
        <div class="mb-6">
          <div class="flex items-center gap-3 mb-2">
            <!-- Sentry Logo -->
            <svg class="w-8 h-8" viewBox="0 0 72 66" fill="none">
              <path d="M29 2.26a3.68 3.68 0 0 0-6.37 0L.06 40.94a3.68 3.68 0 0 0 .54 4.21l.47.43a3.68 3.68 0 0 0 4.38.45l.44-.28a35.18 35.18 0 0 1 17.68-4.74h.09a35.1 35.1 0 0 1 15.35 3.51l.51.24a3.68 3.68 0 0 0 4.16-.73l.43-.43a3.68 3.68 0 0 0 .54-4.21L29 2.26z" fill="#362D59"/>
              <path d="M42.63 2.26a3.68 3.68 0 0 1 6.37 0l22.57 38.68a3.68 3.68 0 0 1-.54 4.21l-.47.43a3.68 3.68 0 0 1-4.38.45l-.44-.28a35.18 35.18 0 0 0-17.68-4.74h-.09a35.1 35.1 0 0 0-15.35 3.51l-.51.24a3.68 3.68 0 0 1-4.16-.73l-.43-.43a3.68 3.68 0 0 1-.54-4.21L42.63 2.26z" fill="#362D59"/>
            </svg>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ headerTitle }}
            </h1>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ headerSubtitle }}
          </p>
        </div>

        <!-- Step 1: Organizations List -->
        <div v-if="step === 'organizations'" class="space-y-4">
          <div v-if="loading" class="text-center py-8 text-gray-600 dark:text-gray-400">
            Loading organizations...
          </div>
          <template v-else>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search organization..."
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div v-if="filteredOrganizations.length === 0" class="text-center py-8 text-gray-600 dark:text-gray-400">
              No organizations found
            </div>
            <div v-else class="space-y-2 max-h-96 overflow-y-auto">
              <div
                v-for="org in filteredOrganizations"
                :key="org.id"
                @click="selectOrganization(org)"
                class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer
                       hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors flex items-center justify-between"
              >
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">{{ org.name }}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ org.slug }}</p>
                </div>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          </template>

          <div class="flex gap-3 pt-4">
            <button
              @click="skip"
              class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                     rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Skip and configure later
            </button>
          </div>
        </div>

        <!-- Step 2: Projects List -->
        <div v-if="step === 'projects'" class="space-y-4">
          <button
            @click="backToOrganizations"
            class="flex items-center text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span class="mr-1">&larr;</span> Back to organizations
          </button>

          <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 class="font-medium text-gray-900 dark:text-white mb-1">
              Selected organization: {{ selectedOrganization?.name }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ selectedOrganization?.slug }}
            </p>
          </div>

          <div v-if="loadingProjects" class="text-center py-8 text-gray-600 dark:text-gray-400">
            Loading projects...
          </div>
          <template v-else>
            <input
              v-model="projectSearchQuery"
              type="text"
              placeholder="Search project..."
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div v-if="filteredProjects.length === 0" class="text-center py-8 text-gray-600 dark:text-gray-400">
              No projects found in this organization
            </div>
            <div v-else class="space-y-2 max-h-96 overflow-y-auto">
              <div
                v-for="project in filteredProjects"
                :key="project.id"
                @click="selectProject(project)"
                class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer
                       hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-3 h-3 rounded-full"
                      :style="{ backgroundColor: project.color || '#6b5b95' }"
                    ></div>
                    <div>
                      <h3 class="font-medium text-gray-900 dark:text-white">{{ project.name }}</h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ project.slug }}
                        <span v-if="project.platform" class="ml-2 text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                          {{ project.platform }}
                        </span>
                      </p>
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p class="text-red-800 dark:text-red-200">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string
const projectId = route.query.projectId as string

interface SentryOrganization {
  id: string
  slug: string
  name: string
  status: {
    id: string
    name: string
  }
}

interface SentryProject {
  id: string
  slug: string
  name: string
  platform?: string
  color?: string
  organization: {
    id: string
    slug: string
    name: string
  }
}

const step = ref<'organizations' | 'projects'>('organizations')
const organizations = ref<SentryOrganization[]>([])
const projects = ref<SentryProject[]>([])
const selectedOrganization = ref<SentryOrganization | null>(null)
const searchQuery = ref('')
const projectSearchQuery = ref('')
const loading = ref(true)
const loadingProjects = ref(false)
const saving = ref(false)
const error = ref('')

const headerTitle = computed(() => {
  switch (step.value) {
    case 'organizations':
      return 'Select a Sentry Organization'
    case 'projects':
      return 'Select a Sentry Project'
    default:
      return ''
  }
})

const headerSubtitle = computed(() => {
  switch (step.value) {
    case 'organizations':
      return 'Choose the organization that contains your project'
    case 'projects':
      return 'Select the project to link with DevFlow'
    default:
      return ''
  }
})

const filteredOrganizations = computed(() => {
  if (!searchQuery.value) return organizations.value
  const query = searchQuery.value.toLowerCase()
  return organizations.value.filter(o =>
    o.name.toLowerCase().includes(query) ||
    o.slug.toLowerCase().includes(query)
  )
})

const filteredProjects = computed(() => {
  if (!projectSearchQuery.value) return projects.value
  const query = projectSearchQuery.value.toLowerCase()
  return projects.value.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.slug.toLowerCase().includes(query) ||
    (p.platform && p.platform.toLowerCase().includes(query))
  )
})

// Load organizations on mount
onMounted(async () => {
  try {
    const response = await $fetch<SentryOrganization[]>(
      `${apiBase}/projects/${projectId}/sentry/organizations`,
      { credentials: 'include' }
    )
    organizations.value = response
  } catch (e: any) {
    error.value = e.data?.message || 'Unable to load organizations. Make sure Sentry is connected.'
  } finally {
    loading.value = false
  }
})

const selectOrganization = async (org: SentryOrganization) => {
  selectedOrganization.value = org
  step.value = 'projects'
  error.value = ''
  projects.value = []
  projectSearchQuery.value = ''

  try {
    loadingProjects.value = true
    const response = await $fetch<SentryProject[]>(
      `${apiBase}/projects/${projectId}/sentry/projects/${org.slug}`,
      { credentials: 'include' }
    )
    projects.value = response
  } catch (e: any) {
    error.value = e.data?.message || 'Unable to load projects.'
  } finally {
    loadingProjects.value = false
  }
}

const selectProject = async (project: SentryProject) => {
  if (!selectedOrganization.value) return

  try {
    saving.value = true
    error.value = ''

    // Save project selection
    await $fetch(`${apiBase}/projects/${projectId}/sentry/project`, {
      method: 'POST',
      credentials: 'include',
      body: {
        orgSlug: selectedOrganization.value.slug,
        projectSlug: project.slug
      }
    })

    // Notify parent window and close
    if (window.opener) {
      window.opener.postMessage({
        type: 'SENTRY_PROJECT_SUCCESS',
        orgSlug: selectedOrganization.value.slug,
        projectSlug: project.slug,
        projectName: project.name
      }, window.location.origin)
    }

    window.close()
  } catch (e: any) {
    error.value = e.data?.message || 'Error saving selection.'
    saving.value = false
  }
}

const skip = () => {
  if (window.opener) {
    window.opener.postMessage({
      type: 'SENTRY_PROJECT_SUCCESS'
    }, window.location.origin)
  }
  window.close()
}

const backToOrganizations = () => {
  step.value = 'organizations'
  selectedOrganization.value = null
  projects.value = []
  projectSearchQuery.value = ''
  error.value = ''
}
</script>
