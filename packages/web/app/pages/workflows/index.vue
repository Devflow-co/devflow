<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Workflows</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Monitor and manage all your DevFlow workflows
          </p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Polling indicator -->
          <div
            v-if="isPolling"
            class="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
          >
            <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span class="text-xs text-blue-600 dark:text-blue-400">Live updates</span>
          </div>
          <!-- Refresh button -->
          <button
            @click="refreshWorkflows"
            :disabled="loading"
            class="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <svg
              class="w-4 h-4"
              :class="{ 'animate-spin': loading }"
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
          </button>
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Total</p>
          <p class="text-2xl font-semibold text-gray-900 dark:text-white">{{ allWorkflowsTotal }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Running</p>
          <p class="text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {{ runningCount }}
          </p>
        </div>
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Completed</p>
          <p class="text-2xl font-semibold text-green-600 dark:text-green-400">
            {{ completedCount }}
          </p>
        </div>
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Failed</p>
          <p class="text-2xl font-semibold text-red-600 dark:text-red-400">
            {{ failedCount }}
          </p>
        </div>
      </div>

      <!-- Workflow List -->
      <WorkflowList
        :workflows="allWorkflows"
        :loading="loading && allWorkflows.length === 0"
        @select="openWorkflowDetail"
        @cancel="handleCancelWorkflow"
      />

      <!-- Slide Over Panel -->
      <WorkflowSlideOver :open="!!selectedWorkflowId" @close="closeWorkflowDetail">
        <!-- Debug info -->
        <div v-if="!selectedProgress" class="p-4 text-sm text-gray-500">
          Loading... (selectedProgress is null)
        </div>
        <WorkflowDetail
          v-else
          :progress="selectedProgress"
          :is-polling="isDetailPolling"
          @close="closeWorkflowDetail"
        />
      </WorkflowSlideOver>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useWorkflowsStore } from '@/stores/workflows'
import { useWorkflowPolling } from '@/composables/useWorkflowPolling'
import WorkflowList from '@/components/workflow/WorkflowList.vue'
import WorkflowDetail from '@/components/workflow/WorkflowDetail.vue'
import WorkflowSlideOver from '@/components/workflow/WorkflowSlideOver.vue'

definePageMeta({
  middleware: 'auth',
})

const workflowsStore = useWorkflowsStore()
const { allWorkflows, allWorkflowsTotal, loading, hasRunningWorkflows } = storeToRefs(workflowsStore)

// Local state
const selectedWorkflowId = ref<string | null>(null)
const detailLoading = ref(false)
const isPolling = ref(false)

// Stats computed
const runningCount = computed(() =>
  allWorkflows.value.filter((w) => w.status === 'RUNNING' || w.status === 'PENDING').length
)
const completedCount = computed(() =>
  allWorkflows.value.filter((w) => w.status === 'COMPLETED').length
)
const failedCount = computed(() =>
  allWorkflows.value.filter((w) => w.status === 'FAILED').length
)

// Detail polling using existing composable
const {
  progress: selectedProgress,
  isPolling: isDetailPolling,
  startPolling: startDetailPolling,
  stopPolling: stopDetailPolling,
} = useWorkflowPolling(
  computed(() => selectedWorkflowId.value || ''),
  {
    interval: 2000,
    autoStart: false,
  }
)

// Fetch all workflows
const refreshWorkflows = async () => {
  try {
    await workflowsStore.fetchAllWorkflows({ limit: 100 })
  } catch (e) {
    console.error('Failed to fetch workflows:', e)
  }
}

// Open workflow detail
const openWorkflowDetail = (workflowId: string) => {
  selectedWorkflowId.value = workflowId
  detailLoading.value = true
  // Start polling - it will fetch immediately and auto-stop for terminal statuses
  startDetailPolling()
}

// Watch for progress to hide loading
watch(selectedProgress, (progress) => {
  if (progress) {
    detailLoading.value = false
  }
})

// Close workflow detail
const closeWorkflowDetail = () => {
  stopDetailPolling()
  selectedWorkflowId.value = null
}

// Handle cancel workflow
const handleCancelWorkflow = async (workflowId: string) => {
  if (!confirm('Are you sure you want to cancel this workflow?')) return

  try {
    await workflowsStore.cancelWorkflow(workflowId)
    await refreshWorkflows()
  } catch (e: any) {
    alert(`Failed to cancel workflow: ${e.message}`)
  }
}

// List polling management
let listPollingInterval: ReturnType<typeof setInterval> | null = null

const startListPolling = () => {
  if (listPollingInterval) return
  isPolling.value = true
  listPollingInterval = setInterval(async () => {
    await refreshWorkflows()
    // Stop polling if no more running workflows
    if (!hasRunningWorkflows.value) {
      stopListPolling()
    }
  }, 5000)
}

const stopListPolling = () => {
  if (listPollingInterval) {
    clearInterval(listPollingInterval)
    listPollingInterval = null
  }
  isPolling.value = false
}

// Watch for running workflows to manage polling
watch(hasRunningWorkflows, (hasRunning) => {
  if (hasRunning && !listPollingInterval) {
    startListPolling()
  } else if (!hasRunning && listPollingInterval) {
    stopListPolling()
  }
})

// Lifecycle
onMounted(async () => {
  await refreshWorkflows()

  // Start polling if there are running workflows
  if (hasRunningWorkflows.value) {
    startListPolling()
  }
})

onUnmounted(() => {
  stopListPolling()
  stopDetailPolling()
})
</script>
