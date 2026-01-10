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
import type { ModelUsageItem } from '~/stores/analytics'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  data: ModelUsageItem[]
}>()

const { formatTokens } = useAnalyticsStore()
const colorMode = useColorMode()

const chartData = computed(() => {
  const sortedData = [...props.data].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 6)

  return {
    labels: sortedData.map(d => d.model.replace('claude-', '').replace('gpt-', '')),
    datasets: [
      {
        label: 'Input Tokens',
        data: sortedData.map(d => d.inputTokens),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 4
      },
      {
        label: 'Output Tokens',
        data: sortedData.map(d => d.outputTokens),
        backgroundColor: 'rgba(168, 85, 247, 0.8)',
        borderRadius: 4
      }
    ]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: colorMode.value === 'dark' ? '#9CA3AF' : '#4B5563',
        usePointStyle: true,
        padding: 20
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.parsed.y
          return `${context.dataset.label}: ${formatTokens(value)}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: colorMode.value === 'dark' ? '#9CA3AF' : '#4B5563'
      }
    },
    y: {
      grid: {
        color: colorMode.value === 'dark' ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.5)'
      },
      ticks: {
        color: colorMode.value === 'dark' ? '#9CA3AF' : '#4B5563',
        callback: (value: number) => formatTokens(value)
      }
    }
  }
}))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tokens par Modèle</h3>
    <div class="h-72">
      <Bar v-if="data.length > 0" :data="chartData" :options="chartOptions" />
      <div v-else class="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        Aucune donnée disponible
      </div>
    </div>
  </div>
</template>
