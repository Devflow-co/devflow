<script setup lang="ts">
import type { AnalyticsSummary, AnalyticsQuotas } from '~/stores/analytics'

const props = defineProps<{
  summary: AnalyticsSummary
  quotas?: AnalyticsQuotas
  loading?: boolean
}>()

const { formatCost, formatTokens, formatDuration } = useAnalyticsStore()

interface KPICard {
  label: string
  value: string
  subValue?: string
  icon: string
  color: string
  bgColor: string
}

const cards = computed<KPICard[]>(() => {
  if (!props.summary) return []

  return [
    {
      label: 'Coût Total',
      value: formatCost(props.summary.totalCost),
      icon: 'dollar',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30'
    },
    {
      label: 'Tokens Utilisés',
      value: formatTokens(props.summary.totalTokens),
      subValue: 'tokens',
      icon: 'chip',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      label: 'Workflows',
      value: props.summary.totalWorkflows.toString(),
      subValue: 'exécutés',
      icon: 'workflow',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30'
    },
    {
      label: 'Taux de Succès',
      value: `${props.summary.successRate}%`,
      icon: 'chart',
      color: props.summary.successRate >= 80
        ? 'text-green-600 dark:text-green-400'
        : props.summary.successRate >= 50
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-red-600 dark:text-red-400',
      bgColor: props.summary.successRate >= 80
        ? 'bg-green-100 dark:bg-green-900/30'
        : props.summary.successRate >= 50
          ? 'bg-yellow-100 dark:bg-yellow-900/30'
          : 'bg-red-100 dark:bg-red-900/30'
    },
    {
      label: 'Durée Moyenne',
      value: formatDuration(props.summary.avgWorkflowDuration),
      icon: 'clock',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    },
    {
      label: props.summary.projectCount !== undefined ? 'Projets' : 'Tasks',
      value: (props.summary.projectCount ?? props.summary.taskCount ?? 0).toString(),
      icon: 'folder',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30'
    }
  ]
})
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
    <div
      v-for="(card, index) in cards"
      :key="index"
      class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center gap-3 mb-3">
        <div :class="['p-2 rounded-lg', card.bgColor]">
          <!-- Dollar Icon -->
          <svg v-if="card.icon === 'dollar'" :class="['w-5 h-5', card.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <!-- Chip Icon -->
          <svg v-else-if="card.icon === 'chip'" :class="['w-5 h-5', card.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <!-- Workflow Icon -->
          <svg v-else-if="card.icon === 'workflow'" :class="['w-5 h-5', card.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <!-- Chart Icon -->
          <svg v-else-if="card.icon === 'chart'" :class="['w-5 h-5', card.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <!-- Clock Icon -->
          <svg v-else-if="card.icon === 'clock'" :class="['w-5 h-5', card.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <!-- Folder Icon -->
          <svg v-else-if="card.icon === 'folder'" :class="['w-5 h-5', card.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ card.label }}</span>
      </div>
      <div class="flex items-baseline gap-1">
        <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ card.value }}</span>
        <span v-if="card.subValue" class="text-sm text-gray-500 dark:text-gray-400">{{ card.subValue }}</span>
      </div>
    </div>
  </div>
</template>
