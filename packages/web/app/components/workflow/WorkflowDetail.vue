<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
    <!-- Header -->
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <WorkflowStatusBadge :status="progress.workflow.status" />
            <span
              v-if="isPolling"
              class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"
            >
              <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              Live updates
            </span>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ progress.task?.title || 'Workflow Details' }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ progress.task?.linearId || progress.workflow.workflowId }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <!-- Export Dropdown -->
          <div class="relative" ref="exportDropdownRef">
            <button
              @click="showExportMenu = !showExportMenu"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Export timeline"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </button>
            <div
              v-if="showExportMenu"
              class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10"
            >
              <button
                @click="exportAsJSON"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Export as JSON
              </button>
              <button
                @click="exportAsCSV"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 rounded-b-lg"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as CSV
              </button>
            </div>
          </div>

          <!-- Close Button -->
          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
      </div>

      <!-- Global Progress Bar -->
      <div v-if="progress.workflow.progressPercent !== undefined">
        <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
          <span>Overall Progress</span>
          <span class="font-medium">{{ progress.workflow.progressPercent }}%</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300 ease-out"
            :class="{
              'bg-blue-600 animate-pulse': progress.workflow.status === 'RUNNING',
              'bg-green-600': progress.workflow.status === 'COMPLETED',
              'bg-red-600': progress.workflow.status === 'FAILED',
              'bg-gray-500': progress.workflow.status === 'CANCELLED',
            }"
            :style="{ width: `${progress.workflow.progressPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- Meta Info -->
      <div class="mt-4 flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
        <div v-if="progress.workflow.startedAt" class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Started {{ formatDate(progress.workflow.startedAt) }}</span>
        </div>
        <div v-if="progress.workflow.duration" class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span>{{ formatDuration(progress.workflow.duration) }}</span>
        </div>
      </div>

      <!-- Error Message -->
      <div
        v-if="progress.workflow.error"
        class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div class="flex-1">
            <h4 class="text-sm font-medium text-red-800 dark:text-red-300">Workflow Failed</h4>
            <p class="text-sm text-red-700 dark:text-red-400 mt-1">{{ progress.workflow.error }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Phases & Steps -->
    <div class="p-6 space-y-6">
      <div v-for="phase in progress.phases" :key="phase.phase" class="space-y-3">
        <!-- Phase Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span class="text-2xl">{{ getPhaseIcon(phase.phase) }}</span>
            {{ formatPhase(phase.phase) }}
          </h3>
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ phase.completedSteps }} / {{ phase.totalSteps }} steps
          </span>
        </div>

        <!-- Steps Timeline -->
        <div class="ml-6 space-y-3">
          <div
            v-for="(step, index) in phase.steps"
            :key="`${phase.phase}-${step.stepNumber}`"
            class="relative"
          >
            <!-- Timeline Line -->
            <div
              v-if="index < phase.steps.length - 1"
              class="absolute left-3 top-8 bottom-0 w-0.5 transition-colors duration-300"
              :class="{
                'bg-green-500': step.status === 'COMPLETED',
                'bg-blue-500': step.status === 'RUNNING',
                'bg-red-500': step.status === 'FAILED',
                'bg-gray-300 dark:bg-gray-600': step.status === 'PENDING',
              }"
            ></div>

            <!-- Step Card -->
            <div class="flex items-start gap-3">
              <!-- Status Icon -->
              <div
                class="relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                :class="{
                  'bg-green-500 text-white': step.status === 'COMPLETED',
                  'bg-blue-500 text-white': step.status === 'RUNNING',
                  'bg-red-500 text-white': step.status === 'FAILED',
                  'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400':
                    step.status === 'PENDING',
                }"
              >
                <!-- Completed -->
                <svg
                  v-if="step.status === 'COMPLETED'"
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <!-- Running -->
                <div
                  v-else-if="step.status === 'RUNNING'"
                  class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                ></div>
                <!-- Failed -->
                <svg
                  v-else-if="step.status === 'FAILED'"
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <!-- Pending -->
                <div v-else class="w-2 h-2 rounded-full bg-gray-400"></div>
              </div>

              <!-- Step Content -->
              <div class="flex-1 pb-4">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ step.stepName }}
                    </p>
                    <div class="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span v-if="step.startedAt">{{ formatDate(step.startedAt) }}</span>
                      <span v-if="step.duration">{{ formatDuration(step.duration) }}</span>
                    </div>
                  </div>
                  <span class="text-xs text-gray-400">Step {{ step.stepNumber }}</span>
                </div>

                <!-- Step Error -->
                <div
                  v-if="step.error"
                  class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300"
                >
                  {{ step.error }}
                </div>

                <!-- Step Data (Collapsed) -->
                <details v-if="step.data" class="mt-2">
                  <summary
                    class="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                  >
                    View step data
                  </summary>
                  <pre
                    class="mt-2 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs overflow-x-auto"
                    >{{ JSON.stringify(step.data, null, 2) }}</pre
                  >
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { WorkflowProgress } from '~/stores/workflows'
import WorkflowStatusBadge from './WorkflowStatusBadge.vue'
import { useToast } from '@/composables/useToast'

interface Props {
  progress: WorkflowProgress
  isPolling?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

const toast = useToast()
const showExportMenu = ref(false)
const exportDropdownRef = ref<HTMLElement | null>(null)

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (exportDropdownRef.value && !exportDropdownRef.value.contains(event.target as Node)) {
    showExportMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Export functions
const exportAsJSON = () => {
  try {
    const dataStr = JSON.stringify(props.progress, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `workflow-${props.progress.workflow.workflowId}-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showExportMenu.value = false
    toast.success('Timeline exported as JSON')
  } catch (error: any) {
    toast.error(`Export failed: ${error.message}`)
  }
}

const exportAsCSV = () => {
  try {
    // Build CSV header
    const headers = ['Phase', 'Step Number', 'Step Name', 'Status', 'Started At', 'Completed At', 'Duration (ms)', 'Error']
    const rows: string[][] = [headers]

    // Add data rows
    props.progress.phases.forEach(phase => {
      phase.steps.forEach(step => {
        rows.push([
          phase.phase,
          step.stepNumber.toString(),
          step.stepName,
          step.status,
          step.startedAt || '',
          step.completedAt || '',
          step.duration?.toString() || '',
          step.error || '',
        ])
      })
    })

    // Convert to CSV string
    const csvContent = rows
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const dataBlob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `workflow-${props.progress.workflow.workflowId}-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showExportMenu.value = false
    toast.success('Timeline exported as CSV')
  } catch (error: any) {
    toast.error(`Export failed: ${error.message}`)
  }
}

// Helpers
const formatPhase = (phase: string): string => {
  const phases: Record<string, string> = {
    refinement: 'Backlog Refinement',
    user_story: 'User Story Generation',
    technical_plan: 'Technical Planning',
  }
  return phases[phase] || phase
}

const getPhaseIcon = (phase: string): string => {
  const icons: Record<string, string> = {
    refinement: '📋',
    user_story: '📝',
    technical_plan: '🏗️',
  }
  return icons[phase] || '⚙️'
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`

  return date.toLocaleString()
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
