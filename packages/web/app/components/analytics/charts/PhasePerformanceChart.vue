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
import type { PhaseStats } from '~/stores/analytics'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  data: PhaseStats[]
}>()

const { formatDuration, formatPhase } = useAnalyticsStore()
const colorMode = useColorMode()

// Get color based on success rate
function getSuccessColor(rate: number): string {
  if (rate >= 80) return 'rgba(16, 185, 129, 0.8)'  // green
  if (rate >= 50) return 'rgba(245, 158, 11, 0.8)' // yellow
  return 'rgba(239, 68, 68, 0.8)'                    // red
}

const chartData = computed(() => ({
  labels: props.data.map(d => formatPhase(d.phase)),
  datasets: [
    {
      label: 'Durée moyenne (ms)',
      data: props.data.map(d => d.avgDuration),
      backgroundColor: props.data.map(d => getSuccessColor(d.successRate)),
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
        label: (context: any) => {
          const index = context.dataIndex
          const phase = props.data[index]
          return [
            `Durée: ${formatDuration(phase.avgDuration)}`,
            `Succès: ${phase.successRate}%`,
            `Exécutions: ${phase.count}`
          ]
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
        callback: (value: number) => formatDuration(value)
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
  <div class="h-full flex flex-col">
    <div class="flex-1">
      <Bar v-if="data.length > 0" :data="chartData" :options="chartOptions" />
      <div v-else class="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        Aucune donnée disponible
      </div>
    </div>
  </div>
</template>
