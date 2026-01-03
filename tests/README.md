# DevFlow Tests

This directory contains all test scripts for DevFlow.

## Structure

```
tests/
├── e2e/              # End-to-end workflow tests (bash/TypeScript)
├── integration/      # Integration tests (OAuth, API)
├── playwright/       # Playwright E2E tests (web interface)
└── .env.example      # Example environment variables for tests
```

## End-to-End Tests (`e2e/`)

End-to-end tests that verify complete DevFlow workflows from start to finish.

### Available Tests

- **`test-complete-workflow.sh`** - Complete workflow test including project setup, OAuth, and workflow execution
- **`test-e2e-workflow.sh`** - End-to-end workflow test focusing on the main DevFlow workflow stages
- **`test-cli-complete.sh`** - CLI-focused end-to-end test

### Usage

```bash
cd /Users/victorgambert/Sites/DevFlow
./tests/e2e/test-complete-workflow.sh
```

## Integration Tests (`integration/`)

Integration tests that verify specific components and integrations.

### Available Tests

- **`test-oauth-flow.sh`** - Test OAuth flows for GitHub and Linear
- **`test-phase4-oauth.sh`** - Phase 4 OAuth implementation test

### Usage

```bash
# Test GitHub OAuth flow
./tests/integration/test-oauth-flow.sh <PROJECT_ID> github

# Test Linear OAuth flow
./tests/integration/test-oauth-flow.sh <PROJECT_ID> linear
```

## Playwright E2E Tests (`playwright/`)

Browser-based end-to-end tests for the web interface using Playwright.

### Available Tests

- **`auth.spec.ts`** - User authentication flow (login, signup, logout)
- **`projects.spec.ts`** - Project management (create, view, manage projects)
- **`oauth-integrations.spec.ts`** - OAuth integration flow (connect/disconnect providers)

### Setup

```bash
# Install Playwright browsers
pnpm playwright:install

# Copy environment variables
cp tests/playwright/.env.example tests/playwright/.env
# Edit .env with your test credentials
```

### Usage

```bash
# Run all Playwright tests (headless)
pnpm test:playwright

# Run with UI mode (recommended for development)
pnpm test:playwright:ui

# Run in headed mode (see browser)
pnpm test:playwright:headed

# Debug specific test
pnpm test:playwright:debug tests/playwright/auth.spec.ts

# View test report
pnpm test:playwright:report
```

**See [playwright/README.md](playwright/README.md) for detailed documentation.**

## Environment Setup

Copy `.env.example` to create your test environment:

```bash
cp tests/.env.example tests/.env
# Edit .env with your test credentials
```

## Prerequisites

Before running tests, ensure:

1. **Infrastructure is running:**
   ```bash
   docker-compose up -d postgres redis temporal temporal-ui qdrant
   ```

2. **Database is migrated:**
   ```bash
   cd packages/api
   DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" \
     npx prisma db push
   ```

3. **Services are built:**
   ```bash
   pnpm build
   ```

4. **Required environment variables are set:**
   - `OAUTH_ENCRYPTION_KEY` - For OAuth token encryption
   - `DATABASE_URL` - PostgreSQL connection string
   - API keys for AI providers (OpenRouter, etc.)

## Running All Tests

```bash
# Run all bash E2E tests
for test in tests/e2e/*.sh; do
  echo "Running $test..."
  $test
done

# Run all integration tests (requires PROJECT_ID)
PROJECT_ID="your-project-id"
./tests/integration/test-oauth-flow.sh $PROJECT_ID github
./tests/integration/test-oauth-flow.sh $PROJECT_ID linear

# Run all Playwright tests
pnpm test:playwright
```

## Test Development Guidelines

When adding new tests:

1. Place in the appropriate directory (`e2e/` or `integration/`)
2. Make scripts executable: `chmod +x tests/path/to/test.sh`
3. Add documentation to this README
4. Include error handling and cleanup
5. Use consistent naming: `test-<feature>-<type>.sh`

## Troubleshooting

### Tests Failing to Connect to Services

```bash
# Verify services are running
docker-compose ps

# Check service logs
docker-compose logs -f postgres redis temporal
```

### OAuth Tests Failing

```bash
# Verify encryption key is set
echo $OAUTH_ENCRYPTION_KEY

# Check API is running
curl http://localhost:8000/api/v1/health
```

### Database Connection Issues

```bash
# Test database connection
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" \
  npx prisma db execute --stdin <<< "SELECT 1;"
```

## Additional Resources

- [Testing New Project Workflow Guide](../.docs/TESTING_NEW_PROJECT_WORKFLOW.md)
- [OAuth Multi-Tenant Architecture](../.docs/OAUTH_MULTITENANT.md)
- [Complete Documentation](../.docs/DOCUMENTATION.md)

---

**Last Updated:** December 28, 2025
