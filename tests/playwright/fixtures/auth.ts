import { test as base, expect, Page } from '@playwright/test';

/**
 * Authentication fixture that provides authenticated page context
 */
export const test = base.extend<{
  authenticatedPage: Page;
  testUser: {
    email: string;
    password: string;
    name: string;
  };
}>({
  testUser: async ({}, use) => {
    // Test user credentials - should match your test database
    const user = {
      email: process.env.TEST_USER_EMAIL || 'test@devflow.local',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
      name: 'Test User',
    };
    await use(user);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in credentials
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify we're logged in by checking for user info or dashboard elements
    await expect(page.locator('text=/dashboard|projects/i')).toBeVisible({
      timeout: 5000,
    });

    // Provide the authenticated page to the test
    await use(page);

    // Cleanup: logout after test
    try {
      await page.goto('/logout', { timeout: 5000 });
    } catch (error) {
      // Ignore errors during cleanup
      console.log('Cleanup error (ignored):', error);
    }
  },
});

export { expect };
