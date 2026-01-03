/**
 * Composable for polling workflow progress
 *
 * Auto-polls a workflow's progress at regular intervals until completion.
 * Automatically stops when workflow reaches terminal state (COMPLETED, FAILED, CANCELLED).
 *
 * @example
 * ```ts
 * const { progress, isPolling, error, startPolling, stopPolling } = useWorkflowPolling(
 *   workflowId,
 *   {
 *     interval: 2000,
 *     timeout: 300000,
 *     onUpdate: (progress) => console.log('Progress:', progress),
 *     onComplete: () => console.log('Workflow completed!')
 *   }
 * )
 * ```
 */

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
  phases?: Array<{
    phase: string
    totalSteps: number
    completedSteps: number
    steps: Array<{
      stepNumber: number
      stepName: string
      status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
      startedAt?: string
      completedAt?: string
      duration?: number
      error?: string
      data?: any
    }>
  }>
}

export interface UseWorkflowPollingOptions {
  /** Polling interval in milliseconds (default: 2000) */
  interval?: number
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number
  /** Callback when progress is updated */
  onUpdate?: (progress: WorkflowProgress) => void
  /** Callback when workflow completes */
  onComplete?: (progress: WorkflowProgress) => void
  /** Callback when polling encounters an error */
  onError?: (error: Error) => void
  /** Auto-start polling on composable creation (default: false) */
  autoStart?: boolean
}

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'] as const

export const useWorkflowPolling = (
  workflowId: Ref<string> | string,
  options: UseWorkflowPollingOptions = {}
) => {
  const {
    interval = 2000,
    timeout = 300000,
    onUpdate,
    onComplete,
    onError,
    autoStart = false,
  } = options

  const { get } = useApi()

  // Reactive state
  const progress = ref<WorkflowProgress | null>(null)
  const isPolling = ref(false)
  const error = ref<Error | null>(null)

  // Internal state
  let intervalId: NodeJS.Timeout | null = null
  let timeoutId: NodeJS.Timeout | null = null
  let pollingStartTime = 0

  /**
   * Fetch workflow progress from API
   */
  const fetchProgress = async (): Promise<WorkflowProgress> => {
    const id = unref(workflowId)
    return get<WorkflowProgress>(`/workflows/${id}/progress`)
  }

  /**
   * Check if workflow has reached terminal state
   */
  const isTerminalStatus = (status: string): boolean => {
    return TERMINAL_STATUSES.includes(status as any)
  }

  /**
   * Stop polling and clean up
   */
  const stopPolling = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    isPolling.value = false
  }

  /**
   * Refresh progress once (without polling)
   */
  const refresh = async () => {
    try {
      error.value = null
      const data = await fetchProgress()
      progress.value = data

      // Check if terminal status reached
      if (isTerminalStatus(data.workflow.status)) {
        stopPolling()
        onComplete?.(data)
      } else {
        onUpdate?.(data)
      }
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err))
      error.value = fetchError
      onError?.(fetchError)

      // Continue polling on transient errors
      // Only stop if timeout is reached
    }
  }

  /**
   * Start polling for workflow progress
   */
  const startPolling = () => {
    if (isPolling.value) {
      console.warn('[useWorkflowPolling] Already polling, ignoring start request')
      return
    }

    isPolling.value = true
    pollingStartTime = Date.now()
    error.value = null

    // Initial fetch
    refresh()

    // Setup interval
    intervalId = setInterval(async () => {
      // Check timeout
      if (Date.now() - pollingStartTime > timeout) {
        stopPolling()
        const timeoutError = new Error(`Workflow polling timeout after ${timeout}ms`)
        error.value = timeoutError
        onError?.(timeoutError)
        return
      }

      await refresh()
    }, interval)

    // Setup timeout
    timeoutId = setTimeout(() => {
      if (isPolling.value) {
        stopPolling()
        const timeoutError = new Error(`Workflow polling timeout after ${timeout}ms`)
        error.value = timeoutError
        onError?.(timeoutError)
      }
    }, timeout)
  }

  // Auto-start if requested
  if (autoStart) {
    onMounted(() => {
      startPolling()
    })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopPolling()
  })

  return {
    progress: readonly(progress),
    isPolling: readonly(isPolling),
    error: readonly(error),
    startPolling,
    stopPolling,
    refresh,
  }
}
