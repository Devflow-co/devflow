import { defineStore } from 'pinia'

interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  emailVerified: boolean
  ssoProvider?: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isLoading: true,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
  },

  actions: {
    setUser(user: User | null) {
      this.user = user
    },
    setLoading(loading: boolean) {
      this.isLoading = loading
    },
    setError(error: string | null) {
      this.error = error
    },
  },
})

// Cache the API base URL to avoid repeated useRuntimeConfig calls
let cachedApiBase: string | null = null

// Get API base URL - cached and safe for all contexts
const getApiBase = (): string => {
  // Return cached value if available
  if (cachedApiBase) {
    return cachedApiBase
  }

  // Default fallback
  const defaultUrl = 'http://localhost:3001/api/v1'

  // Only try to get config on client side
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

// Separate composable that handles API calls outside of Pinia
export const useAuth = () => {
  const store = useAuthStore()

  const apiFetch = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
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
      const error = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  const fetchUser = async () => {
    // Only fetch on client side
    if (import.meta.server) {
      store.setLoading(false)
      return
    }

    try {
      store.setLoading(true)
      store.setError(null)
      const user = await apiFetch<User>('/user-auth/me')
      store.setUser(user)
    } catch {
      store.setUser(null)
    } finally {
      store.setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      store.setError(null)
      const { user } = await apiFetch<{ user: User }>('/user-auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      store.setUser(user)
      return user
    } catch (e: any) {
      store.setError(e.message)
      throw e
    }
  }

  const signup = async (email: string, password: string, name?: string) => {
    try {
      store.setError(null)
      const { user } = await apiFetch<{ user: User }>('/user-auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      })
      store.setUser(user)
      return user
    } catch (e: any) {
      store.setError(e.message)
      throw e
    }
  }

  const logout = async () => {
    try {
      await apiFetch('/user-auth/logout', { method: 'POST' })
    } catch {
      // Ignore errors on logout
    }
    store.setUser(null)
    navigateTo('/login')
  }

  const forgotPassword = async (email: string) => {
    try {
      store.setError(null)
      await apiFetch('/user-auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    } catch (e: any) {
      store.setError(e.message)
      throw e
    }
  }

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      store.setError(null)
      await apiFetch('/user-auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
    } catch (e: any) {
      store.setError(e.message)
      throw e
    }
  }

  const loginWithGoogle = () => {
    if (import.meta.client) {
      // Use cached API base and direct location change
      const apiBase = getApiBase()
      // Use replace to avoid adding to browser history
      window.location.replace(`${apiBase}/user-auth/google`)
    }
  }

  const loginWithGitHub = () => {
    if (import.meta.client) {
      // Use cached API base and direct location change
      const apiBase = getApiBase()
      // Use replace to avoid adding to browser history
      window.location.replace(`${apiBase}/user-auth/github`)
    }
  }

  return {
    user: computed(() => store.user),
    isAuthenticated: computed(() => store.isAuthenticated),
    isLoading: computed(() => store.isLoading),
    error: computed(() => store.error),
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    loginWithGoogle,
    loginWithGitHub,
    fetchUser,
  }
}
