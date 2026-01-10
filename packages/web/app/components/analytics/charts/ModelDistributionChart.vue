<script setup lang="ts">
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import type { ModelUsageItem } from '~/stores/analytics'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  data: ModelUsageItem[]
}>()

const { formatCost } = useAnalyticsStore()
const colorMode = useColorMode()

// Model colors mapping
const modelColors: Record<string, string> = {
  'claude-3-5-sonnet': 'rgb(168, 85, 247)',
  'claude-3-sonnet': 'rgb(139, 92, 246)',
  'claude-3-haiku': 'rgb(196, 181, 253)',
  'claude-3-opus': 'rgb(126, 34, 206)',
  'gpt-4o': 'rgb(16, 185, 129)',
  'gpt-4o-mini': 'rgb(52, 211, 153)',
  'gpt-4-turbo': 'rgb(5, 150, 105)',
  'gpt-4': 'rgb(4, 120, 87)',
  'gpt-3.5-turbo': 'rgb(110, 231, 183)'
}

const defaultColors = [
  'rgb(59, 130, 246)',
  'rgb(168, 85, 247)',
  'rgb(236, 72, 153)',
  'rgb(245, 158, 11)',
  'rgb(16, 185, 129)',
  'rgb(99, 102, 241)',
  'rgb(239, 68, 68)',
  'rgb(20, 184, 166)'
]

function getColorForModel(model: string, index: number): string {
  // Try to find a specific color for the model
  for (const [key, color] of Object.entries(modelColors)) {
    if (model.toLowerCase().includes(key.toLowerCase())) {
      return color
    }
  }
  // Fall back to default colors
  return defaultColors[index % defaultColors.length]
}

const chartData = computed(() => {
  const sortedData = [...props.data].sort((a, b) => b.cost - a.cost).slice(0, 8)

  return {
    labels: sortedData.map(d => d.model),
    datasets: [{
      data: sortedData.map(d => d.cost),
      backgroundColor: sortedData.map((d, i) => getColorForModel(d.model, i)),
      borderWidth: 0,
      hoverOffset: 4
    }]
  }
})

const totalCost = computed(() =>
  props.data.reduce((sum, d) => sum + d.cost, 0)
)

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '60%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: colorMode.value === 'dark' ? '#9CA3AF' : '#4B5563',
        usePointStyle: true,
        padding: 12,
        font: { size: 11 },
        generateLabels: (chart: any) => {
          const datasets = chart.data.datasets
          return chart.data.labels.map((label: string, i: number) => {
            // Shorten model name for display
            const shortLabel = label.replace('anthropic/', '').replace('openai/', '').replace('google/', '')
            return {
              text: `${shortLabel} (${props.data[i]?.percentOfTotal || 0}%)`,
              fillStyle: datasets[0].backgroundColor[i],
              hidden: false,
              index: i
            }
          })
        }
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.parsed
          return `$${value.toFixed(4)}`
        }
      }
    }
  }
}))
</script>

<template>
  <div class="relative h-full">
    <Doughnut v-if="data.length > 0" :data="chartData" :options="chartOptions" />
    <div v-else class="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
      Aucune donnée disponible
    </div>
    <!-- Center text - positioned above legend -->
    <div
      v-if="data.length > 0"
      class="absolute inset-x-0 top-0 flex items-center justify-center pointer-events-none"
      style="height: calc(100% - 40px);"
    >
      <div class="text-center">
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCost(totalCost) }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">Total</p>
      </div>
    </div>
  </div>
</template>
