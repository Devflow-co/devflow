<script setup lang="ts">
/**
 * Index Page - Main entry point for DevFlow
 * Shows agent chat for authenticated users, landing page for others
 */

definePageMeta({
  layout: false, // No default layout - immersive mode
})

const { isAuthenticated, isLoading } = useAuth()
</script>

<template>
  <!-- Loading state -->
  <div
    v-if="isLoading"
    class="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950"
  >
    <div class="text-center">
      <div class="mb-4 text-5xl">🤖</div>
      <div class="animate-pulse text-gray-500">Chargement...</div>
    </div>
  </div>

  <!-- Authenticated: Show Agent Chat -->
  <AgentChat v-else-if="isAuthenticated" />

  <!-- Not authenticated: Show Landing Page -->
  <div
    v-else
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-950"
  >
    <div class="text-center">
      <div class="mb-6 text-6xl">🤖</div>
      <h1 class="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
        DevFlow
      </h1>
      <p class="mb-8 text-lg text-gray-600 dark:text-gray-400">
        Universal DevOps Orchestrator
      </p>
      <p class="mb-8 max-w-md text-gray-500 dark:text-gray-500">
        Transformez vos tâches Linear en code déployé grâce à un agent conversationnel alimenté par l'IA.
      </p>
      <div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <NuxtLink
          to="/login"
          class="inline-flex w-40 items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Se connecter
        </NuxtLink>
        <NuxtLink
          to="/signup"
          class="inline-flex w-40 items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Créer un compte
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
