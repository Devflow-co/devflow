<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <AppNavbar />

    <main class="max-w-4xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          Manage your personal information and account security
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !userProfile" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6">
        <p class="text-red-600 dark:text-red-400">{{ error }}</p>
        <button
          @click="fetchUserProfile"
          class="mt-2 text-sm text-red-700 dark:text-red-300 underline"
        >
          Try again
        </button>
      </div>

      <template v-else-if="userProfile">
        <!-- Avatar Section -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Picture</h2>
          <SettingsAvatarUpload
            ref="avatarUploadRef"
            :model-value="userProfile.avatar"
            :initial="userProfile.name?.charAt(0) || userProfile.email.charAt(0)"
            @upload="handleAvatarUpload"
            @remove="handleAvatarRemove"
          />
        </section>

        <!-- Profile Information -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Profile Information
          </h2>

          <form @submit.prevent="handleProfileUpdate" class="space-y-4">
            <!-- Name -->
            <div>
              <label
                for="name"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Display Name
              </label>
              <input
                id="name"
                v-model="profileForm.name"
                type="text"
                class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <!-- Email (read-only for SSO users) -->
            <div>
              <label
                for="email"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email Address
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="email"
                  :value="userProfile.email"
                  type="email"
                  disabled
                  class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <span
                  v-if="userProfile.emailVerified"
                  class="text-green-600 dark:text-green-400 text-sm flex items-center gap-1"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Verified
                </span>
              </div>
              <p v-if="isSSO" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Email managed by {{ userProfile.ssoProvider }}
              </p>
            </div>

            <!-- Save Button -->
            <div class="pt-2">
              <button
                type="submit"
                :disabled="loading || profileForm.name === userProfile.name"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ loading ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </section>

        <!-- SSO Info -->
        <section v-if="isSSO" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Single Sign-On
          </h2>
          <div class="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div class="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <svg v-if="userProfile.ssoProvider === 'google'" class="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <svg v-else-if="userProfile.ssoProvider === 'github'" class="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                Connected with {{ userProfile.ssoProvider }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Your account is managed by {{ userProfile.ssoProvider }}. Password and email changes must be made there.
              </p>
            </div>
          </div>
        </section>

        <!-- Password Change (only for non-SSO users) -->
        <section v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Password</h2>
          <div class="max-w-md">
            <SettingsPasswordChangeForm ref="passwordFormRef" @submit="handlePasswordChange" />
          </div>
        </section>

        <!-- Account Info -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account</h2>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500 dark:text-gray-400">Member since</dt>
              <dd class="text-gray-900 dark:text-white">{{ formatDate(userProfile.createdAt) }}</dd>
            </div>
            <div v-if="userProfile.lastLoginAt" class="flex justify-between">
              <dt class="text-gray-500 dark:text-gray-400">Last login</dt>
              <dd class="text-gray-900 dark:text-white">
                {{ formatDate(userProfile.lastLoginAt) }}
              </dd>
            </div>
          </dl>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

definePageMeta({
  middleware: 'auth',
})

const settingsStore = useSettingsStore()
const { userProfile, loading, error, isSSO } = storeToRefs(settingsStore)
const { fetchUserProfile, updateProfile, uploadAvatar, removeAvatar, changePassword } =
  settingsStore

const avatarUploadRef = ref<{ clear: () => void; setUploading: (v: boolean) => void } | null>(null)
const passwordFormRef = ref<{
  setLoading: (v: boolean) => void
  setError: (msg: string) => void
  setSuccess: (msg: string) => void
} | null>(null)

const profileForm = ref({
  name: '',
})

// Initialize form when profile is loaded
onMounted(async () => {
  await fetchUserProfile()
  if (userProfile.value) {
    profileForm.value.name = userProfile.value.name || ''
  }
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const handleProfileUpdate = async () => {
  try {
    await updateProfile({ name: profileForm.value.name })
  } catch (e) {
    console.error('Failed to update profile:', e)
  }
}

const handleAvatarUpload = async (file: File) => {
  try {
    await uploadAvatar(file)
    avatarUploadRef.value?.clear()
  } catch (e) {
    console.error('Failed to upload avatar:', e)
  } finally {
    avatarUploadRef.value?.setUploading(false)
  }
}

const handleAvatarRemove = async () => {
  try {
    await removeAvatar()
  } catch (e) {
    console.error('Failed to remove avatar:', e)
  }
}

const handlePasswordChange = async (currentPassword: string, newPassword: string) => {
  try {
    await changePassword({ currentPassword, newPassword })
    passwordFormRef.value?.setSuccess('Password updated successfully. Please log in again.')
  } catch (e) {
    passwordFormRef.value?.setError(e instanceof Error ? e.message : 'Failed to change password')
  }
}
</script>
