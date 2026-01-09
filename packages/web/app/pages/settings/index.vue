<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

// Redirect to profile settings by default
navigateTo('/settings/profile', { replace: true })
</script>
