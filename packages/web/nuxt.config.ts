// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Disable SSR to avoid Pinia hydration issues
  ssr: false,

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
  ],

  runtimeConfig: {
    public: {
      // NUXT_PUBLIC_API_BASE is auto-mapped by Nuxt from env
      apiBase: 'http://localhost:3001/api/v1',
    },
  },

  app: {
    head: {
      title: 'DevFlow',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Universal DevOps Orchestrator' },
      ],
    },
  },

  typescript: {
    strict: true,
  },
})
