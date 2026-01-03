import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and local storage before each test
    await page.context().clearCookies();
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');

    // Check for login form elements
    await expect(page.locator('h1, h2').filter({ hasText: /login|sign in/i })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Try to submit with empty fields
    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('text=/email.*required|required.*email/i')).toBeVisible({ timeout: 5000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    const testEmail = process.env.TEST_USER_EMAIL || 'test@devflow.local';
    const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

    // Fill in credentials
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify we're on the dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display signup page correctly', async ({ page }) => {
    await page.goto('/signup');

    // Check for signup form elements
    await expect(page.locator('h1, h2').filter({ hasText: /sign up|register/i })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="name"], input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should navigate between login and signup pages', async ({ page }) => {
    await page.goto('/login');

    // Find and click link to signup
    const signupLink = page.locator('a[href*="/signup"], button').filter({ hasText: /sign up|register/i });
    await signupLink.click();

    // Should be on signup page
    await expect(page).toHaveURL(/\/signup/);

    // Navigate back to login
    const loginLink = page.locator('a[href*="/login"], button').filter({ hasText: /login|sign in/i });
    await loginLink.click();

    // Should be back on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout successfully', async ({ page }) => {
    await page.goto('/login');

    const testEmail = process.env.TEST_USER_EMAIL || 'test@devflow.local';
    const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

    // Login
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Find and click logout button (could be in navigation, dropdown, etc.)
    const logoutButton = page.locator('button, a').filter({ hasText: /logout|sign out/i });
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL('/login', { timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('should protect dashboard route when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('should remember user after page refresh', async ({ page }) => {
    await page.goto('/login');

    const testEmail = process.env.TEST_USER_EMAIL || 'test@devflow.local';
    const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

    // Login
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Refresh the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL('/dashboard');
  });
});
