<template>
  <div class="py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Welcome back, {{ user?.name || user?.email }}!
          </p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Refresh Button -->
          <button
            @click="refreshAnalytics"
            :disabled="isLoading"
            class="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <svg
              :class="['w-4 h-4', isLoading && 'animate-spin']"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="flex gap-1 p-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        <button
          @click="activeTab = 'overview'"
          :class="[
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'overview'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          ]"
        >
          Vue d'ensemble
        </button>
        <button
          @click="activeTab = 'performance'"
          :class="[
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'performance'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          ]"
        >
          Performance
        </button>
      </div>

      <!-- Email Verification Alert -->
      <div
        v-if="!user?.emailVerified"
        class="mb-6 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
      >
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Please verify your email address</p>
            <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">Check your inbox for a verification link.</p>
          </div>
        </div>
      </div>

      <!-- Overview Tab Content -->
      <div v-show="activeTab === 'overview'">
      <!-- KPI Cards Row -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <!-- Projects -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Projects</span>
          </div>
          <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ projects.length }}</span>
        </div>

        <!-- Workflows -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Workflows</span>
          </div>
          <div class="flex items-baseline gap-1">
            <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ analytics?.summary?.totalWorkflows || totalWorkflows }}</span>
            <span v-if="activeWorkflows > 0" class="text-sm text-purple-600 dark:text-purple-400">({{ activeWorkflows }} actifs)</span>
          </div>
        </div>

        <!-- Success Rate -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-2">
            <div :class="['p-2 rounded-lg', successRateColor.bg]">
              <svg :class="['w-5 h-5', successRateColor.text]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</span>
          </div>
          <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ analytics?.summary?.successRate || 0 }}%</span>
        </div>

        <!-- Total Cost -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Coût API</span>
          </div>
          <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCost(analytics?.summary?.totalCost || 0) }}</span>
        </div>

        <!-- Tokens -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Tokens</span>
          </div>
          <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatTokens(analytics?.summary?.totalTokens || 0) }}</span>
        </div>

        <!-- Avg Duration -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Durée Moy.</span>
          </div>
          <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatDuration(analytics?.summary?.avgWorkflowDuration || 0) }}</span>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Cost Trend Chart -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Coûts API (90 jours)</h3>
          <div class="h-64">
            <CostTrendChart v-if="analytics?.costTrend?.length" :data="analytics.costTrend" />
            <div v-else class="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p class="text-sm">Aucune donnée de coût</p>
              <p class="text-xs mt-1">Les coûts apparaîtront après vos premiers workflows</p>
            </div>
          </div>
        </div>

        <!-- Model Distribution Chart -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage par Modèle AI</h3>
          <div class="h-64">
            <ModelDistributionChart v-if="analytics?.modelUsage?.length" :data="analytics.modelUsage" />
            <div v-else class="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <p class="text-sm">Aucun usage AI</p>
              <p class="text-xs mt-1">La répartition par modèle apparaîtra ici</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Workflow Analytics Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Phase Performance -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance par Phase</h3>
          <div class="h-56">
            <PhasePerformanceChart v-if="analytics?.workflows?.byPhase?.length" :data="analytics.workflows.byPhase" />
            <div v-else class="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              <p class="text-sm">Aucune donnée de phase</p>
              <p class="text-xs mt-1">Refinement, User Story, Technical Plan</p>
            </div>
          </div>
        </div>

        <!-- Quota & Failures -->
        <div class="space-y-6">
          <!-- Quota Indicator -->
          <div v-if="analytics?.quotas" class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quotas Organisation</h3>
            <div class="space-y-4">
              <!-- Token Quota -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Tokens</span>
                  <span :class="['text-sm font-medium', getQuotaColor(analytics.quotas.tokens.percent)]">
                    {{ formatTokens(analytics.quotas.tokens.used) }} / {{ formatTokens(analytics.quotas.tokens.limit) }}
                  </span>
                </div>
                <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', getQuotaBarColor(analytics.quotas.tokens.percent)]"
                    :style="{ width: `${Math.min(analytics.quotas.tokens.percent, 100)}%` }"
                  />
                </div>
              </div>
              <!-- Cost Quota -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Coût</span>
                  <span :class="['text-sm font-medium', getQuotaColor(analytics.quotas.cost.percent)]">
                    {{ formatCost(analytics.quotas.cost.used) }} / {{ formatCost(analytics.quotas.cost.limit) }}
                  </span>
                </div>
                <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', getQuotaBarColor(analytics.quotas.cost.percent)]"
                    :style="{ width: `${Math.min(analytics.quotas.cost.percent, 100)}%` }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Workflow Status -->
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Workflows</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ analytics?.workflows?.byStatus?.completed || 0 }}</p>
                <p class="text-xs text-green-600 dark:text-green-400">Complétés</p>
              </div>
              <div class="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ analytics?.workflows?.byStatus?.failed || 0 }}</p>
                <p class="text-xs text-red-600 dark:text-red-400">Échoués</p>
              </div>
              <div class="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ analytics?.workflows?.byStatus?.running || 0 }}</p>
                <p class="text-xs text-blue-600 dark:text-blue-400">En cours</p>
              </div>
              <div class="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">{{ analytics?.workflows?.byStatus?.pending || 0 }}</p>
                <p class="text-xs text-gray-600 dark:text-gray-400">En attente</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NuxtLink
          to="/projects"
          class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all group"
        >
          <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Projects</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Gérer vos projets</p>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/workflows"
          class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all group"
        >
          <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Workflows</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Voir les workflows</p>
          </div>
        </NuxtLink>

        <NuxtLink
          :to="selectedProject ? `/projects/${selectedProject.id}` : '/projects'"
          class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all group"
        >
          <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Integrations</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">OAuth & connexions</p>
          </div>
        </NuxtLink>
      </div>
      </div>
      <!-- End Overview Tab Content -->

      <!-- Performance Tab Content -->
      <div v-show="activeTab === 'performance'">
        <PerformanceSection />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '@/composables/auth'
import { useProjectsStore } from '@/stores/projects'
import { useAnalyticsStore, type OrganizationAnalytics } from '@/stores/analytics'
import { storeToRefs } from 'pinia'
import CostTrendChart from '@/components/analytics/charts/CostTrendChart.vue'
import ModelDistributionChart from '@/components/analytics/charts/ModelDistributionChart.vue'
import PhasePerformanceChart from '@/components/analytics/charts/PhasePerformanceChart.vue'
import PerformanceSection from '@/components/analytics/PerformanceSection.vue'

definePageMeta({
  middleware: 'auth',
})

const { user } = useAuth()
const projectsStore = useProjectsStore()
const analyticsStore = useAnalyticsStore()

const { projects, selectedProject } = storeToRefs(projectsStore)
const { loading: analyticsLoading, performanceLoading } = storeToRefs(analyticsStore)

const analytics = ref<OrganizationAnalytics | null>(null)
const activeTab = ref<'overview' | 'performance'>('overview')

const isLoading = computed(() =>
  activeTab.value === 'overview' ? analyticsLoading.value : performanceLoading.value
)

onMounted(async () => {
  try {
    await projectsStore.fetchProjects()
    projectsStore.restoreSelectedProject()
  } catch (e) {
    console.error('Failed to fetch projects:', e)
  }

  // Fetch analytics
  try {
    analytics.value = await analyticsStore.fetchOrganizationAnalytics()
  } catch (e) {
    console.error('Failed to fetch analytics:', e)
  }
})

async function refreshAnalytics() {
  try {
    if (activeTab.value === 'overview') {
      analytics.value = await analyticsStore.fetchOrganizationAnalytics()
    } else {
      await analyticsStore.fetchPerformanceAnalytics()
    }
  } catch (e) {
    console.error('Failed to refresh analytics:', e)
  }
}

// Computed from projects (fallback)
const totalWorkflows = computed(() => {
  let total = 0
  projects.value.forEach((project) => {
    if (project._count) total += project._count.workflows
  })
  return total
})

const activeWorkflows = computed(() => {
  let total = 0
  projects.value.forEach((project) => {
    if (project._count?.activeWorkflows !== undefined) {
      total += project._count.activeWorkflows
    }
  })
  return total
})

const successRateColor = computed(() => {
  const rate = analytics.value?.summary?.successRate || 0
  if (rate >= 80) return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' }
  if (rate >= 50) return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' }
  return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' }
})

// Formatters
function formatCost(value: number): string {
  if (value === 0) return '$0'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}

function formatDuration(ms: number): string {
  if (ms === 0) return '0s'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

function getQuotaColor(percent: number): string {
  if (percent >= 90) return 'text-red-600 dark:text-red-400'
  if (percent >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

function getQuotaBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-yellow-500'
  return 'bg-green-500'
}
</script>
