# Testing Guide

Complete guide to testing DevFlow installations and workflows.

## Unit Tests

### Run All Tests

```bash
pnpm test
```

### Run Package-Specific Tests

```bash
pnpm --filter @devflow/sdk test
pnpm --filter @devflow/api test
pnpm --filter @devflow/worker test
```

### With Coverage

```bash
pnpm test:coverage
```

---

## Integration Tests

### Test OAuth Connections

```bash
# Test all integrations for a project
devflow integrations:test <project-id>

# Test specific provider
devflow integrations:test <project-id> --provider github
devflow integrations:test <project-id> --provider linear
devflow integrations:test <project-id> --provider figma
devflow integrations:test <project-id> --provider sentry
```

### Via API

```bash
# Test GitHub integration
curl -X POST http://localhost:3000/api/v1/integrations/test/github \
  -H "Content-Type: application/json" \
  -d '{"projectId": "your-project-id"}'
```

---

## E2E Workflow Testing

### Prerequisites

1. Docker services running (`docker-compose up -d`)
2. API running (`pnpm --filter @devflow/api dev`)
3. Worker running (`pnpm --filter @devflow/worker dev`)
4. OAuth connections configured

### Test Refinement Workflow

```bash
./tests/e2e/test-refinement-workflow.sh <project-id>
```

### Full Project Setup Test

```bash
./tests/e2e/test-full-project-setup.sh
```

This interactive script:
1. Creates a new project
2. Sets up OAuth connections
3. Tests all integrations
4. Runs a sample workflow

---

## Manual SDK Tests

Located in `packages/sdk/src/__manual_tests__/`:

### GitHub Integration

```bash
GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-github-integration.ts
```

### Linear Integration

```bash
LINEAR_API_KEY="lin_api_xxx" npx ts-node src/__manual_tests__/test-linear-integration.ts
```

### Figma Integration

```bash
# Requires OAuth connection
DATABASE_URL="..." PROJECT_ID="..." \
  npx ts-node src/__manual_tests__/test-figma-integration.ts
```

### All Integrations

```bash
DATABASE_URL="..." PROJECT_ID="..." \
  npx ts-node src/__manual_tests__/test-all-integrations.ts
```

---

## Testing New Project Workflow

Complete walkthrough for testing a fresh installation:

### Step 1: Start Infrastructure

```bash
docker-compose up -d postgres redis temporal temporal-ui qdrant
```

### Step 2: Database Setup

```bash
cd packages/api
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow" npx prisma db push
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow" npx prisma generate
```

### Step 3: Start Services

**Terminal 1:**
```bash
pnpm --filter @devflow/api dev
```

**Terminal 2:**
```bash
pnpm --filter @devflow/worker dev
```

### Step 4: Create Test Project

```bash
devflow project:create
# Follow the interactive wizard
```

### Step 5: Connect OAuth

```bash
devflow oauth:connect <project-id> github
devflow oauth:connect <project-id> linear
```

### Step 6: Verify Connections

```bash
devflow oauth:status <project-id>
devflow integrations:test <project-id>
```

### Step 7: Test Workflow

1. Create a Linear issue with status `To Refinement`
2. Monitor Temporal UI: http://localhost:8080
3. Check Linear for refinement output

---

## Verifying Results

### Check Database

```bash
cd packages/api
DATABASE_URL="..." npx prisma studio
```

Check tables:
- **Projects** - Your test project
- **Tasks** - Synced Linear tasks
- **OAuthConnection** - OAuth connections status

### Check Temporal

1. Open http://localhost:8080
2. Navigate to "Workflows"
3. Find your workflow by ID
4. Check execution history and activity results

### Check Linear

1. Open your Linear issue
2. Verify:
   - Status updated correctly
   - Refinement/output appended to description
   - Documents attached (if applicable)

---

## Test Scripts Reference

| Script | Location | Description |
|--------|----------|-------------|
| `test-refinement-workflow.sh` | `tests/e2e/` | E2E refinement test |
| `test-full-project-setup.sh` | `tests/e2e/` | Full setup wizard |
| `test-integrations-e2e.sh` | `tests/e2e/` | Quick integration test |
| `test-github-integration.ts` | `packages/sdk/src/__manual_tests__/` | GitHub SDK test |
| `test-linear-integration.ts` | `packages/sdk/src/__manual_tests__/` | Linear SDK test |
| `test-all-integrations.ts` | `packages/sdk/src/__manual_tests__/` | All integrations test |

---

## Build Status Verification

```bash
# Build all packages
pnpm build

# Check for TypeScript errors
pnpm --filter @devflow/sdk typecheck
pnpm --filter @devflow/api typecheck
pnpm --filter @devflow/worker typecheck
```

---

## Useful Commands

```bash
# View all running services
docker-compose ps

# View logs
docker-compose logs -f api worker

# Restart a service
docker-compose restart postgres

# Stop everything
docker-compose down

# Clean and restart
docker-compose down -v && docker-compose up -d
```

---

**See also:**
- [GETTING_STARTED.md](./GETTING_STARTED.md) for setup
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) for workflow details
