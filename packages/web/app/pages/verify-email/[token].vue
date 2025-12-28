<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Email Verification
        </h2>
      </div>

      <div v-if="isLoading" class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="mt-4 text-sm text-gray-600">Verifying your email...</p>
      </div>

      <div v-else-if="success" class="mt-8 text-center">
        <div class="rounded-md bg-green-50 p-4 mb-4">
          <div class="flex justify-center mb-2">
            <svg class="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p class="text-sm text-green-700">
            Your email has been verified successfully!
          </p>
        </div>
        <NuxtLink
          to="/dashboard"
          class="font-medium text-indigo-600 hover:text-indigo-500"
        >
          Go to dashboard
        </NuxtLink>
      </div>

      <div v-else class="mt-8 text-center">
        <div class="rounded-md bg-red-50 p-4 mb-4">
          <div class="flex justify-center mb-2">
            <svg class="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p class="text-sm text-red-700">
            {{ error || 'Verification failed. The link may be invalid or expired.' }}
          </p>
        </div>
        <p class="text-sm text-gray-600">
          <NuxtLink to="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
            Return to login
          </NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const api = useApi()

const token = computed(() => route.params.token as string)
const isLoading = ref(true)
const success = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    await api.post('/user-auth/verify-email', { token: token.value })
    success.value = true
  } catch (e: any) {
    error.value = e.message || 'Verification failed'
  } finally {
    isLoading.value = false
  }
})
</script>
