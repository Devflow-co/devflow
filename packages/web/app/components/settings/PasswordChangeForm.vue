<template>
  <div class="space-y-4">
    <form @submit.prevent="handleSubmit">
      <!-- Current Password -->
      <div class="mb-4">
        <label
          for="current-password"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Current Password
        </label>
        <input
          id="current-password"
          v-model="currentPassword"
          type="password"
          required
          autocomplete="current-password"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- New Password -->
      <div class="mb-4">
        <label
          for="new-password"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          New Password
        </label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          required
          autocomplete="new-password"
          minlength="8"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Minimum 8 characters with uppercase, lowercase, and number
        </p>
      </div>

      <!-- Confirm New Password -->
      <div class="mb-6">
        <label
          for="confirm-password"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Confirm New Password
        </label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          required
          autocomplete="new-password"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Validation Errors -->
      <div v-if="validationError" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p class="text-sm text-red-600 dark:text-red-400">{{ validationError }}</p>
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <p class="text-sm text-green-600 dark:text-green-400">{{ successMessage }}</p>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        :disabled="isLoading || !isFormValid"
        class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ isLoading ? 'Updating...' : 'Update Password' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  submit: [currentPassword: string, newPassword: string]
}>()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const validationError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const isFormValid = computed(() => {
  return (
    currentPassword.value.length > 0 &&
    newPassword.value.length >= 8 &&
    confirmPassword.value === newPassword.value
  )
})

const validateForm = (): boolean => {
  validationError.value = null

  if (newPassword.value.length < 8) {
    validationError.value = 'New password must be at least 8 characters'
    return false
  }

  if (!/[A-Z]/.test(newPassword.value)) {
    validationError.value = 'Password must contain at least one uppercase letter'
    return false
  }

  if (!/[a-z]/.test(newPassword.value)) {
    validationError.value = 'Password must contain at least one lowercase letter'
    return false
  }

  if (!/\d/.test(newPassword.value)) {
    validationError.value = 'Password must contain at least one number'
    return false
  }

  if (newPassword.value !== confirmPassword.value) {
    validationError.value = 'Passwords do not match'
    return false
  }

  return true
}

const handleSubmit = () => {
  if (!validateForm()) return

  isLoading.value = true
  successMessage.value = null
  emit('submit', currentPassword.value, newPassword.value)
}

const resetForm = () => {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  isLoading.value = false
  validationError.value = null
}

// Expose methods for parent to call
defineExpose({
  setLoading: (loading: boolean) => {
    isLoading.value = loading
  },
  setError: (error: string) => {
    validationError.value = error
    isLoading.value = false
  },
  setSuccess: (message: string) => {
    successMessage.value = message
    isLoading.value = false
    resetForm()
  },
  reset: resetForm,
})
</script>
