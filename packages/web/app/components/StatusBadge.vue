<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
    :class="statusClasses"
  >
    <span class="w-2 h-2 rounded-full" :class="dotClasses"></span>
    {{ statusText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type Status = 'connected' | 'error' | 'disconnected' | 'not_configured'

interface Props {
  status: Status
}

const props = defineProps<Props>()

const statusClasses = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
    case 'error':
      return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
    case 'disconnected':
      return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    case 'not_configured':
      return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }
})

const dotClasses = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'bg-green-500 dark:bg-green-400'
    case 'error':
      return 'bg-red-500 dark:bg-red-400'
    case 'disconnected':
      return 'bg-gray-400 dark:bg-gray-500'
    case 'not_configured':
      return 'bg-yellow-500 dark:bg-yellow-400'
    default:
      return 'bg-gray-400 dark:bg-gray-500'
  }
})

const statusText = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'Connected'
    case 'error':
      return 'Error'
    case 'disconnected':
      return 'Disconnected'
    case 'not_configured':
      return 'Not Configured'
    default:
      return 'Unknown'
  }
})
</script>
