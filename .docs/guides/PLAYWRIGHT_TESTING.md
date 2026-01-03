# Playwright E2E Testing Guide

**Version:** 1.0.0 | **Updated:** December 28, 2025

## Overview

DevFlow uses Playwright for end-to-end testing of the web interface. This guide covers setup, running tests, and writing new tests.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Fixtures and Helpers](#fixtures-and-helpers)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Install Playwright

```bash
pnpm playwright:install
```

### 2. Set Up Test Environment

```bash
cp tests/playwright/.env.example tests/playwright/.env
# Edit .env with your test credentials
```

### 3. Start Services

```bash
# Start infrastructure
docker-compose -f docker-compose.infra.yml up -d

# Start API and web (or let Playwright start them)
pnpm dev:all
```

### 4. Run Tests

```bash
# Run all tests (headless)
pnpm test:playwright

# Run with UI mode (recommended)
pnpm test:playwright:ui
```

## Test Structure

```
tests/playwright/
├── auth.spec.ts                    # Authentication flow tests
├── projects.spec.ts                # Project management tests
├── oauth-integrations.spec.ts      # OAuth integration tests
├── fixtures/
│   └── auth.ts                     # Authentication fixture
├── helpers/
│   └── api.ts                      # API helper functions
├── .env.example                    # Example environment variables
├── .gitignore                      # Ignore test results
└── README.md                       # Playwright-specific documentation
```

### Test Files

- **`auth.spec.ts`** - Login, signup, logout, session management
- **`projects.spec.ts`** - Create, view, manage projects
- **`oauth-integrations.spec.ts`** - Connect/disconnect OAuth providers

## Running Tests

### Run All Tests

```bash
pnpm test:playwright
```

### UI Mode (Development)

```bash
pnpm test:playwright:ui
```

UI mode provides:
- Visual test runner
- Time travel debugging
- Watch mode
- Test filtering

### Headed Mode (See Browser)

```bash
pnpm test:playwright:headed
```

### Debug Specific Test

```bash
pnpm test:playwright:debug tests/playwright/auth.spec.ts
```

### Run Specific Test File

```bash
pnpm test:playwright tests/playwright/projects.spec.ts
```

### Run Tests Matching Pattern

```bash
pnpm test:playwright -g "login"
```

### View Test Report

After running tests:

```bash
pnpm test:playwright:report
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/my-page');

    // Interact with page
    await page.click('button[data-testid="my-button"]');

    // Assert
    await expect(page.locator('h1')).toHaveText('Expected Text');
  });
});
```

### Using Authentication Fixture

For tests requiring authenticated users:

```typescript
import { test, expect } from './fixtures/auth';

test('should access protected page', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');

  // Page is already authenticated
  await expect(authenticatedPage).toHaveURL('/dashboard');
});
```

### Using API Helper

For setup and cleanup:

```typescript
import { test, expect } from '@playwright/test';
import { ApiHelper } from './helpers/api';

test('should create project', async ({ page, request }) => {
  const api = new ApiHelper(request);

  // Setup via API
  const project = await api.createProject({
    name: 'Test Project',
    key: 'TEST',
  });

  // Test in UI
  await page.goto(`/projects/${project.id}`);
  await expect(page.locator('h1')).toHaveText('Test Project');

  // Cleanup
  await api.deleteProject(project.id);
});
```

## Fixtures and Helpers

### Authentication Fixture

Located in `tests/playwright/fixtures/auth.ts`.

Provides:
- `authenticatedPage` - Pre-authenticated browser page
- `testUser` - Test user credentials

```typescript
import { test, expect } from './fixtures/auth';

test('my test', async ({ authenticatedPage, testUser }) => {
  // Use authenticatedPage for authenticated actions
  // Use testUser for credentials if needed
});
```

### API Helper

Located in `tests/playwright/helpers/api.ts`.

Methods:
- `createProject(data)` - Create project via API
- `deleteProject(projectId)` - Delete project
- `listProjects()` - List all projects
- `getProject(projectId)` - Get project details
- `checkHealth()` - Health check
- `getOAuthStatus(projectId, provider)` - OAuth status
- `startWorkflow(data)` - Start workflow
- `getWorkflowStatus(workflowId)` - Workflow status

```typescript
import { ApiHelper } from './helpers/api';

test('my test', async ({ request }) => {
  const api = new ApiHelper(request);
  const health = await api.checkHealth();
  expect(health.status).toBe('ok');
});
```

## Best Practices

### 1. Use Data Attributes for Selectors

```typescript
// Good
await page.click('[data-testid="create-button"]');

// Avoid
await page.click('.btn.btn-primary');
```

### 2. Wait for Explicit Conditions

```typescript
// Good
await page.waitForURL('/dashboard');
await expect(page.locator('[data-testid="card"]')).toBeVisible();

// Avoid
await page.waitForTimeout(5000);
```

### 3. Use Fixtures for Common Setup

```typescript
// Good - reusable fixture
import { test, expect } from './fixtures/auth';

test('my test', async ({ authenticatedPage }) => {
  // Already authenticated
});

// Avoid - duplicate login logic
test('my test', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  // ... manual login
});
```

### 4. Clean Up Test Data

```typescript
test.afterEach(async ({ request }) => {
  const api = new ApiHelper(request);
  await api.deleteProject(testProjectId);
});
```

### 5. Use Descriptive Test Names

```typescript
// Good
test('should display validation error when email is missing', async () => {});

// Avoid
test('test login', async () => {});
```

### 6. Handle Optional Elements

```typescript
// Check if element exists before interacting
if (await page.locator('[data-testid="optional"]').count() > 0) {
  await page.click('[data-testid="optional"]');
}
```

### 7. Test Multiple Browsers (When Needed)

```typescript
// In playwright.config.ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
]
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Playwright E2E Tests

on: [push, pull_request]

jobs:
  playwright:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: devflow
          POSTGRES_PASSWORD: changeme
          POSTGRES_DB: devflow
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm playwright:install

      - name: Build packages
        run: pnpm build

      - name: Setup database
        run: pnpm db:push
        env:
          DATABASE_URL: postgresql://devflow:changeme@localhost:5432/devflow

      - name: Run Playwright tests
        run: pnpm test:playwright
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          DATABASE_URL: postgresql://devflow:changeme@localhost:5432/devflow

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Troubleshooting

### Tests Timeout

**Problem:** Tests fail with timeout errors.

**Solutions:**
1. Increase timeout in `playwright.config.ts`:
   ```typescript
   timeout: 120 * 1000, // 2 minutes
   ```
2. Ensure services are running
3. Check network latency

### Page Not Found Errors

**Problem:** `404` errors when navigating.

**Solutions:**
1. Verify `PLAYWRIGHT_BASE_URL` in `.env`
2. Ensure frontend is running on correct port
3. Check API is accessible

### Authentication Tests Fail

**Problem:** Login tests fail or redirect incorrectly.

**Solutions:**
1. Verify test user exists in database
2. Check `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`
3. Clear cookies: `await context.clearCookies()`
4. Check session configuration

### OAuth Tests Not Working

**Problem:** OAuth integration tests fail.

**Solutions:**
1. Set `OAUTH_ENCRYPTION_KEY` in `.env`
2. Configure OAuth apps in platforms
3. Verify callback URLs
4. Mock OAuth flow if needed

### Tests Pass Locally, Fail in CI

**Problem:** Tests work locally but fail in CI.

**Solutions:**
1. Set all environment variables in CI
2. Start required services in CI
3. Increase timeouts for slower CI
4. Install correct browser versions
5. Check file permissions

### Flaky Tests

**Problem:** Tests intermittently fail.

**Solutions:**
1. Add explicit waits:
   ```typescript
   await page.waitForLoadState('networkidle');
   ```
2. Use `toBeVisible()` with timeout:
   ```typescript
   await expect(element).toBeVisible({ timeout: 10000 });
   ```
3. Retry failed tests:
   ```typescript
   // In playwright.config.ts
   retries: process.env.CI ? 2 : 0,
   ```

### Screenshots/Videos Not Captured

**Problem:** No screenshots on failure.

**Solutions:**
1. Check `playwright.config.ts` settings:
   ```typescript
   use: {
     screenshot: 'only-on-failure',
     video: 'retain-on-failure',
   }
   ```
2. Ensure output directory exists
3. Check disk space

## Configuration

Main configuration in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './tests/playwright',
  timeout: 60 * 1000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @devflow/web dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'PORT=3000 pnpm --filter @devflow/api dev',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [tests/playwright/README.md](../../tests/playwright/README.md) - Detailed test documentation
- [.docs/WEB_INTERFACE.md](../WEB_INTERFACE.md) - Web interface architecture
- [.docs/ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture

---

**Next Steps:**
- Write tests for new features
- Add visual regression testing
- Set up parallel test execution
- Add performance testing

**Last Updated:** December 28, 2025
