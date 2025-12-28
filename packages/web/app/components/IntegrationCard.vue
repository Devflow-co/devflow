<template>
  <div
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
  >
    <!-- Header -->
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-lg flex items-center justify-center" :class="providerBgClass">
          <!-- GitHub Logo -->
          <svg v-if="provider === 'GITHUB'" class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>

          <!-- Linear Logo -->
          <svg v-else-if="provider === 'LINEAR'" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 2L2 7v10l10 5 10-5V7l-10-5zM4 8.5l8 4v7l-8-4v-7zm16 7l-8 4v-7l8-4v7z"/>
          </svg>

          <!-- Figma Logo -->
          <svg v-else-if="provider === 'FIGMA'" class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4z"/>
            <path d="M4 12c0-2.208 1.792-4 4-4h4v8H8c-2.208 0-4-1.792-4-4z"/>
            <path d="M4 4c0-2.208 1.792-4 4-4h4v8H8C5.792 8 4 6.208 4 4z"/>
            <path d="M12 0h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V0z"/>
            <path d="M20 12c0 2.208-1.792 4-4 4s-4-1.792-4-4 1.792-4 4-4 4 1.792 4 4z"/>
          </svg>

          <!-- Sentry Logo -->
          <svg v-else-if="provider === 'SENTRY'" class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.227 7.633a7.886 7.886 0 00-1.385-2.467l-1.164 2.015a5.847 5.847 0 011.022 1.852l1.527-.4zm-3.638-4.023a7.87 7.87 0 00-2.691-.845v2.326a5.847 5.847 0 011.991.625l.7-2.106zM8.42 5.07a7.886 7.886 0 00-2.126 1.876l1.757 1.408a5.847 5.847 0 011.574-1.387L8.42 5.07zm11.335 6.867a7.87 7.87 0 00-.845-2.69l-2.106.7a5.847 5.847 0 01.625 1.99h2.326zm-2.691 5.452a7.886 7.886 0 001.385-2.467l-1.527-.4a5.847 5.847 0 01-1.022 1.852l1.164 2.015zM4.329 11.937a7.87 7.87 0 00.845 2.69l2.106-.7a5.847 5.847 0 01-.625-1.99H4.329zm9.26 8.453a7.886 7.886 0 002.126-1.876l-1.757-1.408a5.847 5.847 0 01-1.574 1.387l1.205 1.897zm2.638-4.023a7.87 7.87 0 001.385-2.467l-1.527-.4a5.847 5.847 0 01-1.022 1.852l1.164 2.015zM8.42 18.93l-.7-2.106a5.847 5.847 0 01-1.991.625v2.326a7.87 7.87 0 002.691-.845z"/>
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ providerName }}
          </h3>
          <StatusBadge :status="status" />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <button
          v-if="!isConnected"
          @click="handleConnect"
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Connecting...' : 'Connect' }}
        </button>

        <template v-if="isConnected">
          <button
            @click="handleTest"
            :disabled="loading"
            class="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {{ loading ? 'Testing...' : 'Test' }}
          </button>
          <button
            @click="handleDisconnect"
            :disabled="loading"
            class="px-3 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </template>
      </div>
    </div>

    <!-- Connection Details -->
    <div v-if="connection" class="mb-4 space-y-2">
      <div v-if="connection.providerEmail" class="flex items-center gap-2 text-sm">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <span class="text-gray-600 dark:text-gray-400">{{ connection.providerEmail }}</span>
      </div>

      <div v-if="connection.scopes && connection.scopes.length > 0" class="flex items-start gap-2 text-sm">
        <svg
          class="w-4 h-4 text-gray-400 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <div class="flex-1">
          <span class="text-gray-500 dark:text-gray-400">Scopes:</span>
          <span class="text-gray-700 dark:text-gray-300 ml-1">
            {{ connection.scopes.join(', ') }}
          </span>
        </div>
      </div>

      <div v-if="connection.lastRefreshed" class="flex items-center gap-2 text-sm">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="text-gray-600 dark:text-gray-400">
          Last refreshed: {{ formatDate(connection.lastRefreshed) }}
        </span>
      </div>

      <div v-if="connection.refreshFailed && connection.failureReason" class="mt-2">
        <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div class="flex items-start gap-2">
            <svg
              class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-medium text-red-800 dark:text-red-200">Token Refresh Failed</p>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                {{ connection.failureReason }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Test Result -->
    <div v-if="testResult" class="mb-4">
      <div
        class="rounded-lg p-3"
        :class="
          testResult.status === 'connected'
            ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800'
        "
      >
        <div class="flex items-start gap-2">
          <svg
            v-if="testResult.status === 'connected'"
            class="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          <svg
            v-else
            class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          <div class="flex-1">
            <p
              class="text-sm font-medium"
              :class="
                testResult.status === 'connected'
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              "
            >
              {{ testResult.status === 'connected' ? 'Test Passed' : 'Test Failed' }}
            </p>
            <p
              class="text-sm mt-1"
              :class="
                testResult.status === 'connected'
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              "
            >
              {{ testResult.testResult || testResult.error }}
            </p>
            <div
              v-if="testResult.details"
              class="mt-2 text-xs font-mono text-gray-600 dark:text-gray-400"
            >
              <pre class="whitespace-pre-wrap">{{ JSON.stringify(testResult.details, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration Slot -->
    <div v-if="$slots.config && isConnected" class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Configuration</h4>
      <slot name="config"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useIntegrationsStore } from '@/stores/integrations'
import { storeToRefs } from 'pinia'
import StatusBadge from './StatusBadge.vue'

type OAuthProvider = 'GITHUB' | 'LINEAR' | 'FIGMA' | 'SENTRY'

interface Props {
  provider: OAuthProvider
  projectId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  connected: []
  disconnected: []
  tested: []
}>()

const integrationsStore = useIntegrationsStore()
const { connections, testResults, loading } = storeToRefs(integrationsStore)

// Provider metadata
const providerName = computed(() => {
  switch (props.provider) {
    case 'GITHUB':
      return 'GitHub'
    case 'LINEAR':
      return 'Linear'
    case 'FIGMA':
      return 'Figma'
    case 'SENTRY':
      return 'Sentry'
    default:
      return props.provider
  }
})

const providerBgClass = computed(() => {
  switch (props.provider) {
    case 'GITHUB':
      return 'bg-gray-900 dark:bg-gray-700'
    case 'LINEAR':
      return 'bg-blue-600 dark:bg-blue-700'
    case 'FIGMA':
      return 'bg-purple-600 dark:bg-purple-700'
    case 'SENTRY':
      return 'bg-indigo-600 dark:bg-indigo-700'
    default:
      return 'bg-gray-600'
  }
})

// Connection data
const connection = computed(() => {
  return integrationsStore.getProviderConnection(props.provider)
})

const isConnected = computed(() => {
  return integrationsStore.isProviderConnected(props.provider)
})

const status = computed(() => {
  if (!connection.value) {
    return 'not_configured'
  }
  if (connection.value.refreshFailed) {
    return 'error'
  }
  if (connection.value.isActive) {
    return 'connected'
  }
  return 'disconnected'
})

const testResult = computed(() => {
  return testResults.value.get(props.provider)
})

// Actions
const handleConnect = async () => {
  try {
    await integrationsStore.connectOAuth(props.projectId, props.provider)
    emit('connected')
  } catch (e: any) {
    console.error('Connection failed:', e)
    // Error is already set in store
  }
}

const handleDisconnect = async () => {
  if (!confirm(`Are you sure you want to disconnect ${providerName.value}?`)) {
    return
  }

  try {
    await integrationsStore.disconnectOAuth(props.projectId, props.provider)
    emit('disconnected')
  } catch (e: any) {
    console.error('Disconnect failed:', e)
  }
}

const handleTest = async () => {
  try {
    await integrationsStore.testConnection(props.projectId, props.provider)
    emit('tested')
  } catch (e: any) {
    console.error('Test failed:', e)
  }
}

// Utilities
const formatDate = (dateString: string) => {
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

// Provider icons (simple SVG paths)
const providerIcon = computed(() => {
  // Return a simple icon component for each provider
  return 'svg'
})
</script>
