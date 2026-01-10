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
  Legend,
  Filler
} from 'chart.js'
import type { CostTrendDataPoint } from '~/stores/analytics'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps<{
  data: CostTrendDataPoint[]
}>()

const colorMode = useColorMode()

const chartData = computed(() => ({
  labels: props.data.map(d => {
    const date = new Date(d.date)
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
  }),
  datasets: [
    {
      label: 'Input Tokens',
      data: props.data.map(d => d.inputCost),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4
    },
    {
      label: 'Output Tokens',
      data: props.data.map(d => d.outputCost),
      borderColor: 'rgb(168, 85, 247)',
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      fill: true,
      tension: 0.4
    },
    {
      label: 'Autres',
      data: props.data.map(d => d.otherCost),
      borderColor: 'rgb(156, 163, 175)',
      backgroundColor: 'rgba(156, 163, 175, 0.1)',
      fill: true,
      tension: 0.4
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
          return `${context.dataset.label}: $${value.toFixed(4)}`
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
        maxRotation: 45
      }
    },
    y: {
      grid: {
        color: colorMode.value === 'dark' ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.5)'
      },
      ticks: {
        color: colorMode.value === 'dark' ? '#9CA3AF' : '#4B5563',
        callback: (value: number) => `$${value.toFixed(2)}`
      }
    }
  }
}))
</script>

<template>
  <div class="h-full">
    <Line v-if="data.length > 0" :data="chartData" :options="chartOptions" />
    <div v-else class="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
      Aucune donnée disponible
    </div>
  </div>
</template>
