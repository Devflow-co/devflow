<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const analyticsStore = useAnalyticsStore()
const { loading, error } = storeToRefs(analyticsStore)

const projectAnalytics = computed(() =>
  analyticsStore.getProjectAnalytics(projectId.value)
)

// Fetch data on mount
onMounted(async () => {
  await analyticsStore.fetchProjectAnalytics(projectId.value)
})

// Handle date range change
async function handleDateRangeChange(preset: '7d' | '30d' | '90d' | 'ytd') {
  analyticsStore.setPresetDateRange(preset)
  await analyticsStore.fetchProjectAnalytics(projectId.value)
}

// Handle refresh
async function handleRefresh() {
  await analyticsStore.fetchProjectAnalytics(projectId.value)
}

// Go back to org analytics
function goBack() {
  router.push('/analytics')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Back Button & Header -->
      <div class="mb-6">
        <button
          @click="goBack"
          class="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux analytics
        </button>

        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ projectAnalytics?.project.name || 'Projet' }}
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span v-if="projectAnalytics?.project.repository">
                {{ projectAnalytics.project.repository }}
              </span>
              <span v-else>Analytics du projet</span>
            </p>
          </div>

          <AnalyticsHeader
            :loading="loading"
            @refresh="handleRefresh"
            @date-range-change="handleDateRangeChange"
          />
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !projectAnalytics" class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <svg class="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-600 dark:text-gray-400">Chargement des analytics...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <svg class="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 class="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Erreur de chargement</h3>
        <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
        <button
          @click="handleRefresh"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Réessayer
        </button>
      </div>

      <!-- Analytics Content -->
      <template v-else-if="projectAnalytics">
        <!-- KPI Cards -->
        <KPICards :summary="projectAnalytics.summary" />

        <!-- Cost Trend -->
        <div class="mb-6">
          <CostTrendChart :data="projectAnalytics.costTrend" />
        </div>

        <!-- AI Usage Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ModelDistributionChart :data="projectAnalytics.modelUsage" />
          <TokenUsageChart :data="projectAnalytics.modelUsage" />
        </div>

        <!-- Workflow Analytics Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <PhasePerformanceChart :data="projectAnalytics.workflows.byPhase" />
          <FailureAnalysisChart :data="projectAnalytics.workflows.failureAnalysis" />
        </div>

        <!-- Recent Activity -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activité Récente</h3>
          <div v-if="projectAnalytics.recentActivity.length > 0" class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th class="pb-3 font-medium">Tâche</th>
                  <th class="pb-3 font-medium">Status</th>
                  <th class="pb-3 font-medium">Phase</th>
                  <th class="pb-3 font-medium">Démarré</th>
                  <th class="pb-3 font-medium">Durée</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="activity in projectAnalytics.recentActivity"
                  :key="activity.workflowId"
                  class="text-sm"
                >
                  <td class="py-3 pr-4">
                    <span class="font-medium text-gray-900 dark:text-white">{{ activity.taskTitle }}</span>
                  </td>
                  <td class="py-3 pr-4">
                    <span
                      :class="[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        activity.status === 'COMPLETED' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                        activity.status === 'FAILED' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                        activity.status === 'RUNNING' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                        activity.status === 'PENDING' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                        activity.status === 'CANCELLED' && 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                      ]"
                    >
                      {{ activity.status }}
                    </span>
                  </td>
                  <td class="py-3 pr-4 text-gray-600 dark:text-gray-400">
                    {{ activity.phase ? analyticsStore.formatPhase(activity.phase) : '-' }}
                  </td>
                  <td class="py-3 pr-4 text-gray-600 dark:text-gray-400">
                    {{ activity.startedAt ? new Date(activity.startedAt).toLocaleString('fr-FR') : '-' }}
                  </td>
                  <td class="py-3 text-gray-600 dark:text-gray-400">
                    {{ activity.duration ? analyticsStore.formatDuration(activity.duration) : '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
            Aucune activité récente
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <div v-else class="text-center py-20">
        <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucune donnée</h3>
        <p class="text-gray-500 dark:text-gray-400">Les analytics apparaîtront ici une fois que vous aurez exécuté des workflows.</p>
      </div>
    </div>
  </div>
</template>
