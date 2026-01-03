<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Workflows</h2>
      <div class="flex items-center gap-2">
        <!-- Quick Status Filter -->
        <select
          v-model="statusFilter"
          class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          <option value="RUNNING">Running</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="PENDING">Pending</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <!-- Toggle Advanced Filters -->
        <button
          @click="showAdvancedFilters = !showAdvancedFilters"
          class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {{ showAdvancedFilters ? 'Hide' : 'More' }} Filters
        </button>
      </div>
    </div>

    <!-- Advanced Filters Panel -->
    <div
      v-if="showAdvancedFilters"
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Search -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search
          </label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Task title or workflow ID..."
            class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Phase Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Phase
          </label>
          <select
            v-model="phaseFilter"
            class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Phases</option>
            <option value="refinement">Backlog Refinement</option>
            <option value="user_story">User Story</option>
            <option value="technical_plan">Technical Plan</option>
          </select>
        </div>

        <!-- Date From -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            From Date
          </label>
          <input
            v-model="dateFrom"
            type="date"
            class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Date To -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            To Date
          </label>
          <input
            v-model="dateTo"
            type="date"
            class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <!-- Duration Range -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Min Duration (minutes)
          </label>
          <input
            v-model.number="minDuration"
            type="number"
            min="0"
            placeholder="0"
            class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Max Duration (minutes)
          </label>
          <input
            v-model.number="maxDuration"
            type="number"
            min="0"
            placeholder="∞"
            class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <!-- Clear Filters -->
      <div class="flex justify-end">
        <button
          @click="clearAllFilters"
          class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Clear All Filters
        </button>
      </div>
    </div>

    <!-- Loading State (Skeleton) -->
    <div v-if="loading" class="space-y-3">
      <div
        v-for="i in 3"
        :key="i"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm animate-pulse"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
            <div class="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
        <div class="mb-3">
          <div class="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
        <div class="flex items-center gap-4">
          <div class="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!loading && filteredWorkflows.length === 0"
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center"
    >
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No workflows found</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ statusFilter ? 'No workflows with this status.' : 'No workflows have been run yet.' }}
      </p>
    </div>

    <!-- Workflow Cards -->
    <div v-else class="space-y-3">
      <div
        v-for="workflow in filteredWorkflows"
        :key="workflow.workflowId"
        @click="$emit('select', workflow.workflowId)"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:scale-[1.01] hover:-translate-y-0.5"
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <WorkflowStatusBadge :status="workflow.status" />
              <span
                v-if="workflow.currentPhase"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                {{ formatPhase(workflow.currentPhase) }}
              </span>
            </div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ workflow.task?.title || 'Untitled Task' }}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ workflow.task?.linearId || workflow.workflowId }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="workflow.status === 'RUNNING'"
              @click.stop="$emit('cancel', workflow.workflowId)"
              class="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Cancel workflow"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="workflow.progressPercent !== undefined" class="mb-3">
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span v-if="workflow.currentStepName">{{ workflow.currentStepName }}</span>
            <span>{{ workflow.progressPercent }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500 ease-out"
              :class="{
                'bg-blue-600 animate-pulse': workflow.status === 'RUNNING',
                'bg-green-600': workflow.status === 'COMPLETED',
                'bg-red-600': workflow.status === 'FAILED',
                'bg-gray-500': workflow.status === 'CANCELLED',
                'bg-yellow-600': workflow.status === 'PENDING',
              }"
              :style="{ width: `${workflow.progressPercent}%` }"
            ></div>
          </div>
        </div>

        <!-- Meta Info -->
        <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span v-if="workflow.startedAt">{{ formatDate(workflow.startedAt) }}</span>
          </div>
          <div v-if="workflow.duration" class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>{{ formatDuration(workflow.duration) }}</span>
          </div>
          <div v-if="workflow.stageCount" class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <span>{{ workflow.stageCount }} steps</span>
          </div>
        </div>

        <!-- Error Message -->
        <div
          v-if="workflow.status === 'FAILED'"
          class="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300"
        >
          Click to view error details
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WorkflowSummary } from '~/stores/workflows'
import WorkflowStatusBadge from './WorkflowStatusBadge.vue'

interface Props {
  workflows: WorkflowSummary[]
  loading?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  select: [workflowId: string]
  cancel: [workflowId: string]
}>()

// Local state
const statusFilter = ref<string>('')
const showAdvancedFilters = ref<boolean>(false)
const searchQuery = ref<string>('')
const phaseFilter = ref<string>('')
const dateFrom = ref<string>('')
const dateTo = ref<string>('')
const minDuration = ref<number | null>(null)
const maxDuration = ref<number | null>(null)

// Clear all filters
const clearAllFilters = () => {
  statusFilter.value = ''
  searchQuery.value = ''
  phaseFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  minDuration.value = null
  maxDuration.value = null
}

// Computed
const filteredWorkflows = computed(() => {
  let filtered = props.workflows

  // Status filter
  if (statusFilter.value) {
    filtered = filtered.filter((w) => w.status === statusFilter.value)
  }

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((w) => {
      const title = w.task?.title?.toLowerCase() || ''
      const linearId = w.task?.linearId?.toLowerCase() || ''
      const workflowId = w.workflowId.toLowerCase()
      return title.includes(query) || linearId.includes(query) || workflowId.includes(query)
    })
  }

  // Phase filter
  if (phaseFilter.value) {
    filtered = filtered.filter((w) => w.currentPhase === phaseFilter.value)
  }

  // Date range filter
  if (dateFrom.value) {
    const fromDate = new Date(dateFrom.value)
    filtered = filtered.filter((w) => {
      if (!w.startedAt) return false
      const workflowDate = new Date(w.startedAt)
      return workflowDate >= fromDate
    })
  }

  if (dateTo.value) {
    const toDate = new Date(dateTo.value)
    toDate.setHours(23, 59, 59, 999) // End of day
    filtered = filtered.filter((w) => {
      if (!w.startedAt) return false
      const workflowDate = new Date(w.startedAt)
      return workflowDate <= toDate
    })
  }

  // Duration filter (convert to milliseconds)
  if (minDuration.value !== null && minDuration.value > 0) {
    const minMs = minDuration.value * 60 * 1000
    filtered = filtered.filter((w) => w.duration && w.duration >= minMs)
  }

  if (maxDuration.value !== null && maxDuration.value > 0) {
    const maxMs = maxDuration.value * 60 * 1000
    filtered = filtered.filter((w) => w.duration && w.duration <= maxMs)
  }

  return filtered
})

// Helpers
const formatPhase = (phase: string): string => {
  const phases: Record<string, string> = {
    refinement: 'Refinement',
    user_story: 'User Story',
    technical_plan: 'Technical Plan',
  }
  return phases[phase] || phase
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
</script>
