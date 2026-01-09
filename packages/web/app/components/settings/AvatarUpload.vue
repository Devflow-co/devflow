<template>
  <div class="flex items-center gap-6">
    <!-- Current Avatar Preview -->
    <div class="relative">
      <div
        :class="[
          'overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center',
          isLogo ? 'w-24 h-24 rounded-lg' : 'w-24 h-24 rounded-full',
        ]"
      >
        <img
          v-if="displayImage"
          :src="displayImage"
          alt="Avatar"
          class="w-full h-full object-cover"
        />
        <span v-else class="text-3xl font-bold text-gray-400 dark:text-gray-500">
          {{ initial }}
        </span>
      </div>
      <!-- Remove button (if has avatar) -->
      <button
        v-if="modelValue || preview"
        type="button"
        @click="handleRemove"
        class="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Upload Controls -->
    <div class="flex-1">
      <div
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop"
        :class="[
          'border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400',
        ]"
        @click="openFileInput"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="hidden"
          @change="handleInputChange"
        />
        <svg
          class="w-8 h-8 mx-auto text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ isDragging ? 'Drop image here' : 'Click or drag to upload' }}
        </p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
          PNG, JPG, WebP up to {{ maxSizeMB }}MB
        </p>
      </div>

      <!-- Error Message -->
      <p v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </p>

      <!-- Save/Cancel buttons when preview exists -->
      <div v-if="preview && !error" class="mt-3 flex gap-2">
        <button
          type="button"
          @click="handleSave"
          :disabled="isUploading"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isUploading ? 'Uploading...' : 'Save' }}
        </button>
        <button
          type="button"
          @click="clear"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useImageUpload } from '@/composables/useImageUpload'

interface Props {
  modelValue: string | null
  initial?: string
  isLogo?: boolean
  maxSizeBytes?: number
}

const props = withDefaults(defineProps<Props>(), {
  initial: 'U',
  isLogo: false,
  maxSizeBytes: 5 * 1024 * 1024,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  upload: [file: File]
  remove: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const {
  file,
  preview,
  error,
  isDragging,
  isUploading,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  handleInputChange,
  clear,
  setUploading,
} = useImageUpload({ maxSizeBytes: props.maxSizeBytes })

const maxSizeMB = computed(() => Math.round(props.maxSizeBytes / 1024 / 1024))

const displayImage = computed(() => preview.value || props.modelValue)

const openFileInput = () => {
  fileInputRef.value?.click()
}

const handleSave = async () => {
  if (file.value) {
    setUploading(true)
    try {
      emit('upload', file.value)
    } finally {
      // Clear will be called by parent after successful upload
    }
  }
}

const handleRemove = () => {
  clear()
  emit('remove')
}

// Expose clear and setUploading for parent to call after upload
defineExpose({ clear, setUploading })
</script>
