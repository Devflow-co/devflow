<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <AppNavbar />

    <main class="max-w-4xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Organization Settings</h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          Manage your organization's profile and team members
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !organization" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error && !organization" class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6">
        <p class="text-red-600 dark:text-red-400">{{ error }}</p>
        <button
          @click="loadData"
          class="mt-2 text-sm text-red-700 dark:text-red-300 underline"
        >
          Try again
        </button>
      </div>

      <template v-else-if="organization">
        <!-- Logo Section -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organization Logo</h2>
          <SettingsAvatarUpload
            v-if="canManageMembers"
            ref="logoUploadRef"
            :model-value="organization.logo"
            :initial="organization.name.charAt(0)"
            :is-logo="true"
            :max-size-bytes="10 * 1024 * 1024"
            @upload="handleLogoUpload"
            @remove="handleLogoRemove"
          />
          <div v-else class="flex items-center gap-4">
            <div class="w-24 h-24 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
              <img
                v-if="organization.logo"
                :src="organization.logo"
                alt="Organization logo"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-3xl font-bold text-gray-400 dark:text-gray-500">
                {{ organization.name.charAt(0) }}
              </span>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Contact an admin to change the organization logo
            </p>
          </div>
        </section>

        <!-- Organization Information -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Organization Information
          </h2>

          <form @submit.prevent="handleOrgUpdate" class="space-y-4">
            <!-- Name -->
            <div>
              <label
                for="org-name"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Organization Name
              </label>
              <input
                id="org-name"
                v-model="orgForm.name"
                type="text"
                :disabled="!canManageMembers"
                class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:dark:bg-gray-600 disabled:cursor-not-allowed"
              />
            </div>

            <!-- Slug (read-only) -->
            <div>
              <label
                for="org-slug"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                URL Slug
              </label>
              <input
                id="org-slug"
                :value="organization.slug"
                type="text"
                disabled
                class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>

            <!-- Billing Email -->
            <div>
              <label
                for="billing-email"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Billing Email
              </label>
              <input
                id="billing-email"
                v-model="orgForm.billingEmail"
                type="email"
                :disabled="!canManageMembers"
                placeholder="billing@company.com"
                class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:dark:bg-gray-600 disabled:cursor-not-allowed"
              />
            </div>

            <!-- Save Button -->
            <div v-if="canManageMembers" class="pt-2">
              <button
                type="submit"
                :disabled="loading || !hasOrgChanges"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ loading ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </section>

        <!-- Team Members -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
            <button
              v-if="canManageMembers"
              @click="showInviteModal = true"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Invite Member
            </button>
          </div>

          <SettingsMembersTable
            :members="members"
            :current-user-id="currentUserId"
            :can-manage="canManageMembers"
            @update-role="handleRoleUpdate"
            @remove="handleRemoveMember"
          />
        </section>

        <!-- Danger Zone (Owner only) -->
        <section v-if="canDeleteOrg" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-red-200 dark:border-red-800">
          <h2 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Once you delete an organization, there is no going back. Please be certain.
          </p>
          <button
            @click="confirmDeleteOrg"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Delete Organization
          </button>
        </section>
      </template>

      <!-- Invite Modal -->
      <SettingsInviteMemberModal
        ref="inviteModalRef"
        :is-open="showInviteModal"
        @close="showInviteModal = false"
        @invite="handleInviteMember"
      />

      <!-- Delete Confirmation Modal -->
      <Teleport to="body">
        <div
          v-if="showDeleteConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="showDeleteConfirm = false"
        >
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
              Delete Organization
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete <strong>{{ organization?.name }}</strong>? This action cannot be undone and will remove all projects, data, and team members.
            </p>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type "{{ organization?.name }}" to confirm
              </label>
              <input
                v-model="deleteConfirmText"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div class="flex justify-end gap-3">
              <button
                @click="showDeleteConfirm = false"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleDeleteOrg"
                :disabled="deleteConfirmText !== organization?.name"
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Organization
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/auth'
import { storeToRefs } from 'pinia'

definePageMeta({
  middleware: 'auth',
})

const settingsStore = useSettingsStore()
const { user } = useAuth()

const { organization, members, loading, error, canManageMembers, canDeleteOrg } =
  storeToRefs(settingsStore)
const {
  fetchOrganization,
  fetchMembers,
  updateOrganization,
  uploadLogo,
  removeLogo,
  inviteMember,
  updateMemberRole,
  removeMember,
} = settingsStore

const currentUserId = computed(() => user.value?.id)

const logoUploadRef = ref<{ clear: () => void; setUploading: (v: boolean) => void } | null>(null)
const inviteModalRef = ref<{ setError: (msg: string) => void; setLoading: (v: boolean) => void } | null>(null)

const showInviteModal = ref(false)
const showDeleteConfirm = ref(false)
const deleteConfirmText = ref('')

const orgForm = ref({
  name: '',
  billingEmail: '',
})

const hasOrgChanges = computed(() => {
  if (!organization.value) return false
  return (
    orgForm.value.name !== organization.value.name ||
    orgForm.value.billingEmail !== (organization.value.billingEmail || '')
  )
})

const loadData = async () => {
  await fetchOrganization()
  await fetchMembers()
}

onMounted(async () => {
  await loadData()
})

// Sync form when organization is loaded
watch(
  organization,
  (org) => {
    if (org) {
      orgForm.value.name = org.name
      orgForm.value.billingEmail = org.billingEmail || ''
    }
  },
  { immediate: true },
)

const handleOrgUpdate = async () => {
  try {
    await updateOrganization({
      name: orgForm.value.name,
      billingEmail: orgForm.value.billingEmail || undefined,
    })
  } catch (e) {
    console.error('Failed to update organization:', e)
  }
}

const handleLogoUpload = async (file: File) => {
  try {
    await uploadLogo(file)
    logoUploadRef.value?.clear()
  } catch (e) {
    console.error('Failed to upload logo:', e)
  } finally {
    logoUploadRef.value?.setUploading(false)
  }
}

const handleLogoRemove = async () => {
  try {
    await removeLogo()
  } catch (e) {
    console.error('Failed to remove logo:', e)
  }
}

const handleInviteMember = async (email: string, role: string) => {
  inviteModalRef.value?.setLoading(true)
  try {
    await inviteMember({ email, role: role as 'ADMIN' | 'MAINTAINER' | 'VIEWER' })
    showInviteModal.value = false
  } catch (e) {
    inviteModalRef.value?.setError(e instanceof Error ? e.message : 'Failed to invite member')
  }
}

const handleRoleUpdate = async (memberId: string, role: string) => {
  try {
    await updateMemberRole(memberId, role)
  } catch (e) {
    console.error('Failed to update member role:', e)
  }
}

const handleRemoveMember = async (memberId: string) => {
  try {
    await removeMember(memberId)
  } catch (e) {
    console.error('Failed to remove member:', e)
  }
}

const confirmDeleteOrg = () => {
  deleteConfirmText.value = ''
  showDeleteConfirm.value = true
}

const handleDeleteOrg = async () => {
  // TODO: Implement organization deletion
  console.log('Delete organization')
  showDeleteConfirm.value = false
}
</script>
