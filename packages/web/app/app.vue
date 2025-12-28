<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NuxtRouteAnnouncer />
    <!-- Navbar (hidden on auth pages) -->
    <AppNavbar v-if="showNavbar" />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppNavbar from '@/components/AppNavbar.vue'

const route = useRoute()

// Hide navbar on authentication pages
const showNavbar = computed(() => {
  const authPages = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ]

  return !authPages.some((page) => route.path.startsWith(page))
})
</script>
