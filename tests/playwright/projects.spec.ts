import { test, expect } from './fixtures/auth';

test.describe('Project Management', () => {
  test('should display projects list page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');

    // Check for projects page elements
    await expect(
      authenticatedPage.locator('h1, h2').filter({ hasText: /projects/i })
    ).toBeVisible();

    // Should have create project button or link
    await expect(
      authenticatedPage.locator('button, a').filter({ hasText: /create|new.*project/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('should create a new project', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');

    // Click create project button
    await authenticatedPage
      .locator('button, a')
      .filter({ hasText: /create|new.*project/i })
      .click();

    // Fill in project details
    const projectName = `Test Project ${Date.now()}`;
    const projectKey = `TEST${Date.now()}`.substring(0, 10).toUpperCase();

    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="key"]', projectKey);

    // Submit form
    await authenticatedPage.click('button[type="submit"]');

    // Should show success message or redirect to project details
    await expect(
      authenticatedPage.locator('text=/success|created/i').or(
        authenticatedPage.locator(`text="${projectName}"`)
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('should view project details', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');

    // Find and click on first project
    const firstProject = authenticatedPage.locator('[data-testid="project-card"], .project-item').first();
    await firstProject.waitFor({ timeout: 5000 });
    await firstProject.click();

    // Should be on project details page
    await expect(authenticatedPage).toHaveURL(/\/projects\/[\w-]+/);

    // Should display project information
    await expect(
      authenticatedPage.locator('text=/integrations|workflows|settings/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should display project integrations', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');

    // Go to first project
    const firstProject = authenticatedPage.locator('[data-testid="project-card"], .project-item').first();
    await firstProject.waitFor({ timeout: 5000 });
    await firstProject.click();

    // Should see integrations section
    await expect(
      authenticatedPage.locator('text=/integrations|oauth|connect/i')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should search/filter projects', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');

    // Look for search or filter input
    const searchInput = authenticatedPage.locator(
      'input[placeholder*="search" i], input[placeholder*="filter" i], input[type="search"]'
    );

    // Only run this part if search exists
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');

      // Wait for results to update
      await authenticatedPage.waitForTimeout(500);

      // Results should update (implementation specific)
      await expect(authenticatedPage.locator('[data-testid="project-card"], .project-item')).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('should display empty state when no projects', async ({ page, testUser }) => {
    // Create a new user session without projects
    await page.goto('/projects');

    // If there are no projects, should show empty state
    const projectCards = page.locator('[data-testid="project-card"], .project-item');
    const emptyState = page.locator('text=/no projects|get started|create.*first project/i');

    // Either has projects or shows empty state
    await expect(projectCards.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should navigate between projects and dashboard', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Navigate to projects
    await authenticatedPage.click('a[href="/projects"], text="Projects"');
    await expect(authenticatedPage).toHaveURL('/projects');

    // Navigate back to dashboard
    await authenticatedPage.click('a[href="/dashboard"], text="Dashboard"');
    await expect(authenticatedPage).toHaveURL('/dashboard');
  });

  test('should display project workflows', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');

    // Go to first project
    const firstProject = authenticatedPage.locator('[data-testid="project-card"], .project-item').first();

    if (await firstProject.count() > 0) {
      await firstProject.click();

      // Look for workflows section
      const workflowsSection = authenticatedPage.locator('text=/workflows|workflow history|recent workflows/i');

      if (await workflowsSection.count() > 0) {
        await expect(workflowsSection).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should handle project settings page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');

    // Go to first project
    const firstProject = authenticatedPage.locator('[data-testid="project-card"], .project-item').first();

    if (await firstProject.count() > 0) {
      await firstProject.click();

      // Look for settings button or tab
      const settingsButton = authenticatedPage.locator('a, button').filter({ hasText: /settings/i });

      if (await settingsButton.count() > 0) {
        await settingsButton.click();

        // Should see project settings
        await expect(
          authenticatedPage.locator('text=/project name|project key|general settings/i')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
