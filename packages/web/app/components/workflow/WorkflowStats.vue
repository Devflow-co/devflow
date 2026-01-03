<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <!-- Total Workflows -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Workflows</p>
          <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</p>
        </div>
        <div class="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
          <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Success Rate -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
          <p class="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">{{ stats.successRate }}%</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ stats.completed }} completed</p>
        </div>
        <div class="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
          <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Failed Workflows -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</p>
          <p class="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">{{ stats.failed }}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ stats.failureRate }}% failure rate</p>
        </div>
        <div class="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
          <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Average Duration -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Duration</p>
          <p class="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">{{ formatDuration(stats.avgDuration) }}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">per workflow</p>
        </div>
        <div class="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
          <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Phase Statistics -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 md:col-span-2 lg:col-span-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Phase Statistics</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="phase in stats.phases" :key="phase.name" class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl">{{ getPhaseIcon(phase.name) }}</span>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ formatPhase(phase.name) }}</p>
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Avg. Duration:</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ formatDuration(phase.avgDuration) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Success Rate:</span>
              <span class="font-medium text-green-600 dark:text-green-400">{{ phase.successRate }}%</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Total Runs:</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ phase.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Most Common Failures -->
    <div v-if="stats.topFailures.length > 0" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 md:col-span-2 lg:col-span-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Most Common Failures</h3>
      <div class="space-y-3">
        <div v-for="(failure, index) in stats.topFailures" :key="index" class="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <div class="flex-1">
            <p class="text-sm font-medium text-red-900 dark:text-red-300">{{ failure.stepName }}</p>
            <p class="text-xs text-red-700 dark:text-red-400 mt-1">Phase: {{ formatPhase(failure.phase) }}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-red-600 dark:text-red-400">{{ failure.count }}</p>
            <p class="text-xs text-red-600 dark:text-red-400">failures</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowSummary } from '@/stores/workflows'

interface Props {
  workflows: WorkflowSummary[]
}

const props = defineProps<Props>()

interface PhaseStats {
  name: string
  count: number
  avgDuration: number
  successRate: number
}

interface FailureStats {
  stepName: string
  phase: string
  count: number
}

interface WorkflowStats {
  total: number
  completed: number
  failed: number
  cancelled: number
  running: number
  successRate: number
  failureRate: number
  avgDuration: number
  phases: PhaseStats[]
  topFailures: FailureStats[]
}

const stats = computed((): WorkflowStats => {
  const total = props.workflows.length
  const completed = props.workflows.filter(w => w.status === 'COMPLETED').length
  const failed = props.workflows.filter(w => w.status === 'FAILED').length
  const cancelled = props.workflows.filter(w => w.status === 'CANCELLED').length
  const running = props.workflows.filter(w => w.status === 'RUNNING').length

  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const failureRate = total > 0 ? Math.round((failed / total) * 100) : 0

  // Calculate average duration (only completed workflows)
  const completedWorkflows = props.workflows.filter(w => w.status === 'COMPLETED' && w.duration)
  const avgDuration = completedWorkflows.length > 0
    ? completedWorkflows.reduce((sum, w) => sum + (w.duration || 0), 0) / completedWorkflows.length
    : 0

  // Calculate phase statistics
  const phaseMap = new Map<string, { durations: number[], successes: number, total: number }>()

  props.workflows.forEach(workflow => {
    if (workflow.currentPhase) {
      const phase = workflow.currentPhase
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, { durations: [], successes: 0, total: 0 })
      }
      const phaseData = phaseMap.get(phase)!
      phaseData.total++

      if (workflow.status === 'COMPLETED' && workflow.duration) {
        phaseData.durations.push(workflow.duration)
        phaseData.successes++
      }
    }
  })

  const phases: PhaseStats[] = Array.from(phaseMap.entries()).map(([name, data]) => ({
    name,
    count: data.total,
    avgDuration: data.durations.length > 0
      ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length
      : 0,
    successRate: data.total > 0 ? Math.round((data.successes / data.total) * 100) : 0,
  }))

  // For now, we don't have detailed failure data, so return empty array
  // This would need workflow stage log data
  const topFailures: FailureStats[] = []

  return {
    total,
    completed,
    failed,
    cancelled,
    running,
    successRate,
    failureRate,
    avgDuration,
    phases,
    topFailures,
  }
})

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

const formatDuration = (ms: number): string => {
  if (ms === 0) return 'N/A'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
</script>
