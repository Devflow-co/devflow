<template>
  <div class="flex items-center gap-4">
    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Retriever:</span>
    <div class="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
      <button
        type="button"
        :class="[
          'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
          modelValue === 'semantic'
            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        ]"
        @click="emit('update:modelValue', 'semantic')"
      >
        Semantic
      </button>
      <button
        type="button"
        :class="[
          'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
          modelValue === 'hybrid'
            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        ]"
        @click="emit('update:modelValue', 'hybrid')"
      >
        Hybrid
      </button>
    </div>
    <span class="text-xs text-gray-500 dark:text-gray-400">
      {{ modelValue === 'semantic' ? 'Vector-based search' : '70% semantic + 30% keyword' }}
    </span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: 'semantic' | 'hybrid'
}

interface Emits {
  (e: 'update:modelValue', value: 'semantic' | 'hybrid'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>
