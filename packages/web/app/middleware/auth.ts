/**
 * Authentication middleware
 * Protects routes that require authentication
 */
export default defineNuxtRouteMiddleware((to) => {
  // Skip auth check on server side - will be handled on client
  if (import.meta.server) {
    return
  }

  const authStore = useAuthStore()

  // Wait for auth to load on client
  if (authStore.isLoading) {
    return
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup', '/forgot-password']
  const isPublicRoute = publicRoutes.includes(to.path) ||
    to.path.startsWith('/reset-password') ||
    to.path.startsWith('/verify-email')

  // Redirect to login if not authenticated and trying to access protected route
  if (!authStore.isAuthenticated && !isPublicRoute) {
    return navigateTo('/login')
  }

  // Redirect to dashboard if authenticated and trying to access auth pages
  if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/signup')) {
    return navigateTo('/dashboard')
  }
})
