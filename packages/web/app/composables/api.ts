/**
 * API composable for making authenticated requests to the backend
 */
export const useApi = () => {
  const config = useRuntimeConfig()

  const apiFetch = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const url = `${config.public.apiBase}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for session auth
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  return {
    get: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' }),
    post: <T>(endpoint: string, body?: unknown) =>
      apiFetch<T>(endpoint, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    put: <T>(endpoint: string, body?: unknown) =>
      apiFetch<T>(endpoint, {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      }),
    delete: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
  }
}
