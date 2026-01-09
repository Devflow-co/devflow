import { ref } from 'vue'

interface ImageUploadOptions {
  maxSizeBytes?: number
  acceptedTypes?: string[]
}

const DEFAULT_MAX_SIZE = 2 * 1024 * 1024 // 2MB
const DEFAULT_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export function useImageUpload(options: ImageUploadOptions = {}) {
  const {
    maxSizeBytes = DEFAULT_MAX_SIZE,
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  } = options

  const file = ref<File | null>(null)
  const preview = ref<string | null>(null)
  const error = ref<string | null>(null)
  const isDragging = ref(false)
  const isUploading = ref(false)

  const validateFile = (f: File): string | null => {
    if (!acceptedTypes.includes(f.type)) {
      const types = acceptedTypes.map((t) => t.split('/')[1]).join(', ')
      return `Invalid file type. Accepted: ${types}`
    }
    if (f.size > maxSizeBytes) {
      const maxMB = Math.round(maxSizeBytes / 1024 / 1024)
      return `File too large. Maximum size: ${maxMB}MB`
    }
    return null
  }

  const handleFile = (f: File): boolean => {
    error.value = validateFile(f)
    if (error.value) {
      file.value = null
      preview.value = null
      return false
    }

    file.value = f

    // Revoke previous preview URL if exists
    if (preview.value) {
      URL.revokeObjectURL(preview.value)
    }

    // Create new preview URL
    preview.value = URL.createObjectURL(f)
    return true
  }

  const handleDrop = (event: DragEvent) => {
    isDragging.value = false
    const files = event.dataTransfer?.files
    if (files?.[0]) {
      handleFile(files[0])
    }
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    isDragging.value = true
  }

  const handleDragLeave = () => {
    isDragging.value = false
  }

  const handleInputChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.files?.[0]) {
      handleFile(input.files[0])
    }
  }

  const clear = () => {
    if (preview.value) {
      URL.revokeObjectURL(preview.value)
    }
    file.value = null
    preview.value = null
    error.value = null
    isDragging.value = false
    isUploading.value = false
  }

  const setUploading = (value: boolean) => {
    isUploading.value = value
  }

  return {
    file,
    preview,
    error,
    isDragging,
    isUploading,
    handleFile,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleInputChange,
    clear,
    setUploading,
    validateFile,
  }
}
