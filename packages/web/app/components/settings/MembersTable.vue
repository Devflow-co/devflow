<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-700">
          <th
            class="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            Member
          </th>
          <th
            class="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            Role
          </th>
          <th
            class="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            Joined
          </th>
          <th
            v-if="canManage"
            class="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="member in members"
          :key="member.id"
          class="border-b border-gray-100 dark:border-gray-700/50"
        >
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden"
              >
                <img
                  v-if="member.user.avatar"
                  :src="member.user.avatar"
                  class="w-full h-full object-cover"
                />
                <span
                  v-else
                  class="text-sm font-medium text-gray-600 dark:text-gray-400"
                >
                  {{ getMemberInitial(member) }}
                </span>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ member.user.name || member.user.email }}
                  <span
                    v-if="member.userId === currentUserId"
                    class="text-xs text-gray-500"
                  >
                    (you)
                  </span>
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ member.user.email }}
                </p>
              </div>
            </div>
          </td>
          <td class="py-3 px-4">
            <select
              v-if="canManage && member.userId !== currentUserId && member.role !== 'OWNER'"
              :value="member.role"
              @change="handleRoleChange(member.id, ($event.target as HTMLSelectElement).value)"
              class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ADMIN">Admin</option>
              <option value="MAINTAINER">Maintainer</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <span v-else :class="getRoleClass(member.role)">
              {{ formatRole(member.role) }}
            </span>
          </td>
          <td class="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
            {{ formatDate(member.joinedAt) }}
          </td>
          <td v-if="canManage" class="py-3 px-4 text-right">
            <button
              v-if="member.userId !== currentUserId && member.role !== 'OWNER'"
              @click="confirmRemove(member)"
              class="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Remove
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Empty state -->
    <div v-if="members.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400">
      No members found
    </div>

    <!-- Remove Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="memberToRemove"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="memberToRemove = null"
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Remove Member
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to remove
            <strong>{{ memberToRemove.user.name || memberToRemove.user.email }}</strong>
            from the organization?
          </p>
          <div class="flex justify-end gap-3">
            <button
              @click="memberToRemove = null"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleRemove"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Member {
  id: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MAINTAINER' | 'VIEWER'
  joinedAt: string
  user: {
    id: string
    email: string
    name: string | null
    avatar: string | null
  }
}

interface Props {
  members: Member[]
  currentUserId?: string
  canManage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canManage: false,
})

const emit = defineEmits<{
  'update-role': [memberId: string, role: string]
  remove: [memberId: string]
}>()

const memberToRemove = ref<Member | null>(null)

const getMemberInitial = (member: Member) => {
  if (member.user.name) {
    return member.user.name.charAt(0).toUpperCase()
  }
  return member.user.email.charAt(0).toUpperCase()
}

const formatRole = (role: string) => {
  const roles: Record<string, string> = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MAINTAINER: 'Maintainer',
    VIEWER: 'Viewer',
  }
  return roles[role] || role
}

const getRoleClass = (role: string) => {
  const classes: Record<string, string> = {
    OWNER: 'px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    ADMIN: 'px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    MAINTAINER: 'px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    VIEWER: 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  }
  return classes[role] || classes.VIEWER
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const handleRoleChange = (memberId: string, role: string) => {
  emit('update-role', memberId, role)
}

const confirmRemove = (member: Member) => {
  memberToRemove.value = member
}

const handleRemove = () => {
  if (memberToRemove.value) {
    emit('remove', memberToRemove.value.id)
    memberToRemove.value = null
  }
}
</script>
