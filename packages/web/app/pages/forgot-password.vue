<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset your password
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form v-if="!submitted" class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div v-if="error" class="rounded-md bg-red-50 p-4">
          <p class="text-sm text-red-700">{{ error }}</p>
        </div>

        <div>
          <label for="email" class="sr-only">Email address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Email address"
          />
        </div>

        <div>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSubmitting ? 'Sending...' : 'Send reset link' }}
          </button>
        </div>
      </form>

      <div v-else class="mt-8 text-center">
        <div class="rounded-md bg-green-50 p-4 mb-4">
          <p class="text-sm text-green-700">
            If an account exists with this email, you will receive a password reset link shortly.
          </p>
        </div>
        <p class="text-sm text-gray-600">
          Didn't receive the email? Check your spam folder or
          <button
            type="button"
            @click="submitted = false"
            class="font-medium text-indigo-600 hover:text-indigo-500"
          >
            try again
          </button>
        </p>
      </div>

      <p class="mt-2 text-center text-sm text-gray-600">
        Remember your password?
        <NuxtLink to="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
          Sign in
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { forgotPassword } = useAuth()

const email = ref('')
const isSubmitting = ref(false)
const error = ref('')
const submitted = ref(false)

async function handleSubmit() {
  try {
    isSubmitting.value = true
    error.value = ''
    await forgotPassword(email.value)
    submitted.value = true
  } catch (e: any) {
    error.value = e.message || 'Failed to send reset email'
  } finally {
    isSubmitting.value = false
  }
}
</script>
