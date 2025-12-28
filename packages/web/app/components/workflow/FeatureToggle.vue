<template>
  <div class="flex items-center justify-between py-2">
    <div class="flex items-center gap-2">
      <span class="text-sm text-gray-700 dark:text-gray-300">{{ label }}</span>
      <!-- OAuth indicator -->
      <span
        v-if="requiredOAuth && !oauthConnected"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        :title="`Requires ${requiredOAuth} connection`"
      >
        {{ requiredOAuth }}
      </span>
      <span
        v-else-if="requiredOAuth && oauthConnected"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      >
        {{ requiredOAuth }}
      </span>
    </div>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled || (requiredOAuth && !oauthConnected)"
      :class="[
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
        modelValue ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600',
        (disabled || (requiredOAuth && !oauthConnected)) ? 'opacity-50 cursor-not-allowed' : ''
      ]"
      @click="toggle"
    >
      <span
        :class="[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          modelValue ? 'translate-x-5' : 'translate-x-0'
        ]"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  label: string
  requiredOAuth?: string | null
  oauthConnected?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  requiredOAuth: null,
  oauthConnected: false,
  disabled: false,
})

const emit = defineEmits<Emits>()

const toggle = () => {
  if (props.disabled || (props.requiredOAuth && !props.oauthConnected)) return
  emit('update:modelValue', !props.modelValue)
}
</script>
