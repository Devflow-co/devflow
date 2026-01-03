<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
    :class="statusClasses"
  >
    <span
      v-if="isRunning"
      class="w-2 h-2 rounded-full animate-pulse"
      :class="dotClasses"
    ></span>
    <span v-else class="w-2 h-2 rounded-full" :class="dotClasses"></span>
    {{ statusText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type WorkflowStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface Props {
  status: WorkflowStatus
}

const props = defineProps<Props>()

const isRunning = computed(() => props.status === 'RUNNING')

const statusClasses = computed(() => {
  switch (props.status) {
    case 'COMPLETED':
      return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
    case 'RUNNING':
      return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
    case 'FAILED':
      return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
    case 'CANCELLED':
      return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    case 'PENDING':
      return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }
})

const dotClasses = computed(() => {
  switch (props.status) {
    case 'COMPLETED':
      return 'bg-green-500 dark:bg-green-400'
    case 'RUNNING':
      return 'bg-blue-500 dark:bg-blue-400'
    case 'FAILED':
      return 'bg-red-500 dark:bg-red-400'
    case 'CANCELLED':
      return 'bg-gray-400 dark:bg-gray-500'
    case 'PENDING':
      return 'bg-yellow-500 dark:bg-yellow-400'
    default:
      return 'bg-gray-400 dark:bg-gray-500'
  }
})

const statusText = computed(() => {
  switch (props.status) {
    case 'COMPLETED':
      return 'Completed'
    case 'RUNNING':
      return 'Running'
    case 'FAILED':
      return 'Failed'
    case 'CANCELLED':
      return 'Cancelled'
    case 'PENDING':
      return 'Pending'
    default:
      return 'Unknown'
  }
})
</script>
