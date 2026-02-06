<script setup lang="ts">
/**
 * ChatInput - Text input for sending messages to the agent
 */

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const message = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const maxLength = 4000
const maxRows = 5

/**
 * Auto-resize textarea based on content
 */
function autoResize() {
  const textarea = textareaRef.value
  if (!textarea) return

  // Reset height to calculate new height
  textarea.style.height = 'auto'

  // Calculate new height (limited to maxRows)
  const lineHeight = 24 // Approximate line height in px
  const maxHeight = lineHeight * maxRows
  const newHeight = Math.min(textarea.scrollHeight, maxHeight)

  textarea.style.height = `${newHeight}px`
}

/**
 * Handle keydown for submit on Enter
 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
  }
}

/**
 * Submit the message
 */
function handleSubmit() {
  const trimmed = message.value.trim()
  if (!trimmed || props.disabled) return

  emit('send', trimmed)
  message.value = ''

  // Reset textarea height
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

// Auto-resize on input
watch(message, () => {
  nextTick(autoResize)
})
</script>

<template>
  <div class="relative">
    <div
      class="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-800"
      :class="{ 'border-indigo-500 ring-1 ring-indigo-500': message.length > 0 }"
    >
      <!-- Textarea -->
      <textarea
        ref="textareaRef"
        v-model="message"
        :placeholder="placeholder || 'Envoyer un message...'"
        :disabled="disabled"
        :maxlength="maxLength"
        rows="1"
        class="flex-1 resize-none bg-transparent text-gray-900 placeholder-gray-400 outline-none dark:text-white dark:placeholder-gray-500"
        :class="{ 'cursor-not-allowed opacity-50': disabled }"
        @keydown="handleKeydown"
      />

      <!-- Send button -->
      <button
        type="button"
        :disabled="disabled || !message.trim()"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleSubmit"
      >
        <!-- Loading spinner when disabled (streaming) -->
        <svg
          v-if="disabled"
          class="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <!-- Arrow up icon -->
        <svg
          v-else
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>

    <!-- Character count (shown when near limit) -->
    <div
      v-if="message.length > maxLength * 0.8"
      class="absolute -bottom-5 right-0 text-xs"
      :class="message.length >= maxLength ? 'text-red-500' : 'text-gray-400'"
    >
      {{ message.length }}/{{ maxLength }}
    </div>
  </div>
</template>
