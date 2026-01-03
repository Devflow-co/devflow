<template>
  <div class="fixed bottom-4 right-4 z-50 space-y-3 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto max-w-sm rounded-lg shadow-lg border overflow-hidden transition-all duration-300"
        :class="toastClasses(toast.type)"
      >
        <div class="p-4 flex items-start gap-3">
          <!-- Icon -->
          <div class="flex-shrink-0">
            <!-- Success -->
            <svg
              v-if="toast.type === 'success'"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>

            <!-- Error -->
            <svg
              v-else-if="toast.type === 'error'"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>

            <!-- Warning -->
            <svg
              v-else-if="toast.type === 'warning'"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>

            <!-- Info -->
            <svg
              v-else
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <!-- Message -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">{{ toast.message }}</p>
          </div>

          <!-- Close Button -->
          <button
            @click="handleClose(toast.id)"
            class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Progress Bar -->
        <div
          v-if="toast.duration > 0"
          class="h-1 transition-all ease-linear"
          :class="progressBarClass(toast.type)"
          :style="{
            width: `${getProgress(toast)}%`,
            transitionDuration: `${toast.duration}ms`,
          }"
        ></div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useToast, type Toast } from '@/composables/useToast'

const { toasts, remove } = useToast()

// Force re-render for progress bar animation
const now = ref(Date.now())
let intervalId: NodeJS.Timeout | null = null

onMounted(() => {
  intervalId = setInterval(() => {
    now.value = Date.now()
  }, 100)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})

const toastClasses = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
    case 'error':
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
    case 'warning':
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300'
    case 'info':
      return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
    default:
      return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300'
  }
}

const progressBarClass = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-500 dark:bg-green-400'
    case 'error':
      return 'bg-red-500 dark:bg-red-400'
    case 'warning':
      return 'bg-yellow-500 dark:bg-yellow-400'
    case 'info':
      return 'bg-blue-500 dark:bg-blue-400'
    default:
      return 'bg-gray-500 dark:bg-gray-400'
  }
}

const getProgress = (toast: Toast): number => {
  if (toast.duration <= 0) return 100

  const elapsed = now.value - toast.timestamp
  const remaining = Math.max(0, toast.duration - elapsed)
  return (remaining / toast.duration) * 100
}

const handleClose = (id: string) => {
  remove(id)
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100px) scale(0.95);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
