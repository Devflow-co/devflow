/**
 * Toast Notification Composable
 *
 * Simple toast notification system for user feedback.
 *
 * @example
 * ```ts
 * const toast = useToast()
 * toast.success('Workflow completed!')
 * toast.error('Failed to start workflow')
 * toast.info('Polling started')
 * ```
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration: number
  timestamp: number
}

const toasts = ref<Toast[]>([])
let toastIdCounter = 0

export const useToast = () => {
  const show = (type: ToastType, message: string, duration = 5000) => {
    const id = `toast-${++toastIdCounter}-${Date.now()}`
    const toast: Toast = {
      id,
      type,
      message,
      duration,
      timestamp: Date.now(),
    }

    toasts.value.push(toast)

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }

    return id
  }

  const remove = (id: string) => {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  const clear = () => {
    toasts.value = []
  }

  const success = (message: string, duration?: number) => {
    return show('success', message, duration)
  }

  const error = (message: string, duration?: number) => {
    return show('error', message, duration)
  }

  const warning = (message: string, duration?: number) => {
    return show('warning', message, duration)
  }

  const info = (message: string, duration?: number) => {
    return show('info', message, duration)
  }

  return {
    toasts: readonly(toasts),
    show,
    remove,
    clear,
    success,
    error,
    warning,
    info,
  }
}
