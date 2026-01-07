<template>
  <div class="flex items-center justify-between py-2 gap-3">
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <span class="text-sm text-gray-700 dark:text-gray-300">{{ label }}</span>
      <!-- AI indicator -->
      <span
        v-if="usesAI"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
        title="Uses AI"
      >
        AI
      </span>
      <!-- OAuth indicator -->
      <span
        v-if="requiredOAuth && !oauthConnected"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        :title="`Requires ${requiredOAuth} connection`"
      >
        {{ requiredOAuth }}
      </span>
      <span
        v-else-if="requiredOAuth && oauthConnected"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      >
        {{ requiredOAuth }}
      </span>
    </div>

    <!-- Model selector (for AI features) -->
    <select
      v-if="showModelSelector && modelValue"
      :value="selectedModel || ''"
      :disabled="!modelValue"
      class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed max-w-[140px]"
      @change="handleModelChange"
    >
      <option value="">Default</option>
      <optgroup
        v-for="(providerModels, provider) in modelsByProvider"
        :key="provider"
        :label="formatProviderName(provider)"
      >
        <option
          v-for="model in providerModels"
          :key="model.id"
          :value="model.id"
        >
          {{ model.name }}
        </option>
      </optgroup>
    </select>

    <!-- Toggle switch -->
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled || !!(requiredOAuth && !oauthConnected)"
      :class="[
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
        modelValue ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600',
        (disabled || (requiredOAuth && !oauthConnected)) ? 'opacity-50 cursor-not-allowed' : ''
      ]"
      @click="toggle"
    >
      <span
        :class="[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          modelValue ? 'translate-x-5' : 'translate-x-0'
        ]"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface AIModelInfo {
  id: string
  name: string
  provider: string
  description: string
  tier: 'fast' | 'balanced' | 'premium'
  costTier: 1 | 2 | 3
  recommendedFor: string[]
}

interface Props {
  modelValue: boolean
  label: string
  requiredOAuth?: string | null
  oauthConnected?: boolean
  disabled?: boolean
  usesAI?: boolean
  showModelSelector?: boolean
  selectedModel?: string
  aiModels?: AIModelInfo[]
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:selectedModel', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  requiredOAuth: null,
  oauthConnected: false,
  disabled: false,
  usesAI: false,
  showModelSelector: false,
  selectedModel: '',
  aiModels: () => [],
})

const emit = defineEmits<Emits>()

// Group models by provider
const modelsByProvider = computed(() => {
  const grouped: Record<string, AIModelInfo[]> = {}
  for (const model of props.aiModels) {
    const provider = model.provider
    if (!grouped[provider]) {
      grouped[provider] = []
    }
    grouped[provider]!.push(model)
  }
  return grouped
})

// Format provider name
const formatProviderName = (provider: string): string => {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    meta: 'Meta',
  }
  return names[provider] || provider
}

const toggle = () => {
  if (props.disabled || (props.requiredOAuth && !props.oauthConnected)) return
  emit('update:modelValue', !props.modelValue)
}

const handleModelChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:selectedModel', target.value)
}
</script>
