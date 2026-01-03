# Playwright E2E Tests

End-to-end tests for DevFlow web interface using Playwright.

## Overview

This directory contains Playwright tests that verify the complete user experience of the DevFlow application, including:

- **Authentication flow** - Login, signup, logout, session management
- **Project management** - Creating, viewing, managing projects
- **OAuth integrations** - Connecting and managing third-party integrations (GitHub, Linear, Figma, Sentry)
- **Workflow execution** - Triggering and monitoring workflows

## Prerequisites

### 1. Install Playwright Browsers

```bash
pnpm playwright:install
```

### 2. Set Up Test Environment

Copy the example environment file:

```bash
cp tests/playwright/.env.example tests/playwright/.env
# Edit .env with your test credentials
```

### 3. Start Required Services

```bash
# Start infrastructure
docker-compose -f docker-compose.infra.yml up -d

# Or start all services including app
docker-compose up -d
```

### 4. Prepare Test Database

Create a test user in your database:

```bash
# Run database migrations
pnpm db:push

# Create test user (manual or via seed script)
# Default test user:
# Email: test@devflow.local
# Password: TestPassword123!
```

## Running Tests

### Run All Tests (Headless)

```bash
pnpm test:playwright
```

### Run Tests with UI Mode (Recommended for Development)

```bash
pnpm test:playwright:ui
```

UI mode provides:
- Visual test runner
- Time travel debugging
- Watch mode
- Easy test filtering

### Run Tests in Headed Mode (See Browser)

```bash
pnpm test:playwright:headed
```

### Debug a Specific Test

```bash
pnpm test:playwright:debug tests/playwright/auth.spec.ts
```

### Run Specific Test File

```bash
pnpm test:playwright tests/playwright/auth.spec.ts
```

### Run Tests Matching Pattern

```bash
pnpm test:playwright -g "login"
```

## Test Structure

```
tests/playwright/
├── auth.spec.ts                    # Authentication tests
├── projects.spec.ts                # Project management tests
├── oauth-integrations.spec.ts      # OAuth integration tests
├── fixtures/
│   └── auth.ts                     # Authentication fixture
├── helpers/
│   └── api.ts                      # API helper functions
├── .env.example                    # Example environment variables
└── README.md                       # This file
```

## Test Files

### `auth.spec.ts`
Tests user authentication flow:
- Login page display
- Login with valid/invalid credentials
- Signup flow
- Logout
- Session persistence
- Protected routes

### `projects.spec.ts`
Tests project management:
- Project list display
- Creating new projects
- Viewing project details
- Project settings
- Project workflows
- Navigation between projects

### `oauth-integrations.spec.ts`
Tests OAuth integration flow:
- Integration status display
- Connecting OAuth providers (GitHub, Linear, Figma, Sentry)
- OAuth popup flow
- Testing connections
- Disconnecting integrations
- Multi-project OAuth isolation

## Fixtures and Helpers

### Authentication Fixture (`fixtures/auth.ts`)

Provides an authenticated page context for tests that require a logged-in user:

```typescript
import { test, expect } from './fixtures/auth';

test('should access protected page', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage).toHaveURL('/dashboard');
});
```

### API Helper (`helpers/api.ts`)

Provides API methods for test setup and assertions:

```typescript
import { ApiHelper } from './helpers/api';

test('should create project via API', async ({ request }) => {
  const api = new ApiHelper(request);
  const project = await api.createProject({
    name: 'Test Project',
    key: 'TEST',
  });
  expect(project).toBeDefined();
});
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PLAYWRIGHT_BASE_URL` | Frontend base URL | `http://localhost:3001` |
| `API_BASE_URL` | API base URL | `http://localhost:3000/api/v1` |
| `TEST_USER_EMAIL` | Test user email | `test@devflow.local` |
| `TEST_USER_PASSWORD` | Test user password | `TestPassword123!` |
| `DATABASE_URL` | Database connection string | See `.env.example` |
| `OAUTH_ENCRYPTION_KEY` | OAuth token encryption key | Required for OAuth tests |
| `TEST_PROJECT_ID` | Specific project for testing | Optional |

## Configuration

Playwright configuration is in `playwright.config.ts` at the project root.

Key settings:
- **Test directory**: `tests/playwright`
- **Timeout**: 60 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Browsers**: Chromium (default), Firefox, WebKit (optional)
- **Reporters**: HTML, List, JSON
- **Base URL**: `http://localhost:3001`

## Best Practices

### 1. Use Fixtures for Common Setup

```typescript
import { test, expect } from './fixtures/auth';

test('my test', async ({ authenticatedPage }) => {
  // Page is already authenticated
});
```

### 2. Use Data Attributes for Stable Selectors

```typescript
// Good
await page.click('[data-testid="create-project-button"]');

// Avoid
await page.click('.btn.btn-primary');
```

### 3. Wait for Explicit Conditions

```typescript
// Good
await page.waitForURL('/dashboard');
await expect(page.locator('[data-testid="project-card"]')).toBeVisible();

// Avoid
await page.waitForTimeout(5000);
```

### 4. Clean Up After Tests

```typescript
test.afterEach(async ({ authenticatedPage }) => {
  // Clean up test data
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

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
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

      - name: Start services
        run: docker-compose up -d

      - name: Run Playwright tests
        run: pnpm test:playwright
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Viewing Test Reports

After running tests, view the HTML report:

```bash
pnpm test:playwright:report
```

The report includes:
- Test results and duration
- Screenshots on failure
- Videos on failure
- Trace files for debugging

## Troubleshooting

### Tests Failing with "Timeout"

**Solution**: Increase timeout in `playwright.config.ts` or ensure services are running.

### "Page not found" Errors

**Solution**: Verify `PLAYWRIGHT_BASE_URL` is correct and frontend is running on that port.

### Authentication Tests Failing

**Solution**:
1. Verify test user exists in database
2. Check `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are correct
3. Ensure session cookies are working

### OAuth Tests Not Working

**Solution**:
1. Set `OAUTH_ENCRYPTION_KEY` in `.env`
2. Configure OAuth apps in respective platforms
3. Verify callback URLs are correct

### Tests Work Locally but Fail in CI

**Solution**:
1. Check environment variables are set in CI
2. Verify services are started before tests
3. Increase timeouts for slower CI environments
4. Check browser installation in CI

## Writing New Tests

### 1. Create Test File

```bash
touch tests/playwright/my-feature.spec.ts
```

### 2. Write Test

```typescript
import { test, expect } from './fixtures/auth';

test.describe('My Feature', () => {
  test('should do something', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/my-feature');

    // Your test logic
    await expect(authenticatedPage.locator('h1')).toHaveText('My Feature');
  });
});
```

### 3. Run Test

```bash
pnpm test:playwright tests/playwright/my-feature.spec.ts
```

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [DevFlow Documentation](../../.docs/README.md)
- [Web Interface Guide](../../.docs/WEB_INTERFACE.md)

---

**Last Updated:** December 28, 2025
