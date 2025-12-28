<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">DevFlow</h1>
      <p class="text-gray-600 mb-8">Universal DevOps Orchestrator</p>
      <div class="space-x-4">
        <NuxtLink
          to="/login"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Sign In
        </NuxtLink>
        <NuxtLink
          to="/signup"
          class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Create Account
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Redirect authenticated users to dashboard
const { isAuthenticated, isLoading } = useAuth()

watch([isAuthenticated, isLoading], ([authenticated, loading]) => {
  if (!loading && authenticated) {
    navigateTo('/dashboard')
  }
}, { immediate: true })
</script>
