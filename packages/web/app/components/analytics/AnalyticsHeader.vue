<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  dateRangeChange: [preset: '7d' | '30d' | '90d' | 'ytd']
}>()

const selectedPreset = ref<'7d' | '30d' | '90d' | 'ytd'>('90d')

const presets = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: 'ytd', label: 'Année' }
] as const

function selectPreset(preset: '7d' | '30d' | '90d' | 'ytd') {
  selectedPreset.value = preset
  emit('dateRangeChange', preset)
}

function handleRefresh() {
  emit('refresh')
}
</script>

<template>
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Métriques et KPIs de votre organisation
      </p>
    </div>

    <div class="flex items-center gap-3">
      <!-- Date Range Selector -->
      <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          v-for="preset in presets"
          :key="preset.value"
          @click="selectPreset(preset.value)"
          :class="[
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            selectedPreset === preset.value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          ]"
        >
          {{ preset.label }}
        </button>
      </div>

      <!-- Refresh Button -->
      <button
        @click="handleRefresh"
        :disabled="loading"
        class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          :class="['w-4 h-4', loading && 'animate-spin']"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span class="hidden sm:inline">Actualiser</span>
      </button>
    </div>
  </div>
</template>
