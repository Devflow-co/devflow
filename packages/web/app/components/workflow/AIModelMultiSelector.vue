<template>
  <div class="space-y-2">
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </label>

    <!-- Dropdown trigger -->
    <div class="relative">
      <button
        ref="triggerRef"
        type="button"
        :disabled="disabled"
        class="w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
        @click="toggleDropdown"
      >
        <span v-if="selectedModels.length === 0" class="text-gray-500 dark:text-gray-400">
          Select models...
        </span>
        <span v-else class="text-sm">
          {{ selectedModels.length }} model{{ selectedModels.length !== 1 ? 's' : '' }} selected
        </span>
        <svg
          class="w-4 h-4 text-gray-400 transition-transform"
          :class="{ 'rotate-180': isOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown panel -->
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
      >
        <div
          v-for="(providerModels, provider) in modelsByProvider"
          :key="provider"
          class="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
        >
          <!-- Provider header -->
          <div class="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {{ formatProviderName(provider) }}
          </div>

          <!-- Model checkboxes -->
          <div class="py-1">
            <label
              v-for="model in providerModels"
              :key="model.id"
              class="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              :class="{ 'opacity-50 cursor-not-allowed': isAtMaxSelection && !isSelected(model.id) }"
            >
              <input
                type="checkbox"
                :checked="isSelected(model.id)"
                :disabled="disabled || (isAtMaxSelection && !isSelected(model.id))"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                @change="toggleModel(model.id)"
              />
              <span class="ml-3 flex-1">
                <span class="text-sm text-gray-900 dark:text-white">{{ model.name }}</span>
                <span class="ml-1.5 text-xs">{{ getTierBadge(model.tier) }}</span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected models as badges -->
    <div v-if="selectedModels.length > 0" class="flex flex-wrap gap-2">
      <span
        v-for="model in selectedModelInfos"
        :key="model.id"
        class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      >
        {{ model.name }}
        <button
          type="button"
          class="hover:text-blue-600 dark:hover:text-blue-200"
          @click="removeModel(model.id)"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <!-- Validation message -->
    <p v-if="validationMessage" class="text-xs text-amber-600 dark:text-amber-400">
      {{ validationMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

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
  modelValue: string[]
  models: AIModelInfo[]
  label?: string
  disabled?: boolean
  minSelection?: number
  maxSelection?: number
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  disabled: false,
  minSelection: 2,
  maxSelection: 5,
})

const emit = defineEmits<Emits>()

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

// Selected models
const selectedModels = computed(() => props.modelValue)

const selectedModelInfos = computed(() => {
  return props.modelValue
    .map((id) => props.models.find((m) => m.id === id))
    .filter((m): m is AIModelInfo => m !== undefined)
})

// Group models by provider
const modelsByProvider = computed(() => {
  const grouped: Record<string, AIModelInfo[]> = {}
  for (const model of props.models) {
    const provider = model.provider
    if (!grouped[provider]) {
      grouped[provider] = []
    }
    grouped[provider]!.push(model)
  }
  return grouped
})

// Validation
const isAtMaxSelection = computed(() => selectedModels.value.length >= props.maxSelection)

const validationMessage = computed(() => {
  if (selectedModels.value.length < props.minSelection) {
    return `Select at least ${props.minSelection} models`
  }
  if (isAtMaxSelection.value) {
    return `Maximum ${props.maxSelection} models allowed`
  }
  return ''
})

// Check if model is selected
const isSelected = (modelId: string): boolean => {
  return selectedModels.value.includes(modelId)
}

// Toggle model selection
const toggleModel = (modelId: string) => {
  const current = [...selectedModels.value]
  const index = current.indexOf(modelId)

  if (index === -1) {
    if (current.length < props.maxSelection) {
      current.push(modelId)
    }
  } else {
    current.splice(index, 1)
  }

  emit('update:modelValue', current)
}

// Remove model
const removeModel = (modelId: string) => {
  emit('update:modelValue', selectedModels.value.filter((id) => id !== modelId))
}

// Toggle dropdown
const toggleDropdown = () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

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

// Get tier badge
const getTierBadge = (tier: string): string => {
  const badges: Record<string, string> = {
    fast: '\u26A1',
    balanced: '\u2696\uFE0F',
    premium: '\uD83C\uDFC6',
  }
  return badges[tier] || ''
}

// Close dropdown on outside click
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (
    triggerRef.value &&
    dropdownRef.value &&
    !triggerRef.value.contains(target) &&
    !dropdownRef.value.contains(target)
  ) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
