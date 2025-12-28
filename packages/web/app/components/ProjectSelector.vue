<template>
  <div class="relative" v-if="hasProjects">
    <!-- Dropdown Button -->
    <button
      @click="toggleDropdown"
      class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      type="button"
    >
      <svg
        class="w-5 h-5 text-gray-500 dark:text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
        {{ selectedProject ? selectedProject.name : 'Select Project' }}
      </span>
      <svg
        class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
      >
        <!-- Projects List -->
        <div class="max-h-96 overflow-y-auto py-1">
          <button
            v-for="project in projects"
            :key="project.id"
            @click="selectAndClose(project.id)"
            class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
            :class="{
              'bg-blue-50 dark:bg-blue-900/20': selectedProjectId === project.id,
            }"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ project.name }}
              </div>
              <div
                v-if="project.description"
                class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5"
              >
                {{ project.description }}
              </div>
              <div class="flex items-center gap-3 mt-1">
                <span
                  v-if="project._count"
                  class="text-xs text-gray-400 dark:text-gray-500"
                >
                  {{ project._count.tasks }} tasks
                </span>
                <span
                  v-if="project.oauthConnections && project.oauthConnections.length > 0"
                  class="text-xs text-green-600 dark:text-green-400"
                >
                  {{ project.oauthConnections.length }} connected
                </span>
              </div>
            </div>
            <svg
              v-if="selectedProjectId === project.id"
              class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          <!-- Empty state -->
          <div v-if="projects.length === 0" class="px-4 py-8 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">No projects yet</p>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-gray-200 dark:border-gray-700"></div>

        <!-- Create New Project -->
        <div class="py-1">
          <NuxtLink
            to="/projects/new"
            @click="closeDropdown"
            class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-blue-600 dark:text-blue-400"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span class="text-sm font-medium">Create New Project</span>
          </NuxtLink>
        </div>
      </div>
    </transition>

    <!-- Backdrop (click outside to close) -->
    <div
      v-if="isOpen"
      @click="closeDropdown"
      class="fixed inset-0 z-40"
      aria-hidden="true"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { storeToRefs } from 'pinia'

const projectsStore = useProjectsStore()
const { projects, selectedProjectId, selectedProject, hasProjects } = storeToRefs(projectsStore)

const isOpen = ref(false)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectAndClose = (projectId: string) => {
  projectsStore.selectProject(projectId)
  closeDropdown()
}

// Close dropdown on Escape key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
