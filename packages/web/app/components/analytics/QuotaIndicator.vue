<script setup lang="ts">
import type { QuotaStatus } from '~/stores/analytics'

const props = defineProps<{
  tokens: QuotaStatus
  cost: QuotaStatus
}>()

const { formatTokens, formatCost } = useAnalyticsStore()

function getBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getTextColor(percent: number): string {
  if (percent >= 90) return 'text-red-600 dark:text-red-400'
  if (percent >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quotas</h3>

    <div class="space-y-6">
      <!-- Token Quota -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Tokens</span>
          <span :class="['text-sm font-semibold', getTextColor(tokens.percent)]">
            {{ formatTokens(tokens.used) }} / {{ formatTokens(tokens.limit) }}
          </span>
        </div>
        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            :class="['h-full rounded-full transition-all duration-500', getBarColor(tokens.percent)]"
            :style="{ width: `${Math.min(tokens.percent, 100)}%` }"
          />
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ tokens.percent }}% utilisé
        </p>
      </div>

      <!-- Cost Quota -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Coût</span>
          <span :class="['text-sm font-semibold', getTextColor(cost.percent)]">
            {{ formatCost(cost.used) }} / {{ formatCost(cost.limit) }}
          </span>
        </div>
        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            :class="['h-full rounded-full transition-all duration-500', getBarColor(cost.percent)]"
            :style="{ width: `${Math.min(cost.percent, 100)}%` }"
          />
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ cost.percent }}% utilisé
        </p>
      </div>
    </div>
  </div>
</template>
