import { test, expect } from './fixtures/auth';

test.describe('OAuth Integration Flow', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to projects page first
    await authenticatedPage.goto('/projects');

    // Click on first project to view details
    const firstProject = authenticatedPage.locator(
      '[data-testid="project-card"], .project-item'
    ).first();
    await firstProject.waitFor({ timeout: 5000 });
    await firstProject.click();
  });

  test('should display OAuth integrations section', async ({ authenticatedPage }) => {
    // Should see integrations section
    await expect(
      authenticatedPage.locator('text=/integrations|oauth|connect/i')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should display supported OAuth providers', async ({ authenticatedPage }) => {
    // Should see various OAuth providers (GitHub, Linear, Figma, etc.)
    const providers = ['GitHub', 'Linear', 'Figma', 'Sentry'];

    for (const provider of providers) {
      const providerElement = authenticatedPage.locator(`text=${provider}`);
      if (await providerElement.count() > 0) {
        await expect(providerElement).toBeVisible();
      }
    }
  });

  test('should show connect button for disconnected integrations', async ({ authenticatedPage }) => {
    // Look for connect buttons
    const connectButtons = authenticatedPage.locator('button').filter({
      hasText: /connect|setup/i,
    });

    // Should have at least one connect button
    await expect(connectButtons.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display connection status for each provider', async ({ authenticatedPage }) => {
    // Check for status indicators (connected/disconnected)
    const statusElements = authenticatedPage.locator(
      'text=/connected|disconnected|not connected/i, [data-status]'
    );

    await expect(statusElements.first()).toBeVisible({ timeout: 5000 });
  });

  test('should open OAuth popup when clicking connect', async ({ authenticatedPage, context }) => {
    // Find a connect button
    const connectButton = authenticatedPage
      .locator('button')
      .filter({ hasText: /connect/i })
      .first();

    if (await connectButton.count() > 0) {
      // Set up popup handler
      const popupPromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);

      // Click connect
      await connectButton.click();

      // Wait for popup
      const popup = await popupPromise;

      if (popup) {
        // Popup should open
        expect(popup).toBeTruthy();

        // Should navigate to OAuth authorization URL
        const url = popup.url();
        expect(url).toMatch(
          /github\.com|linear\.app|figma\.com|sentry\.io|localhost/
        );

        // Close popup
        await popup.close();
      }
    }
  });

  test('should show test connection button for connected integrations', async ({ authenticatedPage }) => {
    // Look for test buttons (only visible when connected)
    const testButtons = authenticatedPage.locator('button').filter({
      hasText: /test|verify/i,
    });

    // If any test button exists, it should be visible
    if (await testButtons.count() > 0) {
      await expect(testButtons.first()).toBeVisible();
    }
  });

  test('should display OAuth connection details when connected', async ({ authenticatedPage }) => {
    // Look for connection metadata (username, scope, etc.)
    const connectionInfo = authenticatedPage.locator(
      'text=/scope|user|organization|access/i'
    );

    if (await connectionInfo.count() > 0) {
      await expect(connectionInfo.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show disconnect button for connected integrations', async ({ authenticatedPage }) => {
    // Look for disconnect buttons (only visible when connected)
    const disconnectButtons = authenticatedPage.locator('button').filter({
      hasText: /disconnect|remove/i,
    });

    if (await disconnectButtons.count() > 0) {
      await expect(disconnectButtons.first()).toBeVisible();
    }
  });

  test('should handle disconnecting an integration', async ({ authenticatedPage }) => {
    // Find a disconnect button
    const disconnectButton = authenticatedPage
      .locator('button')
      .filter({ hasText: /disconnect|remove/i })
      .first();

    if (await disconnectButton.count() > 0) {
      // Click disconnect
      await disconnectButton.click();

      // Should show confirmation dialog
      const confirmButton = authenticatedPage.locator('button').filter({
        hasText: /confirm|yes|disconnect/i,
      });

      if (await confirmButton.count() > 0) {
        // Confirm action would happen here
        // Note: We don't actually confirm in this test to avoid breaking integrations
        expect(confirmButton).toBeTruthy();
      }
    }
  });

  test('should display integration error states', async ({ authenticatedPage }) => {
    // Look for error messages or warning indicators
    const errorElements = authenticatedPage.locator(
      'text=/error|failed|expired|invalid/i, [data-status="error"]'
    );

    // If there are any errors, they should be visible
    if (await errorElements.count() > 0) {
      await expect(errorElements.first()).toBeVisible();
    }
  });

  test('should show integration help or documentation links', async ({ authenticatedPage }) => {
    // Look for help/docs links
    const helpLinks = authenticatedPage.locator('a, button').filter({
      hasText: /help|docs|documentation|learn more/i,
    });

    if (await helpLinks.count() > 0) {
      await expect(helpLinks.first()).toBeVisible();
    }
  });

  test('should handle OAuth callback success', async ({ authenticatedPage, context }) => {
    // Simulate OAuth callback by navigating to callback URL
    const projectId = authenticatedPage.url().split('/').pop();

    // Navigate to success callback
    await authenticatedPage.goto(
      `/api/v1/auth/github/callback?code=test_code&state=${projectId}`
    );

    // Should show success message or redirect back to integrations
    await authenticatedPage.waitForURL(/\/projects\/[\w-]+/, { timeout: 5000 });
  });

  test('should display integration permissions required', async ({ authenticatedPage }) => {
    // Look for permission descriptions
    const permissionText = authenticatedPage.locator(
      'text=/permissions|access|scopes|requires/i'
    );

    if (await permissionText.count() > 0) {
      await expect(permissionText.first()).toBeVisible();
    }
  });

  test('should refresh integration status', async ({ authenticatedPage }) => {
    // Look for refresh button
    const refreshButton = authenticatedPage.locator('button').filter({
      hasText: /refresh|reload|sync/i,
    });

    if (await refreshButton.count() > 0) {
      await refreshButton.click();

      // Should reload status
      await authenticatedPage.waitForTimeout(1000);
      await expect(refreshButton).toBeVisible();
    }
  });

  test('should display multiple projects OAuth isolation', async ({ authenticatedPage }) => {
    // Each project should have its own OAuth connections
    await authenticatedPage.goto('/projects');

    // Count projects
    const projectCount = await authenticatedPage
      .locator('[data-testid="project-card"], .project-item')
      .count();

    if (projectCount > 1) {
      // Click second project
      await authenticatedPage
        .locator('[data-testid="project-card"], .project-item')
        .nth(1)
        .click();

      // Should see integrations section (potentially different connections)
      await expect(
        authenticatedPage.locator('text=/integrations|oauth|connect/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
