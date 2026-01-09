<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="handleClose"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Invite Team Member
        </h3>

        <form @submit.prevent="handleSubmit">
          <!-- Email Input -->
          <div class="mb-4">
            <label
              for="invite-email"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email address
            </label>
            <input
              id="invite-email"
              v-model="email"
              type="email"
              required
              placeholder="colleague@company.com"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- Role Select -->
          <div class="mb-6">
            <label
              for="invite-role"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Role
            </label>
            <select
              id="invite-role"
              v-model="role"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ADMIN">Admin - Full access except ownership</option>
              <option value="MAINTAINER">Maintainer - Manage projects and tasks</option>
              <option value="VIEWER">Viewer - Read-only access</option>
            </select>
          </div>

          <!-- Error Message -->
          <p v-if="error" class="mb-4 text-sm text-red-600 dark:text-red-400">
            {{ error }}
          </p>

          <!-- Actions -->
          <div class="flex justify-end gap-3">
            <button
              type="button"
              @click="handleClose"
              :disabled="isLoading"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isLoading || !email"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isLoading ? 'Sending...' : 'Send Invite' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  invite: [email: string, role: string]
}>()

const email = ref('')
const role = ref<'ADMIN' | 'MAINTAINER' | 'VIEWER'>('VIEWER')
const error = ref<string | null>(null)
const isLoading = ref(false)

// Reset form when modal opens
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      email.value = ''
      role.value = 'VIEWER'
      error.value = null
      isLoading.value = false
    }
  },
)

const handleClose = () => {
  if (!isLoading.value) {
    emit('close')
  }
}

const handleSubmit = async () => {
  if (!email.value) return

  error.value = null
  isLoading.value = true

  try {
    emit('invite', email.value, role.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to send invite'
  } finally {
    isLoading.value = false
  }
}

// Expose methods for parent to call
defineExpose({
  setError: (msg: string) => {
    error.value = msg
    isLoading.value = false
  },
  setLoading: (loading: boolean) => {
    isLoading.value = loading
  },
})
</script>
