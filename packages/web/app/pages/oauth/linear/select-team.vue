<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <div class="max-w-4xl mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <!-- Header -->
        <div class="mb-6">
          <div class="flex items-center gap-3 mb-2">
            <!-- Linear Logo -->
            <svg class="w-8 h-8" viewBox="0 0 100 100" fill="none">
              <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.08887215.5599.28957055.7606L52.3503 99.7085c.2007.2007.4773.3072.7606.2896 2.3692-.1476 4.6938-.46 6.9624-.9259.7645-.157 1.0301-1.0963.4782-1.6481L4.57594 41.4485c-.55186-.5765-1.49118-.2863-1.64806.4782-.46595 2.2686-.77838 4.5932-.92598 6.9624ZM4.21093 29.7054c-.16649.3738-.08169.8106.20765 1.1l64.77602 64.776c.2894.2894.7262.3741 1.1.2077 1.7861-.7946 3.5171-1.6985 5.1855-2.7048.6739-.4064.7426-1.3454.1542-1.8373L8.68553 24.3923c-.48762-.4918-1.43089-.5765-1.83731.1542-1.00625 1.6684-1.91014 3.3994-2.70481 5.1855-.01869-.0187-.01869-.0373-.01869-.0373 0 .0187 0 .0373.00621.0187ZM12.6587 18.074c-.3706-.3706-.3706-.9717 0-1.3423l6.4122-6.4123c.3706-.3706.9717-.3706 1.3423 0L87.6805 77.5765c.3706.3706.3706.9717 0 1.3423l-6.4122 6.4122c-.3706.3706-.9717.3706-1.3423 0L12.6587 18.074ZM24.2046 5.48074c-.4064-.67387-1.3454-.74252-1.8373-.15425L17.9198 10.3247c-.5187.5186-.4495 1.3765.1543 1.8373l65.7088 56.1959c.4919.4215 1.2328.3715 1.6481-.0438l5.0466-5.0466c.4153-.4153.4653-1.1562.0438-1.648L24.2046 5.48074ZM38.8792.32675C38.0236-.114562 37.0845.173986 36.6781.838086l-5.2155 8.28396c-.3376.53727-.2355 1.2486.2325 1.65225l59.2546 50.02869c.3721.3141.9327.2941 1.2768-.0502l4.8759-4.8759c.3442-.3442.3643-.9047.0502-1.2768L47.1273 5.54562c-.3723-.44016-.9483-.62253-1.465-.40728L38.8792.32675Z" fill="#5E6AD2"/>
            </svg>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ headerTitle }}
            </h1>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ headerSubtitle }}
          </p>
        </div>

        <!-- Step 1: Teams List -->
        <div v-if="step === 'teams'" class="space-y-4">
          <div v-if="loading" class="text-center py-8 text-gray-600 dark:text-gray-400">
            Chargement des teams...
          </div>
          <template v-else>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Rechercher une team..."
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div v-if="filteredTeams.length === 0" class="text-center py-8 text-gray-600 dark:text-gray-400">
              Aucune team trouvee
            </div>
            <div v-else class="space-y-2 max-h-96 overflow-y-auto">
              <div
                v-for="team in filteredTeams"
                :key="team.id"
                @click="selectTeam(team)"
                class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer
                       hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors flex items-center justify-between"
              >
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">{{ team.name }}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ team.key }}</p>
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
              Ignorer et configurer plus tard
            </button>
          </div>
        </div>

        <!-- Step 2: Workflow States Validation -->
        <div v-if="step === 'validation'" class="space-y-4">
          <button
            @click="backToTeams"
            class="flex items-center text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span class="mr-1">&larr;</span> Retour aux teams
          </button>

          <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 class="font-medium text-gray-900 dark:text-white mb-1">
              Team selectionnee: {{ selectedTeam?.name }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ selectedTeam?.key }}
            </p>
          </div>

          <div v-if="validating" class="text-center py-8 text-gray-600 dark:text-gray-400">
            Validation des workflow states...
          </div>
          <template v-else-if="validation">
            <!-- Validation Success -->
            <div v-if="validation.valid" class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <span class="font-medium text-green-800 dark:text-green-200">
                  Configuration complete
                </span>
              </div>
              <p class="text-sm text-green-700 dark:text-green-300">
                Les {{ validation.totalRequired }} workflow states DevFlow sont configures.
              </p>
            </div>

            <!-- Missing States -->
            <div v-else class="space-y-4">
              <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  <span class="font-medium text-yellow-800 dark:text-yellow-200">
                    {{ validation.missingStates.length }} workflow states manquants
                  </span>
                </div>
                <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                  Certains workflow states DevFlow ne sont pas configures dans cette team.
                </p>
                <details class="text-sm">
                  <summary class="cursor-pointer text-yellow-600 dark:text-yellow-400 hover:underline">
                    Voir les etats manquants
                  </summary>
                  <ul class="mt-2 pl-4 space-y-1 text-yellow-700 dark:text-yellow-300">
                    <li v-for="state in validation.missingStates" :key="state" class="flex items-center gap-2">
                      <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      {{ state }}
                    </li>
                  </ul>
                </details>
              </div>

              <button
                @click="createMissingStates"
                :disabled="creating"
                class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {{ creating ? 'Creation en cours...' : `Creer les ${validation.missingStates.length} etats manquants` }}
              </button>
            </div>

            <!-- Existing States Summary -->
            <div v-if="validation.existingStates.length > 0" class="mt-4">
              <details class="text-sm">
                <summary class="cursor-pointer text-gray-600 dark:text-gray-400 hover:underline">
                  {{ validation.existingStates.length }} etats deja configures
                </summary>
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <div
                    v-for="state in validation.existingStates"
                    :key="state.id"
                    class="flex items-center gap-2 text-gray-700 dark:text-gray-300"
                  >
                    <span
                      class="w-3 h-3 rounded-full"
                      :style="{ backgroundColor: state.color || '#bec2c8' }"
                    ></span>
                    {{ state.name }}
                  </div>
                </div>
              </details>
            </div>
          </template>

          <!-- Confirm Button -->
          <div v-if="validation?.valid || creationResult" class="pt-4">
            <button
              @click="confirmSelection"
              :disabled="saving"
              class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {{ saving ? 'Sauvegarde...' : 'Confirmer la selection' }}
            </button>
          </div>
        </div>

        <!-- Creation Result -->
        <div v-if="creationResult" class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span class="font-medium text-blue-800 dark:text-blue-200">
              {{ creationResult.created.length }} etats crees
            </span>
          </div>
          <p v-if="creationResult.errors.length > 0" class="text-sm text-red-600 dark:text-red-400">
            {{ creationResult.errors.length }} erreur(s) lors de la creation
          </p>
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

interface LinearTeam {
  id: string
  key: string
  name: string
}

interface WorkflowState {
  id: string
  name: string
  type: string
  color?: string
}

interface ValidationResult {
  valid: boolean
  existingStates: WorkflowState[]
  missingStates: string[]
  totalRequired: number
}

interface CreationResult {
  created: string[]
  existing: string[]
  errors: Array<{ name: string; error: string }>
}

const step = ref<'teams' | 'validation'>('teams')
const teams = ref<LinearTeam[]>([])
const selectedTeam = ref<LinearTeam | null>(null)
const validation = ref<ValidationResult | null>(null)
const creationResult = ref<CreationResult | null>(null)
const searchQuery = ref('')
const loading = ref(true)
const validating = ref(false)
const creating = ref(false)
const saving = ref(false)
const error = ref('')

const headerTitle = computed(() => {
  switch (step.value) {
    case 'teams':
      return 'Selectionnez une team Linear'
    case 'validation':
      return 'Configuration des workflow states'
    default:
      return ''
  }
})

const headerSubtitle = computed(() => {
  switch (step.value) {
    case 'teams':
      return 'Choisissez la team Linear dans laquelle vous gerez vos issues'
    case 'validation':
      return 'Verification de la configuration des etats de workflow DevFlow'
    default:
      return ''
  }
})

const filteredTeams = computed(() => {
  if (!searchQuery.value) return teams.value
  const query = searchQuery.value.toLowerCase()
  return teams.value.filter(t =>
    t.name.toLowerCase().includes(query) ||
    t.key.toLowerCase().includes(query)
  )
})

// Load teams on mount
onMounted(async () => {
  try {
    const response = await $fetch<LinearTeam[]>(
      `${apiBase}/projects/${projectId}/linear/teams`,
      { credentials: 'include' }
    )
    teams.value = response
  } catch (e: any) {
    error.value = e.data?.message || 'Impossible de charger les teams. Verifiez que Linear est connecte.'
  } finally {
    loading.value = false
  }
})

const selectTeam = async (team: LinearTeam) => {
  selectedTeam.value = team
  step.value = 'validation'
  error.value = ''
  validation.value = null
  creationResult.value = null

  try {
    validating.value = true
    const response = await $fetch<ValidationResult>(
      `${apiBase}/projects/${projectId}/linear/workflow-states/${team.id}/validate`,
      { credentials: 'include' }
    )
    validation.value = response
  } catch (e: any) {
    error.value = e.data?.message || 'Impossible de valider les workflow states.'
  } finally {
    validating.value = false
  }
}

const createMissingStates = async () => {
  if (!selectedTeam.value) return

  try {
    creating.value = true
    error.value = ''

    const response = await $fetch<CreationResult>(
      `${apiBase}/projects/${projectId}/linear/workflow-states/${selectedTeam.value.id}/create`,
      { method: 'POST', credentials: 'include' }
    )

    creationResult.value = response

    // Re-validate to update the UI
    const validationResponse = await $fetch<ValidationResult>(
      `${apiBase}/projects/${projectId}/linear/workflow-states/${selectedTeam.value.id}/validate`,
      { credentials: 'include' }
    )
    validation.value = validationResponse
  } catch (e: any) {
    error.value = e.data?.message || 'Erreur lors de la creation des workflow states.'
  } finally {
    creating.value = false
  }
}

const confirmSelection = async () => {
  if (!selectedTeam.value) return

  try {
    saving.value = true
    error.value = ''

    // Save team selection
    await $fetch(`${apiBase}/projects/${projectId}/linear/team`, {
      method: 'POST',
      credentials: 'include',
      body: { teamId: selectedTeam.value.id, teamName: selectedTeam.value.name }
    })

    // Notify parent window and close
    if (window.opener) {
      window.opener.postMessage({
        type: 'LINEAR_TEAM_SUCCESS',
        teamId: selectedTeam.value.id,
        teamName: selectedTeam.value.name
      }, window.location.origin)
    }

    window.close()
  } catch (e: any) {
    error.value = e.data?.message || 'Erreur lors de la sauvegarde.'
    saving.value = false
  }
}

const skip = () => {
  if (window.opener) {
    window.opener.postMessage({
      type: 'LINEAR_TEAM_SUCCESS'
    }, window.location.origin)
  }
  window.close()
}

const backToTeams = () => {
  step.value = 'teams'
  selectedTeam.value = null
  validation.value = null
  creationResult.value = null
  searchQuery.value = ''
  error.value = ''
}
</script>
