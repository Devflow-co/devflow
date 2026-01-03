import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// TypeScript interfaces
export interface WorkflowSummary {
  id: string
  workflowId: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  currentPhase?: string
  currentStepName?: string
  currentStepNumber?: number
  progressPercent?: number
  task?: {
    id: string
    title: string
    linearId: string
  }
  startedAt?: string
  completedAt?: string
  duration?: number
  stageCount?: number
}

export interface WorkflowStep {
  stepNumber: number
  stepName: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  startedAt?: string
  completedAt?: string
  duration?: number
  error?: string
  data?: any
}

export interface WorkflowPhase {
  phase: string
  totalSteps: number
  completedSteps: number
  steps: WorkflowStep[]
}

export interface WorkflowProgress {
  workflow: {
    id: string
    workflowId: string
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
    currentPhase?: string
    currentStepName?: string
    currentStepNumber?: number
    progressPercent?: number
    startedAt?: string
    completedAt?: string
    duration?: number
    error?: string
  }
  task?: {
    id: string
    title: string
    linearId: string
  }
  phases?: WorkflowPhase[]
}

export interface WorkflowTimeline {
  workflowId: string
  timeline: Array<{
    stepName: string
    phase?: string
    status: string
    startedAt: string
    completedAt?: string
    duration?: number
    error?: string
  }>
}

export interface StartWorkflowDto {
  taskId: string
  projectId: string
  userId?: string
  workflowType?: string
}

// Cache the API base URL
let cachedApiBase: string | null = null

const getApiBase = (): string => {
  if (cachedApiBase) {
    return cachedApiBase
  }

  const defaultUrl = 'http://localhost:3001/api/v1'

  if (import.meta.client) {
    try {
      const config = useRuntimeConfig()
      cachedApiBase = String(config.public.apiBase || defaultUrl)
    } catch {
      cachedApiBase = defaultUrl
    }
  } else {
    cachedApiBase = defaultUrl
  }

  return cachedApiBase
}

export const useWorkflowsStore = defineStore('workflows', () => {
  // State
  const workflows = ref<Map<string, WorkflowSummary>>(new Map())
  const workflowProgress = ref<Map<string, WorkflowProgress>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const workflowsList = computed(() => Array.from(workflows.value.values()))

  const runningWorkflows = computed(() =>
    workflowsList.value.filter((w) => w.status === 'RUNNING')
  )

  const completedWorkflows = computed(() =>
    workflowsList.value.filter((w) => w.status === 'COMPLETED')
  )

  const failedWorkflows = computed(() =>
    workflowsList.value.filter((w) => w.status === 'FAILED')
  )

  // API helper
  const apiFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const apiBase = getApiBase()
    const url = `${apiBase}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Actions

  /**
   * Fetch workflows for a project
   */
  const fetchProjectWorkflows = async (
    projectId: string,
    options?: { limit?: number; status?: string }
  ) => {
    try {
      loading.value = true
      error.value = null

      const params = new URLSearchParams()
      if (options?.limit) params.append('limit', options.limit.toString())
      if (options?.status) params.append('status', options.status)

      const queryString = params.toString() ? `?${params.toString()}` : ''
      const response = await apiFetch<{ workflows: WorkflowSummary[]; total: number }>(
        `/workflows/projects/${projectId}/workflows${queryString}`
      )

      // Update workflows map
      response.workflows.forEach((workflow) => {
        workflows.value.set(workflow.workflowId, workflow)
      })

      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch workflows'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch detailed progress for a workflow
   */
  const fetchWorkflowProgress = async (workflowId: string): Promise<WorkflowProgress> => {
    try {
      loading.value = true
      error.value = null

      const progress = await apiFetch<WorkflowProgress>(`/workflows/${workflowId}/progress`)

      // Update caches
      workflowProgress.value.set(workflowId, progress)
      workflows.value.set(workflowId, {
        id: progress.workflow.id,
        workflowId: progress.workflow.workflowId,
        status: progress.workflow.status,
        currentPhase: progress.workflow.currentPhase,
        currentStepName: progress.workflow.currentStepName,
        currentStepNumber: progress.workflow.currentStepNumber,
        progressPercent: progress.workflow.progressPercent,
        task: progress.task,
        startedAt: progress.workflow.startedAt,
        completedAt: progress.workflow.completedAt,
        duration: progress.workflow.duration,
        stageCount: progress.phases?.reduce((sum, p) => sum + p.steps.length, 0),
      })

      return progress
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch workflow progress'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch workflow timeline
   */
  const fetchWorkflowTimeline = async (workflowId: string): Promise<WorkflowTimeline> => {
    try {
      loading.value = true
      error.value = null

      return await apiFetch<WorkflowTimeline>(`/workflows/${workflowId}/timeline`)
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch workflow timeline'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Start a new workflow
   */
  const startWorkflow = async (dto: StartWorkflowDto): Promise<{ workflowId: string; runId: string }> => {
    try {
      loading.value = true
      error.value = null

      return await apiFetch<{ workflowId: string; runId: string }>('/workflows/start', {
        method: 'POST',
        body: JSON.stringify(dto),
      })
    } catch (e: any) {
      error.value = e.message || 'Failed to start workflow'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Cancel a workflow
   */
  const cancelWorkflow = async (workflowId: string): Promise<void> => {
    try {
      loading.value = true
      error.value = null

      await apiFetch(`/workflows/${workflowId}/cancel`, {
        method: 'POST',
      })

      // Update local cache
      const workflow = workflows.value.get(workflowId)
      if (workflow) {
        workflow.status = 'CANCELLED'
        workflows.value.set(workflowId, workflow)
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to cancel workflow'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Get workflow from cache
   */
  const getWorkflow = (workflowId: string): WorkflowSummary | undefined => {
    return workflows.value.get(workflowId)
  }

  /**
   * Get workflow progress from cache
   */
  const getWorkflowProgress = (workflowId: string): WorkflowProgress | undefined => {
    return workflowProgress.value.get(workflowId)
  }

  /**
   * Clear all cached workflows
   */
  const clearCache = () => {
    workflows.value.clear()
    workflowProgress.value.clear()
  }

  return {
    // State
    workflows,
    workflowProgress,
    loading,
    error,

    // Computed
    workflowsList,
    runningWorkflows,
    completedWorkflows,
    failedWorkflows,

    // Actions
    fetchProjectWorkflows,
    fetchWorkflowProgress,
    fetchWorkflowTimeline,
    startWorkflow,
    cancelWorkflow,
    getWorkflow,
    getWorkflowProgress,
    clearCache,
  }
})
