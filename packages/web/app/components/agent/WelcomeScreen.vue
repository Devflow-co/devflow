<script setup lang="ts">
/**
 * WelcomeScreen - Initial screen with prompt suggestions
 */

import type { PromptSuggestion } from '~/types/agent.types'

const emit = defineEmits<{
  select: [prompt: string]
}>()

const suggestions: PromptSuggestion[] = [
  {
    icon: '📋',
    label: 'Créer une tâche',
    prompt: 'Crée une nouvelle tâche Linear pour implémenter',
  },
  {
    icon: '🔍',
    label: 'Chercher du code',
    prompt: 'Cherche dans le codebase comment fonctionne',
  },
  {
    icon: '🚀',
    label: 'Lancer un workflow',
    prompt: 'Lance le workflow de refinement pour la tâche',
  },
  {
    icon: '📊',
    label: 'Statut workflows',
    prompt: 'Montre-moi le statut de mes workflows en cours',
  },
]

function handleSelect(suggestion: PromptSuggestion) {
  emit('select', suggestion.prompt)
}
</script>

<template>
  <div class="flex flex-col items-center justify-center px-4 py-12">
    <!-- Logo / Title -->
    <div class="mb-8 text-center">
      <div class="mb-4 text-6xl">
        <span class="inline-block animate-bounce">🤖</span>
      </div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        DevFlow Agent
      </h1>
      <p class="mt-2 text-gray-500 dark:text-gray-400">
        Comment puis-je vous aider aujourd'hui ?
      </p>
    </div>

    <!-- Prompt suggestions -->
    <div class="grid w-full max-w-lg gap-3">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.label"
        class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20"
        @click="handleSelect(suggestion)"
      >
        <span class="text-2xl">{{ suggestion.icon }}</span>
        <div>
          <div class="font-medium text-gray-900 dark:text-white">
            {{ suggestion.label }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{ suggestion.prompt }}...
          </div>
        </div>
      </button>
    </div>

    <!-- Help text -->
    <p class="mt-8 max-w-md text-center text-sm text-gray-400">
      Posez une question en langage naturel ou sélectionnez une suggestion ci-dessus.
      L'agent peut interagir avec Linear, GitHub, et votre codebase.
    </p>
  </div>
</template>
