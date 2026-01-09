<template>
  <Teleport to="body">
    <Transition name="slide-over">
      <div
        v-if="open"
        class="fixed inset-0 z-50 overflow-hidden"
        aria-labelledby="slide-over-title"
        role="dialog"
        aria-modal="true"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-gray-500/75 dark:bg-gray-900/80 transition-opacity"
          @click="$emit('close')"
        ></div>

        <!-- Panel -->
        <div class="fixed inset-y-0 right-0 flex max-w-full pl-10">
          <Transition name="slide-panel">
            <div
              v-if="open"
              class="w-screen max-w-2xl"
            >
              <div class="flex h-full flex-col overflow-y-auto bg-white dark:bg-gray-800 shadow-xl">
                <slot></slot>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  open: boolean
}

defineProps<Props>()

defineEmits<{
  close: []
}>()
</script>

<style scoped>
/* Backdrop fade */
.slide-over-enter-active,
.slide-over-leave-active {
  transition: opacity 0.3s ease;
}

.slide-over-enter-from,
.slide-over-leave-to {
  opacity: 0;
}

/* Panel slide */
.slide-panel-enter-active {
  transition: transform 0.3s ease-out;
}

.slide-panel-leave-active {
  transition: transform 0.2s ease-in;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
}
</style>
