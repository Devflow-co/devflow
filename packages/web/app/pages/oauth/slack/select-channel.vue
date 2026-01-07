<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <div class="max-w-2xl mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <!-- Header -->
        <div class="mb-6">
          <div class="flex items-center gap-3 mb-2">
            <!-- Slack Logo -->
            <svg class="w-8 h-8" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.712 0C16.558 0 14 2.558 14 5.712C14 8.866 16.558 11.424 19.712 11.424H25.424V5.712C25.424 2.558 22.866 0 19.712 0Z" fill="#E01E5A"/>
              <path d="M19.712 14H5.712C2.558 14 0 16.558 0 19.712C0 22.866 2.558 25.424 5.712 25.424H19.712C22.866 25.424 25.424 22.866 25.424 19.712C25.424 16.558 22.866 14 19.712 14Z" fill="#E01E5A"/>
              <path d="M54 19.712C54 16.558 51.442 14 48.288 14C45.134 14 42.576 16.558 42.576 19.712V25.424H48.288C51.442 25.424 54 22.866 54 19.712Z" fill="#2EB67D"/>
              <path d="M28.576 5.712V19.712C28.576 22.866 31.134 25.424 34.288 25.424C37.442 25.424 40 22.866 40 19.712V5.712C40 2.558 37.442 0 34.288 0C31.134 0 28.576 2.558 28.576 5.712Z" fill="#2EB67D"/>
              <path d="M34.288 54C37.442 54 40 51.442 40 48.288C40 45.134 37.442 42.576 34.288 42.576H28.576V48.288C28.576 51.442 31.134 54 34.288 54Z" fill="#ECB22E"/>
              <path d="M34.288 28.576H48.288C51.442 28.576 54 31.134 54 34.288C54 37.442 51.442 40 48.288 40H34.288C31.134 40 28.576 37.442 28.576 34.288C28.576 31.134 31.134 28.576 34.288 28.576Z" fill="#ECB22E"/>
              <path d="M0 34.288C0 37.442 2.558 40 5.712 40C8.866 40 11.424 37.442 11.424 34.288V28.576H5.712C2.558 28.576 0 31.134 0 34.288Z" fill="#36C5F0"/>
              <path d="M25.424 48.288V34.288C25.424 31.134 22.866 28.576 19.712 28.576C16.558 28.576 14 31.134 14 34.288V48.288C14 51.442 16.558 54 19.712 54C22.866 54 25.424 51.442 25.424 48.288Z" fill="#36C5F0"/>
            </svg>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              Select a Slack Channel
            </h1>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Choose a channel where DevFlow will send notifications
          </p>
        </div>

        <!-- Workspace Info -->
        <div v-if="teamName" class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Workspace: <span class="font-medium text-gray-900 dark:text-white">{{ teamName }}</span>
          </p>
        </div>

        <!-- Channels List -->
        <div v-if="loading" class="text-center py-8 text-gray-600 dark:text-gray-400">
          <div class="inline-flex items-center gap-2">
            <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Loading channels...
          </div>
        </div>

        <template v-else>
          <!-- Search Input -->
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search channels..."
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
          />

          <!-- Empty State -->
          <div v-if="filteredChannels.length === 0" class="text-center py-8 text-gray-600 dark:text-gray-400">
            <p>No channels found</p>
            <p class="text-sm mt-1">Try a different search term</p>
          </div>

          <!-- Channels List -->
          <div v-else class="space-y-2 max-h-96 overflow-y-auto">
            <div
              v-for="channel in filteredChannels"
              :key="channel.id"
              @click="selectChannel(channel)"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer
                     hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700
                     transition-colors flex items-center justify-between"
              :class="{ 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700': saving && selectedChannel?.id === channel.id }"
            >
              <div class="flex items-center gap-3">
                <!-- Channel Icon -->
                <span class="text-gray-500 dark:text-gray-400 text-lg">#</span>
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">{{ channel.name }}</h3>
                  <p v-if="channel.num_members" class="text-sm text-gray-500 dark:text-gray-400">
                    {{ channel.num_members }} members
                  </p>
                </div>
              </div>
              <div v-if="saving && selectedChannel?.id === channel.id" class="text-purple-600 dark:text-purple-400">
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              </div>
              <svg v-else class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          </div>
        </template>

        <!-- Actions -->
        <div class="flex gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            @click="skip"
            :disabled="saving"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                   rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip and configure later
          </button>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p class="text-red-800 dark:text-red-200">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string
const projectId = route.query.projectId as string

interface SlackChannel {
  id: string
  name: string
  is_channel: boolean
  is_private: boolean
  is_member: boolean
  num_members?: number
}

const channels = ref<SlackChannel[]>([])
const selectedChannel = ref<SlackChannel | null>(null)
const teamName = ref<string | null>(null)
const searchQuery = ref('')
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const filteredChannels = computed(() => {
  if (!searchQuery.value) return channels.value
  const query = searchQuery.value.toLowerCase()
  return channels.value.filter(c =>
    c.name.toLowerCase().includes(query)
  )
})

// Load channels on mount
onMounted(async () => {
  try {
    // First, try to get team info
    try {
      const selection = await $fetch<{ teamName: string | null }>(
        `${apiBase}/projects/${projectId}/slack/channel`,
        { credentials: 'include' }
      )
      teamName.value = selection.teamName
    } catch {
      // Ignore - team info is optional
    }

    // Load channels
    const response = await $fetch<SlackChannel[]>(
      `${apiBase}/projects/${projectId}/slack/channels`,
      { credentials: 'include' }
    )
    channels.value = response
  } catch (e: any) {
    error.value = e.data?.message || 'Unable to load channels. Make sure Slack is connected.'
  } finally {
    loading.value = false
  }
})

const selectChannel = async (channel: SlackChannel) => {
  if (saving.value) return

  try {
    saving.value = true
    selectedChannel.value = channel
    error.value = ''

    // Save channel selection (auto-joins the channel)
    await $fetch(`${apiBase}/projects/${projectId}/slack/channel`, {
      method: 'POST',
      credentials: 'include',
      body: {
        channelId: channel.id,
        channelName: channel.name
      }
    })

    // Notify parent window and close
    if (window.opener) {
      window.opener.postMessage({
        type: 'SLACK_CHANNEL_SUCCESS',
        channelId: channel.id,
        channelName: channel.name
      }, window.location.origin)
    }

    window.close()
  } catch (e: any) {
    error.value = e.data?.message || 'Error saving channel selection.'
    saving.value = false
    selectedChannel.value = null
  }
}

const skip = () => {
  if (window.opener) {
    window.opener.postMessage({
      type: 'SLACK_CHANNEL_SUCCESS'
    }, window.location.origin)
  }
  window.close()
}
</script>
