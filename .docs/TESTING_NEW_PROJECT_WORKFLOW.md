# Testing New Project Workflow - DevFlow

This guide walks you through testing the complete DevFlow project initialization and workflow.

## Prerequisites

- Docker and Docker Compose installed
- Node.js >= 20
- pnpm installed
- GitHub account (for OAuth testing)
- Linear workspace (for OAuth testing, optional)

## Step 1: Infrastructure Setup

### 1.1 Start Docker Services

```bash
docker-compose up -d postgres redis temporal temporal-ui qdrant
```

Verify services are running:
```bash
docker-compose ps
```

You should see:
- `devflow-postgres` (healthy)
- `devflow-redis` (healthy)
- `devflow-temporal` (running)
- `devflow-temporal-ui` (running)
- `devflow-qdrant` (healthy)

### 1.2 Access Service UIs

- **Temporal UI**: http://localhost:8080
- **Qdrant Dashboard**: http://localhost:6333/dashboard

## Step 2: Database Setup

### 2.1 Run Database Migrations

```bash
cd packages/api
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" npx prisma db push
```

### 2.2 Generate Prisma Client

```bash
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" npx prisma generate
```

### 2.3 (Optional) Open Prisma Studio

```bash
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" npx prisma studio
```

Prisma Studio will be available at: http://localhost:5555

## Step 3: Project Initialization

### 3.1 Set Required Environment Variables

```bash
# Generate OAuth encryption key if not already set
export OAUTH_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Database URL
export DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public"
```

### 3.2 Run Project Initialization Script

```bash
cd /Users/victorgambert/Sites/DevFlow
DATABASE_URL="$DATABASE_URL" OAUTH_ENCRYPTION_KEY="$OAUTH_ENCRYPTION_KEY" \
  npx ts-node packages/sdk/src/__manual_tests__/test-project-initialization.ts
```

This script will:
1. Create a new project in the database
2. Register OAuth applications for GitHub and Linear
3. Check current OAuth connection status
4. Display next steps

**Expected Output:**
```
🚀 DevFlow Project Initialization Test
============================================================

📦 Step 1: Creating new project...
✅ Project created: Test Project (bebf5fce-2528-440b-986a-4cd93c783cc8)

🔐 Step 2: Registering OAuth applications...
✅ GitHub OAuth app registered (...)
✅ Linear OAuth app registered (...)

🔍 Step 3: Checking OAuth connections...
⚠️  No OAuth connections found. You need to connect OAuth providers:
...
```

**Save the Project ID** from the output - you'll need it for OAuth setup.

## Step 4: Start the DevFlow API

Open a new terminal and run:

```bash
cd /Users/victorgambert/Sites/DevFlow
pnpm --filter @devflow/api dev
```

The API will start on **port 8000**:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 4.1 Verify API is Running

```bash
curl http://localhost:8000/api/v1/health | jq '.'
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-08T23:45:22.083Z",
  "uptime": 21.921839709
}
```

## Step 5: Connect OAuth Providers

### 5.1 GitHub OAuth (Device Flow)

#### Option A: Using the Test Script

```bash
./test-oauth-flow.sh <PROJECT_ID> github
```

#### Option B: Manual Testing with cURL

**Step 1: Initiate Device Flow**

```bash
PROJECT_ID="your-project-id-here"

curl -X POST http://localhost:8000/api/v1/auth/github/device/initiate \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"$PROJECT_ID\"}" | jq '.'
```

**Response:**
```json
{
  "deviceCode": "abc123...",
  "userCode": "ABCD-1234",
  "verificationUri": "https://github.com/login/device",
  "expiresIn": 900,
  "interval": 5
}
```

**Step 2: Authorize the Device**

1. Visit the `verificationUri` in your browser
2. Enter the `userCode`
3. Authorize the DevFlow application

**Step 3: Poll for Token**

```bash
DEVICE_CODE="device-code-from-step-1"

curl -X POST http://localhost:8000/api/v1/auth/github/device/poll \
  -H "Content-Type: application/json" \
  -d "{\"deviceCode\": \"$DEVICE_CODE\", \"projectId\": \"$PROJECT_ID\"}" | jq '.'
```

Keep polling (every 5 seconds) until you get a success response:
```json
{
  "success": true,
  "connection": {
    "provider": "GITHUB",
    "isActive": true,
    "providerEmail": "your-email@example.com"
  }
}
```

### 5.2 Linear OAuth (Authorization Code Flow)

#### Option A: Using the Test Script

```bash
./test-oauth-flow.sh <PROJECT_ID> linear
```

#### Option B: Manual Testing with cURL

**Step 1: Get Authorization URL**

```bash
PROJECT_ID="your-project-id-here"

curl -X POST http://localhost:8000/api/v1/auth/linear/authorize \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"$PROJECT_ID\"}" | jq '.'
```

**Response:**
```json
{
  "authorizationUrl": "https://linear.app/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&state=...",
  "state": "random-state-string"
}
```

**Step 2: Authorize**

1. Visit the `authorizationUrl` in your browser
2. Authorize the DevFlow application
3. You'll be redirected to `http://localhost:8000/api/v1/auth/linear/callback`
4. The API will handle the token exchange automatically

### 5.3 Verify OAuth Connections

```bash
PROJECT_ID="your-project-id-here"

curl "http://localhost:8000/api/v1/auth/connections?project=$PROJECT_ID" | jq '.'
```

**Expected Response:**
```json
{
  "connections": [
    {
      "provider": "GITHUB",
      "isActive": true,
      "providerEmail": "your-email@example.com",
      "scopes": ["repo", "workflow", "read:user"],
      "lastRefreshed": "2025-12-08T23:45:00.000Z"
    },
    {
      "provider": "LINEAR",
      "isActive": true,
      "providerEmail": "your-email@example.com",
      "scopes": ["read", "write", "issues:create", "comments:create"],
      "lastRefreshed": "2025-12-08T23:46:00.000Z"
    }
  ]
}
```

## Step 6: Start the Temporal Worker

Open a new terminal and run:

```bash
cd /Users/victorgambert/Sites/DevFlow
pnpm --filter @devflow/worker dev
```

The worker will connect to Temporal and start listening for workflows.

## Step 7: Test the Complete Workflow

### 7.1 Create a Test Task in Linear

**Option A: Via Linear UI**
1. Go to your Linear workspace
2. Create a new issue with:
   - **Status**: "To Spec" (or your configured trigger status)
   - **Title**: "Add user authentication"
   - **Description**: Detailed description of the feature

**Option B: Via API**

```bash
PROJECT_ID="your-project-id-here"

curl -X POST http://localhost:8000/api/v1/tasks/sync/linear \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"linearIssueId\": \"LIN-123\"
  }" | jq '.'
```

### 7.2 Monitor Workflow Execution

#### Via Temporal UI
1. Open http://localhost:8080
2. Navigate to "Workflows"
3. Find your workflow by project ID or task ID
4. Click to view detailed execution logs

#### Via API

```bash
WORKFLOW_ID="your-workflow-id"

curl "http://localhost:8000/api/v1/workflows/$WORKFLOW_ID" | jq '.'
```

### 7.3 Expected Workflow Stages

The workflow will go through these stages:

1. **LINEAR_SYNC**: Sync task from Linear
2. **SPEC_GENERATION**: Generate technical specification using AI
3. **CODE_GENERATION**: Generate code based on spec
4. **PR_CREATION**: Create Pull Request on GitHub
5. **CI_EXECUTION**: Wait for CI to complete
6. **FIX_GENERATION**: Auto-fix if tests fail (up to 3 attempts)
7. **MERGE**: Merge PR (if auto-merge enabled)
8. **NOTIFICATION**: Send notifications

### 7.4 Check Linear Issue

After spec generation, the specification will be appended to the Linear issue description.

## Step 8: Verify Results

### 8.1 Check Database

```bash
# Open Prisma Studio
cd packages/api
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" npx prisma studio
```

Check:
- **Projects**: Your test project
- **Tasks**: Synced Linear task
- **Workflows**: Workflow execution record
- **WorkflowStageLogs**: Detailed stage logs
- **PullRequests**: Created PR information

### 8.2 Check GitHub

1. Go to your GitHub repository
2. Check for:
   - New branch created (e.g., `devflow/LIN-123-add-user-authentication`)
   - Pull Request created
   - CI/CD runs

### 8.3 Check Linear

1. Go to your Linear issue
2. Verify:
   - Status updated to "Spec Ready" (or your configured next status)
   - Specification appended to description
   - Comments added by DevFlow

## Troubleshooting

### API Not Starting

```bash
# Check if port 8000 is available
lsof -i :8000

# Check logs
pnpm --filter @devflow/api dev
```

### Worker Not Connecting to Temporal

```bash
# Verify Temporal is running
docker-compose ps temporal

# Check Temporal UI
open http://localhost:8080
```

### OAuth Connection Failed

```bash
# Verify encryption key is set
echo $OAUTH_ENCRYPTION_KEY

# Check OAuth apps in database
cd packages/api
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" \
  npx prisma studio
# Navigate to OAuthApplication table
```

### Workflow Not Triggering

1. Check worker is running
2. Verify OAuth connections are active
3. Check Linear webhook is configured correctly
4. Check worker logs for errors

## Useful Commands

```bash
# View all running services
docker-compose ps

# View logs
docker-compose logs -f api worker

# Restart a service
docker-compose restart postgres

# Stop all services
docker-compose down

# Clean everything and start fresh
docker-compose down -v
docker-compose up -d
```

## Environment Variables Reference

```bash
# Required
OAUTH_ENCRYPTION_KEY="<base64-encoded-32-byte-key>"
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public"

# Infrastructure
REDIS_HOST=localhost
REDIS_PORT=6379
QDRANT_HOST=localhost
QDRANT_PORT=6333
TEMPORAL_ADDRESS=localhost:7233

# OAuth (optional, for testing)
GITHUB_OAUTH_CLIENT_ID="your-github-client-id"
GITHUB_OAUTH_CLIENT_SECRET="your-github-client-secret"
LINEAR_OAUTH_CLIENT_ID="your-linear-client-id"
LINEAR_OAUTH_CLIENT_SECRET="your-linear-client-secret"

# AI Providers (for workflow execution)
OPENROUTER_API_KEY="sk-or-xxx"
OPENROUTER_MODEL="anthropic/claude-sonnet-4"

# Linear (for webhooks and sync)
LINEAR_API_KEY="lin_api_xxx"  # Personal API key for initial setup
LINEAR_WEBHOOK_SECRET="your-webhook-secret"
LINEAR_TRIGGER_STATUS="To Spec"
LINEAR_NEXT_STATUS="Spec Ready"
```

## Next Steps

Once you've successfully tested the workflow:

1. **Configure Webhooks**: Set up Linear and GitHub webhooks to trigger workflows automatically
2. **Configure CI/CD**: Ensure your GitHub Actions are properly configured
3. **Set Up Auto-Merge**: Configure auto-merge policies in your project settings
4. **Set Up Notifications**: Configure Slack/Discord notifications
5. **Deploy to Production**: Deploy DevFlow to your production environment

## Additional Resources

- [Architecture Documentation](../ARCHITECTURE.md)
- [Complete Documentation](../DOCUMENTATION.md)
- [Linear OAuth Setup](./LINEAR_OAUTH_SETUP.md)
- [OAuth Multi-Tenant Architecture](./OAUTH_MULTITENANT.md)
- [CLAUDE.md](../CLAUDE.md) - Quick reference for Claude

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f api worker`
2. Verify all services are healthy: `docker-compose ps`
3. Check Temporal UI for workflow errors: http://localhost:8080
4. Review the test script output for specific error messages

---

**Last Updated:** December 8, 2025
**Version:** 1.0.0
