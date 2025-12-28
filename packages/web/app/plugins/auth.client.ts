/**
 * Auth plugin - initializes auth state on client
 */
export default defineNuxtPlugin(async () => {
  const { fetchUser } = useAuth()

  // Try to fetch current user on app load
  await fetchUser()
})
