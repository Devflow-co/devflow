<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading && !data" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- No Data State -->
    <div v-else-if="!data" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p class="mt-2 text-gray-500 dark:text-gray-400">Aucune donnée de performance disponible</p>
      <p class="text-sm text-gray-400 dark:text-gray-500">Les métriques apparaîtront après vos premiers workflows</p>
    </div>

    <template v-else>
      <!-- Row 1: Usage Forecast + Cost Efficiency + Cache -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Usage Forecast Card -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Prévisions</h3>
          </div>

          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500 dark:text-gray-400">Coût quotidien moy.</span>
              <span class="font-medium text-gray-900 dark:text-white">${{ data.usageForecast.dailyAverageCost.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500 dark:text-gray-400">Projection mensuelle</span>
              <span class="font-bold text-lg text-gray-900 dark:text-white">${{ data.usageForecast.projectedMonthlyCost.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500 dark:text-gray-400">Tendance</span>
              <span :class="['flex items-center gap-1 font-medium', getTrendColor(data.usageForecast.trend)]">
                <svg v-if="data.usageForecast.trend === 'increasing'" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" transform="rotate(180 10 10)" />
                </svg>
                <svg v-else-if="data.usageForecast.trend === 'decreasing'" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                <span v-else class="w-4 h-4 inline-block text-center">-</span>
                {{ data.usageForecast.trendPercentage }}%
              </span>
            </div>
            <div v-if="data.usageForecast.daysUntilCostQuotaExhausted" class="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-sm text-orange-600 dark:text-orange-400">
                Quota atteint dans ~{{ data.usageForecast.daysUntilCostQuotaExhausted }} jours
              </p>
            </div>
          </div>
        </div>

        <!-- Cost Efficiency Card -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Efficacité Coût</h3>
          </div>

          <div class="flex items-center justify-center mb-4">
            <div class="relative w-24 h-24">
              <svg class="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="none" class="text-gray-200 dark:text-gray-700" />
                <circle
                  cx="48" cy="48" r="40"
                  stroke="currentColor" stroke-width="8" fill="none"
                  :stroke-dasharray="`${data.costByOutcome.costEfficiency * 2.51} 251`"
                  :class="getEfficiencyColor(data.costByOutcome.costEfficiency)"
                />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-900 dark:text-white">
                {{ data.costByOutcome.costEfficiency }}%
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p class="font-medium text-green-700 dark:text-green-400">${{ data.costByOutcome.successful.avgCost.toFixed(2) }}</p>
              <p class="text-xs text-green-600 dark:text-green-500">Moy. succès</p>
            </div>
            <div class="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p class="font-medium text-red-700 dark:text-red-400">${{ data.costByOutcome.failed.avgCost.toFixed(2) }}</p>
              <p class="text-xs text-red-600 dark:text-red-500">Moy. échec</p>
            </div>
          </div>
        </div>

        <!-- Cache Metrics Card -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Cache</h3>
          </div>

          <div class="text-center mb-4">
            <span class="text-3xl font-bold text-gray-900 dark:text-white">{{ data.cacheMetrics.cacheHitRate }}%</span>
            <p class="text-sm text-gray-500 dark:text-gray-400">Hit Rate</p>
          </div>

          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Requêtes totales</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ formatNumber(data.cacheMetrics.totalRequests) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Depuis cache</span>
              <span class="font-medium text-green-600 dark:text-green-400">{{ formatNumber(data.cacheMetrics.cachedRequests) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: Phase Costs -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Coûts par Phase</h3>

        <div v-if="data.phaseCosts.length" class="space-y-4">
          <div v-for="phase in data.phaseCosts" :key="phase.phase" class="flex items-center gap-4">
            <div class="w-28 flex-shrink-0">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatPhaseName(phase.phase) }}</span>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <div class="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                    :style="{ width: `${phase.percentOfTotal}%` }"
                  />
                </div>
                <span class="w-12 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{{ phase.percentOfTotal }}%</span>
              </div>
            </div>
            <div class="w-24 text-right">
              <span class="font-medium text-gray-900 dark:text-white">${{ phase.cost.toFixed(2) }}</span>
            </div>
            <div class="w-20 text-right">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatTokens(phase.totalTokens) }} tk</span>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-400 dark:text-gray-500">
          <p>Aucune donnée de phase</p>
        </div>
      </div>

      <!-- Row 3: Model Latency Table -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Latence par Modèle</h3>

        <div v-if="data.modelLatency.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th class="pb-3 font-medium">Modèle</th>
                <th class="pb-3 font-medium text-right">Moy.</th>
                <th class="pb-3 font-medium text-right">P50</th>
                <th class="pb-3 font-medium text-right">P95</th>
                <th class="pb-3 font-medium text-right">P99</th>
                <th class="pb-3 font-medium text-right">Requêtes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="model in data.modelLatency" :key="model.model" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="py-3">
                  <div>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatModelName(model.model) }}</span>
                    <span class="ml-2 text-xs text-gray-400 dark:text-gray-500">{{ model.provider }}</span>
                  </div>
                </td>
                <td class="py-3 text-right font-mono text-gray-900 dark:text-white">{{ formatLatency(model.avgLatencyMs) }}</td>
                <td class="py-3 text-right font-mono text-gray-500 dark:text-gray-400">{{ formatLatency(model.p50LatencyMs) }}</td>
                <td class="py-3 text-right font-mono text-gray-500 dark:text-gray-400">{{ formatLatency(model.p95LatencyMs) }}</td>
                <td class="py-3 text-right font-mono text-orange-600 dark:text-orange-400">{{ formatLatency(model.p99LatencyMs) }}</td>
                <td class="py-3 text-right text-gray-500 dark:text-gray-400">{{ formatNumber(model.requestCount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-center py-8 text-gray-400 dark:text-gray-500">
          <p>Aucune donnée de latence</p>
        </div>
      </div>

      <!-- Row 4: Top Expensive Tasks -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 10 Tâches les Plus Coûteuses</h3>

        <div v-if="data.topExpensiveTasks.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th class="pb-3 font-medium">Tâche</th>
                <th class="pb-3 font-medium">Projet</th>
                <th class="pb-3 font-medium">Phases</th>
                <th class="pb-3 font-medium text-right">Coût</th>
                <th class="pb-3 font-medium text-right">Tokens</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="task in data.topExpensiveTasks" :key="task.taskId" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="py-3">
                  <div>
                    <span class="font-medium text-gray-900 dark:text-white">{{ task.taskTitle || 'Sans titre' }}</span>
                    <span v-if="task.linearIdentifier" class="ml-2 text-xs text-blue-600 dark:text-blue-400">{{ task.linearIdentifier }}</span>
                  </div>
                </td>
                <td class="py-3 text-gray-500 dark:text-gray-400">{{ task.projectName || '-' }}</td>
                <td class="py-3">
                  <div class="flex gap-1 flex-wrap">
                    <span
                      v-for="phase in task.phases"
                      :key="phase"
                      class="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    >
                      {{ formatPhaseName(phase) }}
                    </span>
                  </div>
                </td>
                <td class="py-3 text-right font-medium text-gray-900 dark:text-white">${{ task.totalCost.toFixed(2) }}</td>
                <td class="py-3 text-right text-gray-500 dark:text-gray-400">{{ formatTokens(task.totalTokens) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-center py-8 text-gray-400 dark:text-gray-500">
          <p>Aucune tâche avec des coûts enregistrés</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAnalyticsStore, type PerformanceAnalytics } from '@/stores/analytics'

const analyticsStore = useAnalyticsStore()
const { performanceAnalytics, performanceLoading } = storeToRefs(analyticsStore)

const data = computed(() => performanceAnalytics.value)
const loading = computed(() => performanceLoading.value)

onMounted(async () => {
  if (!data.value) {
    try {
      await analyticsStore.fetchPerformanceAnalytics()
    } catch (e) {
      console.error('Failed to fetch performance analytics:', e)
    }
  }
})

// Formatters
function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

function formatPhaseName(phase: string): string {
  const names: Record<string, string> = {
    refinement: 'Refinement',
    user_story: 'User Story',
    technical_plan: 'Plan Technique',
    unknown: 'Autre'
  }
  return names[phase] || phase
}

function formatModelName(model: string): string {
  // Simplify model names for display
  return model
    .replace('anthropic/', '')
    .replace('openai/', '')
    .replace('google/', '')
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'increasing': return 'text-red-600 dark:text-red-400'
    case 'decreasing': return 'text-green-600 dark:text-green-400'
    default: return 'text-gray-500 dark:text-gray-400'
  }
}

function getEfficiencyColor(percent: number): string {
  if (percent >= 80) return 'text-green-500'
  if (percent >= 50) return 'text-yellow-500'
  return 'text-red-500'
}
</script>
