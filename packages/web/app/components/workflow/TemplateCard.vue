<template>
  <button
    type="button"
    :class="[
      'relative flex flex-col p-4 border-2 rounded-lg text-left transition-all duration-200',
      isSelected
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
    ]"
    @click="$emit('select')"
  >
    <!-- Selected indicator -->
    <div
      v-if="isSelected"
      class="absolute top-2 right-2"
    >
      <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
    </div>

    <!-- Header -->
    <div class="flex items-center gap-2 mb-2">
      <span class="text-2xl">{{ template.icon }}</span>
      <span class="font-semibold text-gray-900 dark:text-white">{{ template.displayName }}</span>
      <span
        :class="[
          'px-2 py-0.5 text-xs font-medium rounded',
          getCostTierClasses(template.costTier)
        ]"
      >
        {{ getCostTierLabel(template.costTier) }}
      </span>
    </div>

    <!-- Description -->
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
      {{ template.description }}
    </p>

    <!-- Features list -->
    <ul class="space-y-1">
      <li
        v-for="feature in template.features"
        :key="feature"
        class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
      >
        <svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
        {{ feature }}
      </li>
    </ul>
  </button>
</template>

<script setup lang="ts">
interface TemplateInfo {
  name: 'standard' | 'minimal' | 'advanced'
  displayName: string
  description: string
  icon: string
  features: string[]
  costTier: 'low' | 'medium' | 'high'
}

interface Props {
  template: TemplateInfo
  isSelected: boolean
}

interface Emits {
  (e: 'select'): void
}

defineProps<Props>()
defineEmits<Emits>()

const getCostTierClasses = (tier: string): string => {
  switch (tier) {
    case 'low':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const getCostTierLabel = (tier: string): string => {
  switch (tier) {
    case 'low':
      return 'Low Cost'
    case 'medium':
      return 'Medium Cost'
    case 'high':
      return 'High Cost'
    default:
      return tier
  }
}
</script>
