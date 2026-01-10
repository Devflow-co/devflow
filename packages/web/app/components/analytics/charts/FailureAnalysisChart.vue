<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import type { FailureAnalysisItem } from '~/stores/analytics'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  data: FailureAnalysisItem[]
}>()

const { formatPhase } = useAnalyticsStore()
const colorMode = useColorMode()

const sortedData = computed(() =>
  [...props.data].sort((a, b) => b.count - a.count).slice(0, 8)
)

const chartData = computed(() => ({
  labels: sortedData.value.map(d => {
    const name = d.stepName.length > 25 ? d.stepName.slice(0, 22) + '...' : d.stepName
    return name
  }),
  datasets: [
    {
      label: 'Échecs',
      data: sortedData.value.map(d => d.count),
      backgroundColor: 'rgba(239, 68, 68, 0.8)',
      borderRadius: 4
    }
  ]
}))

const chartOptions = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        title: (context: any) => {
          const index = context[0].dataIndex
          return sortedData.value[index].stepName
        },
        label: (context: any) => {
          const index = context.dataIndex
          const item = sortedData.value[index]
          return [
            `Échecs: ${item.count}`,
            `Phase: ${formatPhase(item.phase)}`
          ]
        },
        afterLabel: (context: any) => {
          const index = context.dataIndex
          const item = sortedData.value[index]
          if (item.lastError) {
            const error = item.lastError.length > 50
              ? item.lastError.slice(0, 47) + '...'
              : item.lastError
            return `Erreur: ${error}`
          }
          return ''
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: colorMode.value === 'dark' ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.5)'
      },
      ticks: {
        color: colorMode.value === 'dark' ? '#9CA3AF' : '#4B5563',
        stepSize: 1
      }
    },
    y: {
      grid: {
        display: false
      },
      ticks: {
        color: colorMode.value === 'dark' ? '#9CA3AF' : '#4B5563'
      }
    }
  }
}))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analyse des Échecs</h3>
    <div v-if="data.length > 0" class="h-64">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="h-64 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <svg class="w-12 h-12 mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="font-medium">Aucun échec</p>
      <p class="text-sm">Tous les workflows ont réussi</p>
    </div>
  </div>
</template>
