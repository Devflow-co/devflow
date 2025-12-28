import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// TypeScript interfaces
interface Project {
  id: string
  name: string
  description?: string
  repository?: string
  workspacePath?: string
  config?: any
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    tasks: number
    workflows: number
  }
  integration?: ProjectIntegration
  oauthConnections?: OAuthConnection[]
}

interface ProjectIntegration {
  id: string
  projectId: string
  figmaFileKey?: string
  figmaNodeId?: string
  sentryProjectSlug?: string
  sentryOrgSlug?: string
  githubIssuesRepo?: string
}

interface OAuthConnection {
  id: string
  projectId: string
  provider: string
  scopes: string[]
  providerUserId?: string
  providerEmail?: string
  isActive: boolean
  refreshFailed: boolean
  failureReason?: string
  lastRefreshed?: string
  createdAt: string
  updatedAt: string
}

interface CreateProjectDto {
  name: string
  description?: string
  repository?: string
  workspacePath?: string
  config?: any
}

interface UpdateProjectDto {
  name?: string
  description?: string
  repository?: string
  workspacePath?: string
  config?: any
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

// LocalStorage key for selected project
const SELECTED_PROJECT_KEY = 'devflow_selected_project_id'

export const useProjectsStore = defineStore('projects', () => {
  // State
  const projects = ref<Project[]>([])
  const selectedProjectId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const selectedProject = computed(() => {
    if (!selectedProjectId.value) return undefined
    return projects.value.find((p) => p.id === selectedProjectId.value)
  })

  const hasProjects = computed(() => projects.value.length > 0)

  // API helper
  const apiFetch = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const apiBase = getApiBase()
    const url = `${apiBase}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Actions
  const fetchProjects = async () => {
    try {
      loading.value = true
      error.value = null
      projects.value = await apiFetch<Project[]>('/projects')
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch projects'
      throw e
    } finally {
      loading.value = false
    }
  }

  const selectProject = (projectId: string | null) => {
    selectedProjectId.value = projectId

    // Persist to localStorage (client-side only)
    if (import.meta.client) {
      if (projectId) {
        localStorage.setItem(SELECTED_PROJECT_KEY, projectId)
      } else {
        localStorage.removeItem(SELECTED_PROJECT_KEY)
      }
    }
  }

  const restoreSelectedProject = () => {
    // Restore from localStorage (client-side only)
    if (import.meta.client) {
      try {
        const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY)
        if (savedProjectId) {
          // Verify the project still exists in the list
          const projectExists = projects.value.some((p) => p.id === savedProjectId)
          if (projectExists) {
            selectedProjectId.value = savedProjectId
          } else {
            // Clean up invalid localStorage entry
            localStorage.removeItem(SELECTED_PROJECT_KEY)
          }
        }
      } catch (e) {
        console.warn('Failed to restore selected project:', e)
      }
    }
  }

  const createProject = async (dto: CreateProjectDto): Promise<Project> => {
    try {
      loading.value = true
      error.value = null

      const project = await apiFetch<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify(dto),
      })

      // Add to local list
      projects.value.push(project)

      // Auto-select new project
      selectProject(project.id)

      return project
    } catch (e: any) {
      error.value = e.message || 'Failed to create project'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateProject = async (id: string, dto: UpdateProjectDto): Promise<Project> => {
    try {
      loading.value = true
      error.value = null

      const updatedProject = await apiFetch<Project>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      })

      // Update in local list
      const index = projects.value.findIndex((p) => p.id === id)
      if (index !== -1) {
        projects.value[index] = updatedProject
      }

      return updatedProject
    } catch (e: any) {
      error.value = e.message || 'Failed to update project'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteProject = async (id: string): Promise<void> => {
    try {
      loading.value = true
      error.value = null

      await apiFetch(`/projects/${id}`, {
        method: 'DELETE',
      })

      // Remove from local list
      projects.value = projects.value.filter((p) => p.id !== id)

      // Deselect if it was selected
      if (selectedProjectId.value === id) {
        selectProject(null)
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete project'
      throw e
    } finally {
      loading.value = false
    }
  }

  const linkRepository = async (projectId: string, repositoryUrl: string): Promise<Project> => {
    try {
      loading.value = true
      error.value = null

      const updatedProject = await apiFetch<Project>(`/projects/${projectId}/link-repository`, {
        method: 'POST',
        body: JSON.stringify({ repositoryUrl }),
      })

      // Update in local list
      const index = projects.value.findIndex((p) => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = updatedProject
      }

      return updatedProject
    } catch (e: any) {
      error.value = e.message || 'Failed to link repository'
      throw e
    } finally {
      loading.value = false
    }
  }

  const getProjectStatistics = async (projectId: string): Promise<any> => {
    try {
      loading.value = true
      error.value = null

      return await apiFetch(`/projects/${projectId}/stats`)
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch project statistics'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    projects,
    selectedProjectId,
    loading,
    error,

    // Computed
    selectedProject,
    hasProjects,

    // Actions
    fetchProjects,
    selectProject,
    restoreSelectedProject,
    createProject,
    updateProject,
    deleteProject,
    linkRepository,
    getProjectStatistics,
  }
})
