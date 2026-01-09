# CLAUDE.md - DevFlow

**Version:** 2.5.1 | **Updated:** December 28, 2025 | **Status:** Production Ready

## Agent Reminders

- End every task with a Documentation step (code, infra, CI, scripts, tests)
- Update relevant files: `CLAUDE.md`, `.docs/`, package README
- In PRs: add `Documentation: updated (files)` or `Documentation: N/A (reason)`
- For new workflows/commands: document usage, prerequisites, rollback

## Overview

DevFlow is a universal DevOps orchestrator that transforms Linear tasks into deployed code. It uses a Three-Phase Agile workflow: **Refinement → User Story → Technical Plan**.

**Details:** [.docs/guides/WORKFLOW_GUIDE.md](.docs/guides/WORKFLOW_GUIDE.md)

---

## Architecture

- **API:** NestJS (REST) - port 3000
- **Orchestration:** Temporal.io
- **Database:** PostgreSQL 16 + Prisma ORM
- **Cache:** Redis 7
- **Frontend:** Nuxt 3 (port 3001)

**Architecture Rule:** NestJS decorators (`@Injectable`, `@Module`, `@Controller`) are used **only in @devflow/api**. SDK, worker, CLI, and common packages are **plain TypeScript**.

**Details:** [.docs/ARCHITECTURE.md](.docs/ARCHITECTURE.md)

---

## Monorepo Structure

```
devflow/
├── packages/
│   ├── api/              # NestJS REST API (port 3000)
│   ├── worker/           # Temporal workers
│   ├── sdk/              # SDK (VCS, CI, AI, Linear, codebase)
│   ├── cli/              # CLI (oclif)
│   ├── web/              # Frontend (Nuxt 3, port 3001)
│   └── common/           # Shared types, utils, config
├── infra/                # Helm charts, K8s manifests
└── docker-compose.yml    # Dev environment
```

---

## Packages Overview

### @devflow/api
- REST endpoints: `/health`, `/projects`, `/tasks`, `/webhooks/*`, `/workflows/*`
- OAuth endpoints: `/auth/{provider}/*` (GitHub, Linear, Figma, Sentry)
- User auth: `/user-auth/*` (signup, login, OAuth, email verification)
- User settings: `/user/settings/*` (profile, avatar, password)
- Organizations: `/organizations/*` (settings, logo, members)

### @devflow/worker
- Main workflow: `devflowWorkflow` (router)
- Sub-workflows: `refinementWorkflow`, `userStoryWorkflow`, `technicalPlanWorkflow`
- Activities: Linear sync, AI generation, context retrieval

### @devflow/sdk
- **VCS:** GitHubProvider, GitHubIntegrationService
- **Linear:** LinearClient, LinearIntegrationService
- **AI:** AnthropicProvider, OpenAIProvider, OpenRouterProvider
- **Integrations:** FigmaIntegrationService, SentryIntegrationService
- **RAG:** Indexing, retrieval, embeddings
- **Auth:** Token encryption, storage, refresh
- **Storage:** SupabaseStorageService (avatar, logo uploads)

### @devflow/cli
- Project: `init`, `project:create`, `project:list`
- OAuth: `oauth:connect`, `oauth:status`
- Integrations: `integrations:test`, `integrations:setup-linear`
- Workflow: `workflow:start`, `workflow:status`

### @devflow/web
- **Framework:** Nuxt 4, Vue 3, Pinia, Tailwind CSS
- **Authentication:** Session-based with httpOnly cookies, SSO (Google, GitHub)
- **Pages:** `/login`, `/signup`, `/dashboard`, `/projects`, `/projects/{id}`, `/settings/profile`, `/settings/organization`, `/forgot-password`, `/reset-password`, `/verify-email`
- **Features:** Project management, OAuth integration management (connect/test/disconnect), user & org settings, real-time stats
- **OAuth Flow:** Automatic popup with 1s polling (60s timeout)
- **State:** Pinia stores for projects, integrations, and settings with localStorage persistence

**Details:** [.docs/WEB_INTERFACE.md](.docs/WEB_INTERFACE.md)

### @devflow/common
- Types: `WorkflowInput`, `WorkflowConfig`
- Config: `loadConfig()`, `validateConfig()`
- Status helpers: `getStatusRank()`, `isTriggerStatus()`, `isCascadeStatus()`

---

## Three-Phase Workflow (Summary)

```
Phase 1: To Refinement  → refinementWorkflow  → Refinement Ready
Phase 2: To User Story  → userStoryWorkflow   → UserStory Ready
Phase 3: To Plan        → technicalPlanWorkflow → Plan Ready
```

Phases do NOT auto-chain. Each must be manually triggered.

**Features:**
- Parent-child cascade (parent triggers children workflows)
- Status rollup (parent reflects minimum child status)
- PO questions posted as Linear comments
- Context documents created in Phase 1

**Details:** [.docs/guides/WORKFLOW_GUIDE.md](.docs/guides/WORKFLOW_GUIDE.md)

---

## Essential Commands

```bash
# Infrastructure
docker-compose up -d                    # Start all services
docker-compose logs -f api worker       # View logs

# Development
pnpm install                           # Install deps
pnpm build                             # Build all packages
pnpm --filter @devflow/api dev         # Start API
pnpm --filter @devflow/worker dev      # Start worker
pnpm --filter @devflow/web dev         # Start frontend

# Database
pnpm --filter @devflow/api db:push     # Push schema
pnpm --filter @devflow/api db:migrate  # Run migrations

# Testing
pnpm test                              # Run unit tests
pnpm test:playwright                   # Run Playwright E2E tests
pnpm test:playwright:ui                # Run Playwright with UI mode
devflow integrations:test <project-id> # Test OAuth connections
```

---

## Configuration

**Environment Variables:** [.docs/ENV_VARIABLES.md](.docs/ENV_VARIABLES.md)

**Required:**
```bash
OAUTH_ENCRYPTION_KEY=<base64-32-bytes>
DATABASE_URL=postgresql://...
SESSION_SECRET=<base64-32-bytes>
OPENROUTER_API_KEY=sk-or-xxx
```

**OAuth Setup:** [.docs/integrations/](.docs/integrations/)

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| OAuth not configured | `devflow oauth:connect <project-id> <provider>` |
| Database connection failed | `docker-compose restart postgres` |
| Temporal not reachable | `docker-compose restart temporal` |
| Token expired | `POST /api/v1/auth/<provider>/refresh` |
| Workflow not triggering | Check worker logs, OAuth status, Linear webhook |

**Details:** [.docs/guides/TROUBLESHOOTING.md](.docs/guides/TROUBLESHOOTING.md)

---

## Key Files Reference

### Documentation
- [.docs/README.md](.docs/README.md) - Documentation index
- [.docs/ARCHITECTURE.md](.docs/ARCHITECTURE.md) - Architecture deep dive
- [.docs/guides/WORKFLOW_GUIDE.md](.docs/guides/WORKFLOW_GUIDE.md) - Three-phase workflow
- [.docs/ENV_VARIABLES.md](.docs/ENV_VARIABLES.md) - All environment variables
- [.docs/integrations/](.docs/integrations/) - OAuth setup guides
- [.docs/rag/](.docs/rag/) - RAG system docs

### Workflows
- `packages/worker/src/workflows/devflow.workflow.ts` - Main router
- `packages/worker/src/workflows/phases/refinement.workflow.ts`
- `packages/worker/src/workflows/phases/user-story.workflow.ts`
- `packages/worker/src/workflows/phases/technical-plan.workflow.ts`

### Activities
- `packages/worker/src/activities/refinement.activities.ts`
- `packages/worker/src/activities/linear.activities.ts`
- `packages/worker/src/activities/context.activities.ts`

### SDK Core
- `packages/sdk/src/linear/linear.client.ts` - Linear API client
- `packages/sdk/src/agents/` - AI providers
- `packages/sdk/src/auth/` - OAuth services
- `packages/sdk/src/rag/` - RAG system

### API
- `packages/api/src/webhooks/webhooks.service.ts` - Webhook handling
- `packages/api/src/auth/` - OAuth endpoints
- `packages/api/src/user-auth/` - User authentication
- `packages/api/prisma/schema.prisma` - Database schema

### Configuration
- `packages/common/src/types/workflow-config.types.ts` - Status configuration
- `packages/common/src/config/config-loader.ts` - Config loader

### Tests
- `packages/sdk/src/__manual_tests__/` - SDK integration tests
- `tests/e2e/` - E2E test scripts (bash/TypeScript)
- `tests/playwright/` - Playwright E2E tests (web interface)
- `tests/integration/` - Integration test scripts
- `playwright.config.ts` - Playwright configuration

---

## Full Documentation

See [.docs/README.md](.docs/README.md) for the complete documentation index.
