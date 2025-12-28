<template>
  <div class="space-y-2">
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </label>
    <select
      :value="modelValue"
      :disabled="disabled"
      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      @change="handleChange"
    >
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
          {{ model.name }} {{ getTierBadge(model.tier) }}
        </option>
      </optgroup>
    </select>
    <p v-if="selectedModelInfo" class="text-xs text-gray-500 dark:text-gray-400">
      {{ selectedModelInfo.description }}
    </p>
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
  modelValue: string
  models: AIModelInfo[]
  label?: string
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  label: 'AI Model',
  disabled: false,
})

const emit = defineEmits<Emits>()

// Group models by provider
const modelsByProvider = computed(() => {
  const grouped: Record<string, AIModelInfo[]> = {}
  for (const model of props.models) {
    if (!grouped[model.provider]) {
      grouped[model.provider] = []
    }
    grouped[model.provider].push(model)
  }
  return grouped
})

// Get selected model info
const selectedModelInfo = computed(() => {
  return props.models.find((m) => m.id === props.modelValue)
})

// Format provider name for display
const formatProviderName = (provider: string): string => {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    meta: 'Meta',
  }
  return names[provider] || provider
}

// Get tier badge emoji
const getTierBadge = (tier: string): string => {
  const badges: Record<string, string> = {
    fast: '⚡',
    balanced: '⚖️',
    premium: '🏆',
  }
  return badges[tier] || ''
}

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>
