<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import type { CostTrendDataPoint } from '~/stores/analytics'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps<{
  data: CostTrendDataPoint[]
  throughputPerDay: number
}>()

const colorMode = useColorMode()

// Calculate workflows per day from cost data (approximation based on cost patterns)
const workflowsPerDay = computed(() => {
  // Group by day and count non-zero cost days as workflow days
  return props.data.map(d => ({
    date: d.date,
    workflows: d.total > 0 ? Math.ceil(d.total / 0.05) : 0 // Approximate 5 cents per workflow
  }))
})

const chartData = computed(() => ({
  labels: workflowsPerDay.value.map(d => {
    const date = new Date(d.date)
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
  }),
  datasets: [
    {
      label: 'Workflows/jour',
      data: workflowsPerDay.value.map(d => d.workflows),
      borderColor: 'rgb(168, 85, 247)',
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 6
    }
  ]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context: any) => `${context.parsed.y} workflows`
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
        maxRotation: 45
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: colorMode.value === 'dark' ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.5)'
      },
      ticks: {
        color: colorMode.value === 'dark' ? '#9CA3AF' : '#4B5563',
        stepSize: 1
      }
    }
  }
}))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Throughput Workflows</h3>
      <div class="text-right">
        <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ throughputPerDay.toFixed(1) }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">workflows/jour (moy.)</p>
      </div>
    </div>
    <div class="h-56">
      <Line v-if="data.length > 0" :data="chartData" :options="chartOptions" />
      <div v-else class="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        Aucune donnée disponible
      </div>
    </div>
  </div>
</template>
