<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <div class="max-w-4xl mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {{ headerTitle }}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ headerSubtitle }}
          </p>
        </div>

        <!-- Step 1: Team ID Input -->
        <div v-if="step === 'team-input'" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Figma Team ID
            </label>
            <input
              v-model="teamId"
              type="text"
              placeholder="1234567890123456789"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @keyup.enter="loadProjects"
            />
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Trouvez votre team ID dans l'URL Figma :
              <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                figma.com/files/team/<strong>TEAM_ID</strong>/...
              </code>
            </p>
          </div>

          <div class="flex gap-3">
            <button
              @click="loadProjects"
              :disabled="!teamId || loading"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ loading ? 'Chargement...' : 'Continuer' }}
            </button>
            <button
              @click="skip"
              class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                     rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Ignorer et configurer plus tard
            </button>
          </div>
        </div>

        <!-- Step 2: Projects List -->
        <div v-if="step === 'projects'" class="space-y-4">
          <button
            @click="backToTeamInput"
            class="flex items-center text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span class="mr-1">←</span> Retour
          </button>

          <input
            v-model="searchQuery"
            type="text"
            placeholder="Rechercher un projet..."
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <div v-if="loading" class="text-center py-8 text-gray-600 dark:text-gray-400">
            Chargement des projets...
          </div>
          <div v-else-if="filteredProjects.length === 0" class="text-center py-8 text-gray-600 dark:text-gray-400">
            Aucun projet trouvé
          </div>
          <div v-else class="space-y-2 max-h-96 overflow-y-auto">
            <div
              v-for="project in filteredProjects"
              :key="project.id"
              @click="selectProject(project)"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer
                     hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <h3 class="font-medium text-gray-900 dark:text-white">{{ project.name }}</h3>
            </div>
          </div>
        </div>

        <!-- Step 3: Files List -->
        <div v-if="step === 'files'" class="space-y-4">
          <button
            @click="backToProjects"
            class="flex items-center text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span class="mr-1">←</span> Retour aux projets
          </button>

          <input
            v-model="searchQuery"
            type="text"
            placeholder="Rechercher un fichier..."
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <div v-if="loading" class="text-center py-8 text-gray-600 dark:text-gray-400">
            Chargement des fichiers...
          </div>
          <div v-else-if="filteredFiles.length === 0" class="text-center py-8 text-gray-600 dark:text-gray-400">
            Aucun fichier dans ce projet
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            <div
              v-for="file in filteredFiles"
              :key="file.key"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <img
                v-if="file.thumbnail_url"
                :src="file.thumbnail_url"
                :alt="file.name"
                class="w-full h-32 object-cover rounded mb-2"
              />
              <h3 class="font-medium text-gray-900 dark:text-white mb-2">{{ file.name }}</h3>
              <button
                @click="selectFile(file)"
                class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sélectionner
              </button>
            </div>
          </div>
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
const projectId = route.query.projectId as string

interface FigmaProject {
  id: string
  name: string
}

interface FigmaFileListItem {
  key: string
  name: string
  thumbnail_url?: string
  last_modified: string
}

const step = ref<'team-input' | 'projects' | 'files'>('team-input')
const teamId = ref('')
const selectedProjectId = ref('')
const selectedProjectName = ref('')
const projects = ref<FigmaProject[]>([])
const files = ref<FigmaFileListItem[]>([])
const searchQuery = ref('')
const loading = ref(false)
const error = ref('')

const headerTitle = computed(() => {
  switch (step.value) {
    case 'team-input':
      return 'Entrez votre Team ID Figma'
    case 'projects':
      return 'Sélectionnez un projet'
    case 'files':
      return `Sélectionnez un fichier`
    default:
      return ''
  }
})

const headerSubtitle = computed(() => {
  switch (step.value) {
    case 'team-input':
      return 'Identifiez la team Figma à partir de laquelle vous souhaitez extraire des designs'
    case 'projects':
      return `Team: ${teamId.value}`
    case 'files':
      return `Projet: ${selectedProjectName.value}`
    default:
      return ''
  }
})

const filteredProjects = computed(() => {
  if (!searchQuery.value) return projects.value
  const query = searchQuery.value.toLowerCase()
  return projects.value.filter(p => p.name.toLowerCase().includes(query))
})

const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value
  const query = searchQuery.value.toLowerCase()
  return files.value.filter(f => f.name.toLowerCase().includes(query))
})

const loadProjects = async () => {
  if (!teamId.value) return

  try {
    loading.value = true
    error.value = ''
    searchQuery.value = ''

    const response = await $fetch<{ projects: FigmaProject[] }>(
      `/api/v1/integrations/figma/teams/${teamId.value}/projects?projectId=${projectId}`
    )

    projects.value = response.projects
    step.value = 'projects'
  } catch (e: any) {
    error.value = e.data?.message || 'Team introuvable ou token expiré. Veuillez vérifier le Team ID et réessayer.'
  } finally {
    loading.value = false
  }
}

const selectProject = async (project: FigmaProject) => {
  try {
    loading.value = true
    error.value = ''
    searchQuery.value = ''
    selectedProjectId.value = project.id
    selectedProjectName.value = project.name

    const response = await $fetch<{ files: FigmaFileListItem[] }>(
      `/api/v1/integrations/figma/projects/${project.id}/files?projectId=${projectId}`
    )

    files.value = response.files
    step.value = 'files'
  } catch (e: any) {
    error.value = e.data?.message || 'Impossible de charger les fichiers. Veuillez réessayer.'
  } finally {
    loading.value = false
  }
}

const selectFile = async (file: FigmaFileListItem) => {
  try {
    loading.value = true
    error.value = ''

    // Save selection to project config
    await $fetch(`/api/v1/projects/${projectId}/integrations`, {
      method: 'PUT',
      body: {
        figmaTeamId: teamId.value,
        figmaProjectId: selectedProjectId.value,
        figmaFileKey: file.key
      }
    })

    // Notify parent window and close
    if (window.opener) {
      window.opener.postMessage({
        type: 'OAUTH_SUCCESS',
        provider: 'FIGMA',
        fileKey: file.key
      }, window.location.origin)
    }

    window.close()
  } catch (e: any) {
    error.value = e.data?.message || 'Erreur lors de la sauvegarde. Veuillez réessayer.'
    loading.value = false
  }
}

const skip = () => {
  // Close without selecting (user can configure manually later)
  if (window.opener) {
    window.opener.postMessage({
      type: 'OAUTH_SUCCESS',
      provider: 'FIGMA'
    }, window.location.origin)
  }
  window.close()
}

const backToTeamInput = () => {
  step.value = 'team-input'
  projects.value = []
  searchQuery.value = ''
  error.value = ''
}

const backToProjects = () => {
  step.value = 'projects'
  files.value = []
  searchQuery.value = ''
  error.value = ''
}
</script>
