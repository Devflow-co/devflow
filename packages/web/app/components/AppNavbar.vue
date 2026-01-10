<template>
  <nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo & Brand -->
        <div class="flex items-center gap-8">
          <NuxtLink to="/dashboard" class="flex items-center gap-2">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span class="text-xl font-bold text-gray-900 dark:text-white">DevFlow</span>
          </NuxtLink>

          <!-- Main Navigation -->
          <div class="hidden md:flex items-center gap-1">
            <NuxtLink
              to="/dashboard"
              class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              :class="isActive('/dashboard')
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/projects"
              class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              :class="isActive('/projects')
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'"
            >
              Projects
            </NuxtLink>
            <NuxtLink
              to="/workflows"
              class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              :class="isActive('/workflows')
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'"
            >
              Workflows
            </NuxtLink>
          </div>
        </div>

        <!-- Right Side: Project Selector + User Menu -->
        <div class="flex items-center gap-4">
          <!-- Project Selector (if user has projects) -->
          <ProjectSelector v-if="hasProjects" />

          <!-- User Menu -->
          <div class="relative">
            <button
              @click="toggleUserMenu"
              class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                {{ userInitial }}
              </div>
              <span class="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[150px] truncate">
                {{ user?.email }}
              </span>
              <svg
                class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform"
                :class="{ 'rotate-180': isUserMenuOpen }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- User Dropdown -->
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <div
                v-if="isUserMenuOpen"
                class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
              >
                <div class="py-2 px-4 border-b border-gray-200 dark:border-gray-700">
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ user?.name || user?.email }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {{ user?.email }}
                  </p>
                </div>

                <div class="py-1">
                  <NuxtLink
                    to="/settings/profile"
                    @click="closeUserMenu"
                    class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Profile Settings
                  </NuxtLink>
                  <NuxtLink
                    to="/settings/organization"
                    @click="closeUserMenu"
                    class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    Organization
                  </NuxtLink>
                </div>

                <div class="border-t border-gray-200 dark:border-gray-700"></div>

                <div class="py-1">
                  <button
                    @click="handleLogout"
                    class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </transition>

            <!-- Backdrop (click outside to close) -->
            <div
              v-if="isUserMenuOpen"
              @click="closeUserMenu"
              class="fixed inset-0 z-40"
              aria-hidden="true"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Navigation -->
    <div class="md:hidden border-t border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="flex items-center gap-1">
        <NuxtLink
          to="/dashboard"
          class="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors"
          :class="isActive('/dashboard')
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
        >
          Dashboard
        </NuxtLink>
        <NuxtLink
          to="/projects"
          class="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors"
          :class="isActive('/projects')
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
        >
          Projects
        </NuxtLink>
        <NuxtLink
          to="/workflows"
          class="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors"
          :class="isActive('/workflows')
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
        >
          Workflows
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/auth'
import { useProjectsStore } from '@/stores/projects'
import { storeToRefs } from 'pinia'
import ProjectSelector from './ProjectSelector.vue'

const route = useRoute()
const { user, logout } = useAuth()
const projectsStore = useProjectsStore()
const { hasProjects } = storeToRefs(projectsStore)

const isUserMenuOpen = ref(false)

const userInitial = computed(() => {
  if (user.value?.name) {
    return user.value.name.charAt(0).toUpperCase()
  }
  if (user.value?.email) {
    return user.value.email.charAt(0).toUpperCase()
  }
  return 'U'
})

const isActive = (path: string) => {
  if (path === '/dashboard') {
    return route.path === '/dashboard'
  }
  return route.path.startsWith(path)
}

const toggleUserMenu = () => {
  isUserMenuOpen.value = !isUserMenuOpen.value
}

const closeUserMenu = () => {
  isUserMenuOpen.value = false
}

const handleLogout = async () => {
  closeUserMenu()
  await logout()
}

// Close user menu on Escape key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isUserMenuOpen.value) {
    closeUserMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)

  // Load projects for project selector
  if (!hasProjects.value) {
    projectsStore.fetchProjects().catch(() => {
      // Ignore errors - user might not have projects yet
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
