import { defineConfig, devices } from '@playwright/test';

/**
 * DevFlow Playwright E2E Test Configuration
 *
 * Tests the full application stack:
 * - Frontend: Nuxt 3 (port 3001)
 * - API: NestJS (port 3000)
 * - Database: PostgreSQL
 * - Cache: Redis
 * - Orchestration: Temporal
 */
export default defineConfig({
  testDir: './tests/playwright',

  // Maximum time one test can run for
  timeout: 60 * 1000,

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // API base URL for API testing
    extraHTTPHeaders: {
      // Default headers
    },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment to test in Firefox
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // Uncomment to test in WebKit (Safari)
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Uncomment for mobile testing
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run your local dev server before starting the tests
  // Uncomment this if you want Playwright to start the servers
  webServer: [
    {
      command: 'pnpm --filter @devflow/web dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=3000 pnpm --filter @devflow/api dev',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
