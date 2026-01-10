/**
 * Simple color mode composable (Tailwind CSS dark class detection)
 * Replacement for @nuxtjs/color-mode when not installed
 */

const colorModeValue = ref<'light' | 'dark'>('light')
let isInitialized = false

export const useColorMode = () => {
  const updateColorMode = () => {
    if (import.meta.client) {
      colorModeValue.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
  }

  // Initialize once
  if (import.meta.client && !isInitialized) {
    updateColorMode()
    isInitialized = true

    // Watch for changes to the dark class
    const observer = new MutationObserver(updateColorMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
  }

  return { value: colorModeValue }
}
