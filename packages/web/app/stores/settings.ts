import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// TypeScript interfaces
interface UserProfile {
  id: string
  email: string
  name: string | null
  avatar: string | null
  emailVerified: boolean
  ssoProvider: string | null
  createdAt: string
  lastLoginAt: string | null
}

interface Organization {
  id: string
  slug: string
  name: string
  logo: string | null
  billingEmail: string | null
  userRole?: 'OWNER' | 'ADMIN' | 'MAINTAINER' | 'VIEWER'
  createdAt: string
  updatedAt: string
}

interface OrganizationMember {
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

interface UpdateProfileDto {
  name?: string
}

interface UpdateEmailDto {
  newEmail: string
  currentPassword: string
}

interface ChangePasswordDto {
  currentPassword: string
  newPassword: string
}

interface UpdateOrganizationDto {
  name?: string
  billingEmail?: string
}

interface InviteMemberDto {
  email: string
  role?: 'ADMIN' | 'MAINTAINER' | 'VIEWER'
}

// Cache the API base URL
let cachedApiBase: string | null = null

const getApiBase = (): string => {
  if (cachedApiBase) {
    return cachedApiBase
  }

  const defaultUrl = 'http://localhost:3001/api/v1'

  if (import.meta.client) {
    try {
      const config = useRuntimeConfig()
      cachedApiBase = String(config.public.apiBase || defaultUrl)
    } catch {
      cachedApiBase = defaultUrl
    }
  } else {
    cachedApiBase = defaultUrl
  }

  return cachedApiBase
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const userProfile = ref<UserProfile | null>(null)
  const organization = ref<Organization | null>(null)
  const members = ref<OrganizationMember[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const currentUserRole = computed(() => organization.value?.userRole || null)

  const canManageMembers = computed(() => {
    return currentUserRole.value === 'OWNER' || currentUserRole.value === 'ADMIN'
  })

  const canDeleteOrg = computed(() => {
    return currentUserRole.value === 'OWNER'
  })

  const isSSO = computed(() => !!userProfile.value?.ssoProvider)

  // API helper
  const apiFetch = async <T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> => {
    const response = await fetch(`${getApiBase()}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Request failed: ${response.status}`)
    }

    if (response.status === 204) {
      return null as T
    }

    return response.json()
  }

  // File upload helper
  const apiUpload = async <T>(
    endpoint: string,
    file: File,
  ): Promise<T> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${getApiBase()}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Upload failed: ${response.status}`)
    }

    return response.json()
  }

  // ============ User Profile Actions ============

  const fetchUserProfile = async () => {
    try {
      loading.value = true
      error.value = null
      userProfile.value = await apiFetch<UserProfile>('/user/settings/profile')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch profile'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateProfile = async (dto: UpdateProfileDto) => {
    try {
      loading.value = true
      error.value = null
      userProfile.value = await apiFetch<UserProfile>('/user/settings/profile', {
        method: 'PUT',
        body: JSON.stringify(dto),
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update profile'
      throw e
    } finally {
      loading.value = false
    }
  }

  const uploadAvatar = async (file: File) => {
    try {
      loading.value = true
      error.value = null
      const result = await apiUpload<{ avatar: string }>('/user/settings/avatar', file)
      if (userProfile.value) {
        userProfile.value.avatar = result.avatar
      }
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to upload avatar'
      throw e
    } finally {
      loading.value = false
    }
  }

  const removeAvatar = async () => {
    try {
      loading.value = true
      error.value = null
      await apiFetch<void>('/user/settings/avatar', { method: 'DELETE' })
      if (userProfile.value) {
        userProfile.value.avatar = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove avatar'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateEmail = async (dto: UpdateEmailDto) => {
    try {
      loading.value = true
      error.value = null
      userProfile.value = await apiFetch<UserProfile>('/user/settings/email', {
        method: 'PUT',
        body: JSON.stringify(dto),
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update email'
      throw e
    } finally {
      loading.value = false
    }
  }

  const changePassword = async (dto: ChangePasswordDto) => {
    try {
      loading.value = true
      error.value = null
      await apiFetch<{ message: string }>('/user/settings/password', {
        method: 'PUT',
        body: JSON.stringify(dto),
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to change password'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ============ Organization Actions ============

  const fetchOrganization = async () => {
    try {
      loading.value = true
      error.value = null
      organization.value = await apiFetch<Organization>('/organizations/current')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch organization'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateOrganization = async (dto: UpdateOrganizationDto) => {
    if (!organization.value) return

    try {
      loading.value = true
      error.value = null
      const updated = await apiFetch<Organization>(
        `/organizations/${organization.value.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(dto),
        },
      )
      organization.value = { ...organization.value, ...updated }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update organization'
      throw e
    } finally {
      loading.value = false
    }
  }

  const uploadLogo = async (file: File) => {
    if (!organization.value) return

    try {
      loading.value = true
      error.value = null
      const result = await apiUpload<{ logo: string }>(
        `/organizations/${organization.value.id}/logo`,
        file,
      )
      organization.value.logo = result.logo
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to upload logo'
      throw e
    } finally {
      loading.value = false
    }
  }

  const removeLogo = async () => {
    if (!organization.value) return

    try {
      loading.value = true
      error.value = null
      await apiFetch<void>(`/organizations/${organization.value.id}/logo`, {
        method: 'DELETE',
      })
      organization.value.logo = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove logo'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ============ Members Actions ============

  const fetchMembers = async () => {
    if (!organization.value) return

    try {
      loading.value = true
      error.value = null
      members.value = await apiFetch<OrganizationMember[]>(
        `/organizations/${organization.value.id}/members`,
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch members'
      throw e
    } finally {
      loading.value = false
    }
  }

  const inviteMember = async (dto: InviteMemberDto) => {
    if (!organization.value) return

    try {
      loading.value = true
      error.value = null
      const member = await apiFetch<OrganizationMember>(
        `/organizations/${organization.value.id}/members`,
        {
          method: 'POST',
          body: JSON.stringify(dto),
        },
      )
      members.value.push(member)
      return member
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to invite member'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateMemberRole = async (memberId: string, role: string) => {
    if (!organization.value) return

    try {
      loading.value = true
      error.value = null
      const updated = await apiFetch<OrganizationMember>(
        `/organizations/${organization.value.id}/members/${memberId}/role`,
        {
          method: 'PUT',
          body: JSON.stringify({ role }),
        },
      )
      const index = members.value.findIndex((m) => m.id === memberId)
      if (index !== -1) {
        members.value[index] = updated
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update member role'
      throw e
    } finally {
      loading.value = false
    }
  }

  const removeMember = async (memberId: string) => {
    if (!organization.value) return

    try {
      loading.value = true
      error.value = null
      await apiFetch<void>(
        `/organizations/${organization.value.id}/members/${memberId}`,
        { method: 'DELETE' },
      )
      members.value = members.value.filter((m) => m.id !== memberId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove member'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ============ Reset ============

  const reset = () => {
    userProfile.value = null
    organization.value = null
    members.value = []
    loading.value = false
    error.value = null
  }

  return {
    // State
    userProfile,
    organization,
    members,
    loading,
    error,
    // Computed
    currentUserRole,
    canManageMembers,
    canDeleteOrg,
    isSSO,
    // User Profile Actions
    fetchUserProfile,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    updateEmail,
    changePassword,
    // Organization Actions
    fetchOrganization,
    updateOrganization,
    uploadLogo,
    removeLogo,
    // Members Actions
    fetchMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    // Utilities
    reset,
  }
})
