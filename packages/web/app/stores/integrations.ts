import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// TypeScript interfaces
interface OAuthConnection {
  id: string
  projectId: string
  provider: OAuthProvider
  scopes: string[]
  providerUserId?: string
  providerEmail?: string
  isActive: boolean
  refreshFailed: boolean
  failureReason?: string
  lastRefreshed?: string
  createdAt: string
  updatedAt: string
}

type OAuthProvider = 'GITHUB' | 'LINEAR' | 'FIGMA' | 'SENTRY'

interface ProjectIntegration {
  projectId: string
  figmaFileKey?: string
  figmaNodeId?: string
  sentryProjectSlug?: string
  sentryOrgSlug?: string
  githubIssuesRepo?: string
}

interface UpdateIntegrationDto {
  figmaFileKey?: string
  figmaNodeId?: string
  sentryProjectSlug?: string
  sentryOrgSlug?: string
  githubIssuesRepo?: string
}

interface TestResult {
  provider: OAuthProvider
  status: 'connected' | 'error' | 'not_configured'
  testResult?: string
  error?: string
  details?: any
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

export const useIntegrationsStore = defineStore('integrations', () => {
  // State
  const connections = ref<OAuthConnection[]>([])
  const integrationConfig = ref<ProjectIntegration | null>(null)
  const testResults = ref<Map<OAuthProvider, TestResult>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const oauthPopup = ref<Window | null>(null)
  const oauthPolling = ref<NodeJS.Timeout | null>(null)

  // Computed
  const isProviderConnected = computed(() => {
    return (provider: OAuthProvider): boolean => {
      const conn = connections.value.find(
        (c) => c.provider === provider && c.isActive
      )
      return !!conn
    }
  })

  const getProviderConnection = computed(() => {
    return (provider: OAuthProvider): OAuthConnection | undefined => {
      return connections.value.find(
        (c) => c.provider === provider && c.isActive
      )
    }
  })

  // API helper
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
      const errorData = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Actions
  const fetchConnections = async (projectId: string) => {
    try {
      loading.value = true
      error.value = null

      const response = await apiFetch<{ connections: OAuthConnection[] }>(
        `/auth/connections?project=${projectId}`
      )
      connections.value = response.connections
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch OAuth connections'
      throw e
    } finally {
      loading.value = false
    }
  }

  const fetchIntegrationConfig = async (projectId: string) => {
    try {
      loading.value = true
      error.value = null

      integrationConfig.value = await apiFetch<ProjectIntegration>(
        `/projects/${projectId}/integrations`
      )
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch integration configuration'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateIntegrationConfig = async (
    projectId: string,
    dto: UpdateIntegrationDto
  ): Promise<ProjectIntegration> => {
    try {
      loading.value = true
      error.value = null

      integrationConfig.value = await apiFetch<ProjectIntegration>(
        `/projects/${projectId}/integrations`,
        {
          method: 'PUT',
          body: JSON.stringify(dto),
        }
      )

      return integrationConfig.value
    } catch (e: any) {
      error.value = e.message || 'Failed to update integration configuration'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * OAuth Popup Flow with Polling
   *
   * 1. Get authorization URL from API
   * 2. Open popup window
   * 3. Listen for window.postMessage from OAuth callback
   * 4. Also poll /auth/connections every 1s as fallback
   * 5. Detect when connection appears (isActive: true)
   * 6. Close popup automatically
   * 7. Stop polling (with 60s timeout)
   */
  const connectOAuth = async (projectId: string, provider: OAuthProvider): Promise<void> => {
    if (!import.meta.client) {
      throw new Error('OAuth popup can only run on client side')
    }

    try {
      loading.value = true
      error.value = null

      // Step 1: Get authorization URL
      const endpoint = `/auth/${provider.toLowerCase()}/authorize`
      const response = await apiFetch<{ authorizationUrl: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      })

      // Step 2: Open popup window
      const popupWidth = 600
      const popupHeight = 700
      const left = window.screen.width / 2 - popupWidth / 2
      const top = window.screen.height / 2 - popupHeight / 2

      oauthPopup.value = window.open(
        response.authorizationUrl,
        `${provider} OAuth`,
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      )

      if (!oauthPopup.value) {
        throw new Error('Popup blocked by browser. Please allow popups and try again.')
      }

      // Step 3-7: Poll for connection (also listens for postMessage)
      await pollForConnection(projectId, provider)
    } catch (e: any) {
      error.value = e.message || `Failed to connect ${provider}`
      // Clean up popup if it exists
      if (oauthPopup.value && !oauthPopup.value.closed) {
        oauthPopup.value.close()
      }
      throw e
    } finally {
      loading.value = false
      oauthPopup.value = null
    }
  }

  /**
   * Poll /auth/connections until the provider connection appears or timeout
   * Also listens for window.postMessage from OAuth callback for instant feedback
   */
  const pollForConnection = async (
    projectId: string,
    provider: OAuthProvider,
    timeoutMs: number = 60000
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const pollInterval = 1000 // 1 second
      let messageListener: ((event: MessageEvent) => void) | null = null

      const cleanup = () => {
        // Stop polling
        if (oauthPolling.value) {
          clearInterval(oauthPolling.value)
          oauthPolling.value = null
        }
        // Remove message listener
        if (messageListener) {
          window.removeEventListener('message', messageListener)
          messageListener = null
        }
      }

      const handleSuccess = async () => {
        try {
          // Fetch updated connections
          const response = await apiFetch<{ connections: OAuthConnection[] }>(
            `/auth/connections?project=${projectId}`
          )
          connections.value = response.connections

          // Close popup
          if (oauthPopup.value && !oauthPopup.value.closed) {
            oauthPopup.value.close()
          }

          cleanup()
          resolve()
        } catch (e) {
          console.error('Failed to fetch connections after OAuth success:', e)
          cleanup()
          reject(e)
        }
      }

      // Listen for postMessage from OAuth callback
      messageListener = (event: MessageEvent) => {
        // Verify origin matches our app
        if (event.origin !== window.location.origin) {
          return
        }

        // Check if this is an OAuth success message for our provider
        if (event.data?.type === 'OAUTH_SUCCESS' && event.data?.provider === provider) {
          console.log('Received OAuth success message from popup')
          handleSuccess()
        }
      }
      window.addEventListener('message', messageListener)

      const poll = async () => {
        try {
          // Check if popup was closed manually
          if (oauthPopup.value && oauthPopup.value.closed) {
            cleanup()
            reject(new Error('OAuth popup closed by user'))
            return
          }

          // Fetch current connections (silently, no error handling)
          const response = await apiFetch<{ connections: OAuthConnection[] }>(
            `/auth/connections?project=${projectId}`
          )

          // Check if the provider connection exists and is active
          const connection = response.connections.find(
            (c) => c.provider === provider && c.isActive
          )

          if (connection) {
            // Success! Connection found via polling
            connections.value = response.connections

            // Close popup
            if (oauthPopup.value && !oauthPopup.value.closed) {
              oauthPopup.value.close()
            }

            cleanup()
            resolve()
            return
          }

          // Check timeout
          if (Date.now() - startTime > timeoutMs) {
            // Timeout exceeded
            if (oauthPopup.value && !oauthPopup.value.closed) {
              oauthPopup.value.close()
            }
            cleanup()
            reject(new Error('OAuth connection timeout (60s). Please try again.'))
          }
        } catch (e) {
          // Ignore polling errors, continue polling
          console.debug('Polling error (ignored):', e)
        }
      }

      // Start polling
      oauthPolling.value = setInterval(poll, pollInterval)

      // Initial poll (don't wait for first interval)
      poll()
    })
  }

  const disconnectOAuth = async (projectId: string, provider: OAuthProvider): Promise<void> => {
    try {
      loading.value = true
      error.value = null

      await apiFetch(`/auth/${provider.toLowerCase()}/disconnect`, {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      })

      // Remove from local list
      connections.value = connections.value.filter(
        (c) => !(c.provider === provider && c.projectId === projectId)
      )
    } catch (e: any) {
      error.value = e.message || `Failed to disconnect ${provider}`
      throw e
    } finally {
      loading.value = false
    }
  }

  const testConnection = async (projectId: string, provider: OAuthProvider): Promise<TestResult> => {
    try {
      loading.value = true
      error.value = null

      const result = await apiFetch<TestResult>(
        `/integrations/test/${provider.toLowerCase()}`,
        {
          method: 'POST',
          body: JSON.stringify({ projectId }),
        }
      )

      // Store test result
      testResults.value.set(provider, result)

      return result
    } catch (e: any) {
      const errorResult: TestResult = {
        provider,
        status: 'error',
        error: e.message || 'Test failed',
      }
      testResults.value.set(provider, errorResult)
      throw e
    } finally {
      loading.value = false
    }
  }

  const refreshToken = async (projectId: string, provider: OAuthProvider): Promise<void> => {
    try {
      loading.value = true
      error.value = null

      await apiFetch(`/auth/${provider.toLowerCase()}/refresh`, {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      })

      // Refresh connections list
      await fetchConnections(projectId)
    } catch (e: any) {
      error.value = e.message || `Failed to refresh ${provider} token`
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Clean up OAuth popup and polling on component unmount
   */
  const cleanup = () => {
    if (oauthPopup.value && !oauthPopup.value.closed) {
      oauthPopup.value.close()
      oauthPopup.value = null
    }
    if (oauthPolling.value) {
      clearInterval(oauthPolling.value)
      oauthPolling.value = null
    }
  }

  return {
    // State
    connections,
    integrationConfig,
    testResults,
    loading,
    error,

    // Computed
    isProviderConnected,
    getProviderConnection,

    // Actions
    fetchConnections,
    fetchIntegrationConfig,
    updateIntegrationConfig,
    connectOAuth,
    disconnectOAuth,
    testConnection,
    refreshToken,
    cleanup,
  }
})
