# 🏗️ DevFlow - Architecture & Design Decisions

**Version:** 1.0.0
**Last Updated:** December 8, 2025
**Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [NestJS Boundary Rules](#nestjs-boundary-rules)
3. [Module Architecture](#module-architecture)
4. [Design Principles](#design-principles)
5. [Import Patterns](#import-patterns)
6. [Decision Records](#decision-records)
7. [Future Guidelines](#future-guidelines)

---

## Overview

DevFlow follows a **clear separation of concerns** between framework-specific code (NestJS) and reusable business logic (plain TypeScript). This architecture ensures:

- **Reusability** - SDK code works in API, workers, and CLI
- **Maintainability** - No decorator magic in shared code
- **Testability** - Simple dependency injection without frameworks
- **Deployability** - Workers bundle cleanly without NestJS complexity

### The Golden Rule

> **"If workers or CLI need it, it must be plain TypeScript in SDK."**

---

## NestJS Boundary Rules

### What is NestJS?

NestJS is a server-side framework for Node.js that provides:
- TypeScript-first architecture with decorators
- Dependency injection (DI) container
- Module system inspired by Angular
- Built-in support for HTTP, WebSockets, GraphQL, microservices

### When NestJS Shines

✅ **Use NestJS for:**
- Complex HTTP/GraphQL APIs with multiple endpoints
- Systems needing guards, interceptors, pipes, middleware
- Multi-team backends requiring shared architecture patterns
- Real-time gateways (WebSockets, SSE)

### When NestJS Creates Problems

❌ **Avoid NestJS in:**
- Shared libraries (SDK, utilities)
- Background workers (Temporal activities)
- CLI tools
- Any code that needs to work outside the HTTP context

**Why?** Decorators and reflection create build complexity with esbuild/tsx, and the DI container is unnecessary overhead for simple services.

---

## Module Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ API (@devflow/api) - NestJS Zone                           │
│ ✅ Full NestJS with decorators                              │
│                                                             │
│ • HTTP Controllers (@Controller, @Get, @Post)              │
│ • Injectable Services (@Injectable)                        │
│ • Modules (@Module)                                        │
│ • Guards, Interceptors, Pipes                              │
│ • Auth endpoints (OAuth flows)                             │
│ • Webhook handlers (Linear, GitHub)                        │
│ • Temporal client (workflow starter)                       │
│ • Prisma access (database operations)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ imports (no decorators exported)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ SDK (@devflow/sdk) - Plain TypeScript Zone                 │
│ ❌ NO NestJS decorators                                     │
│                                                             │
│ • VCS: GitHubProvider, GitLabProvider                      │
│ • CI: GitHubActionsProvider                                │
│ • Linear: LinearClient, LinearMapper                       │
│ • AI: AnthropicProvider, OpenAIProvider, OpenRouterProvider│
│ • RAG: Indexing, Retrieval, Embeddings, Vector Store      │
│ • Auth: Token encryption, storage, refresh, OAuth helpers  │
│ • Codebase: Analysis, dependency scanning, similarity      │
│ • Security: Policy guards, budget managers, scanners       │
│ • Governance: Auto-merge engine, audit logging             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ imports
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Worker (@devflow/worker) - Plain TypeScript Zone           │
│ ❌ NO NestJS decorators                                     │
│                                                             │
│ • Temporal workflows (devflowWorkflow)                     │
│ • Temporal activities (plain async functions)              │
│ • Activities: VCS, CI, Linear, Spec gen, Code gen, RAG    │
│ • Imports SDK services directly                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CLI (@devflow/cli) - Plain TypeScript Zone (oclif)        │
│ ❌ NO NestJS decorators                                     │
│                                                             │
│ • Commands: init, connect, status, run, doctor            │
│ • Imports SDK services directly                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Common (@devflow/common) - Plain TypeScript Zone           │
│ ❌ NO NestJS decorators                                     │
│                                                             │
│ • Shared types, interfaces, enums                          │
│ • Logger utilities                                         │
│ • Validation helpers                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Framework Isolation

**Principle:** Keep framework-specific code isolated to the edges of the system.

**In Practice:**
- NestJS decorators only in `@devflow/api`
- SDK, worker, CLI, and common are framework-agnostic
- Business logic never depends on HTTP or framework features

### 2. Plain Constructor Injection

**Principle:** Use simple constructor injection instead of DI containers in shared code.

**SDK Pattern:**
```typescript
// ✅ Good: Plain TypeScript class with constructor injection
export class LinearClient {
  constructor(private readonly config: LinearConfig) {}

  async getTask(id: string): Promise<LinearTask> {
    // Implementation using this.config
  }
}

// ✅ Good: Factory function for easy instantiation
export function createLinearClient(config: LinearConfig): LinearClient {
  return new LinearClient(config);
}
```

**API Pattern:**
```typescript
// ✅ Good: NestJS service that uses SDK
@Injectable()
export class TasksService {
  private readonly linearClient: LinearClient;

  constructor(private readonly configService: ConfigService) {
    // Instantiate SDK services in constructor
    this.linearClient = new LinearClient({
      apiKey: this.configService.get('LINEAR_API_KEY'),
    });
  }

  async syncTask(taskId: string) {
    return this.linearClient.getTask(taskId);
  }
}
```

**Worker Pattern:**
```typescript
// ✅ Good: Plain async function that uses SDK
import { LinearClient } from '@devflow/sdk';

export async function syncLinearTask(input: SyncInput): Promise<LinearTask> {
  const linearClient = new LinearClient({
    apiKey: process.env.LINEAR_API_KEY!,
  });

  return linearClient.getTask(input.taskId);
}
```

### 3. Public SDK Surface

**Principle:** SDK exports a clean public API; internal structure is hidden.

**SDK Export Structure:**
```typescript
// packages/sdk/src/index.ts
export * from './vcs';           // VCS providers
export * from './ci';            // CI providers
export * from './linear';        // Linear client
export * from './agents';        // AI providers
export * from './rag';           // RAG system
export * from './auth';          // Auth services
export * from './codebase';      // Codebase analysis
export * from './security';      // Security services
export * from './governance';    // Governance services
export * from './factories';     // Factory functions
```

**Consumers Import From Public API:**
```typescript
// ✅ Good: Import from package root
import { LinearClient, GitHubProvider, RepositoryIndexer } from '@devflow/sdk';

// ❌ Bad: Import from internal paths (breaks with refactoring)
import { LinearClient } from '@devflow/sdk/src/linear/linear.client';
import { GitHubProvider } from '@devflow/sdk/src/vcs/github.provider';
```

### 4. Path Alias Resolution

**Principle:** Use tsc-alias to resolve path aliases after TypeScript compilation.

**TypeScript Configuration:**
```json
// packages/sdk/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"]
    }
  }
}
```

**Build Process:**
```json
// packages/sdk/package.json
{
  "scripts": {
    "build": "tsc && tsc-alias"
  }
}
```

**Why?** TypeScript doesn't transform path aliases; tsc-alias rewrites imports in compiled .js files to use relative paths.

---

## Import Patterns

### ✅ Correct Import Patterns

#### API (NestJS) Importing SDK
```typescript
// packages/api/src/tasks/tasks.service.ts
import { LinearClient, GitHubProvider } from '@devflow/sdk';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TasksService {
  async processTask(taskId: string) {
    const linear = new LinearClient(config);
    const github = new GitHubProvider(config);
    // ...
  }
}
```

#### Worker Importing SDK
```typescript
// packages/worker/src/activities/linear.activities.ts
import { LinearClient } from '@devflow/sdk';

export async function syncLinearTask(input: SyncInput) {
  const client = new LinearClient(config);
  return client.getTask(input.taskId);
}
```

#### CLI Importing SDK
```typescript
// packages/cli/src/commands/connect.ts
import { LinearClient } from '@devflow/sdk';
import { Command } from '@oclif/core';

export class ConnectCommand extends Command {
  async run() {
    const client = new LinearClient(config);
    await client.authenticate();
  }
}
```

#### SDK Internal Imports
```typescript
// packages/sdk/src/linear/linear.client.ts
import { createLogger } from '@devflow/common';
import { LinearConfig, LinearTask } from '@/linear/linear.types';
import { LinearMapper } from '@/linear/linear.mapper';

export class LinearClient {
  // ...
}
```

### ❌ Incorrect Import Patterns

#### DON'T: Use NestJS Decorators in SDK
```typescript
// ❌ Bad: packages/sdk/src/linear/linear.client.ts
import { Injectable } from '@nestjs/common';

@Injectable() // ❌ NO! Creates build issues in workers
export class LinearClient {
  // ...
}
```

#### DON'T: Import SDK Internal Paths
```typescript
// ❌ Bad: packages/worker/src/activities/linear.activities.ts
import { LinearClient } from '@devflow/sdk/src/linear/linear.client';

// ✅ Good: Import from public API
import { LinearClient } from '@devflow/sdk';
```

#### DON'T: Import API Services in Worker
```typescript
// ❌ Bad: packages/worker/src/activities/spec.activities.ts
import { SpecGenerationService } from '@devflow/api/src/tasks/spec-generation.service';

// This fails because API has NestJS decorators
// Move shared logic to SDK instead
```

---

## Decision Records

### ADR-001: NestJS Only in API Layer

**Date:** December 8, 2025
**Status:** Accepted

**Context:**
Workers were failing to build when importing services with NestJS decorators. The decorator metadata and DI container aren't needed outside HTTP context.

**Decision:**
1. Keep NestJS exclusively in `@devflow/api`
2. Move all reusable services to `@devflow/sdk` as plain TypeScript
3. Workers and CLI import from SDK, never from API

**Consequences:**
- ✅ Workers build cleanly with tsx/esbuild
- ✅ SDK is reusable across API, workers, CLI
- ✅ Simpler testing (no framework mocks needed)
- ⚠️ API services need to instantiate SDK classes manually
- ⚠️ Loss of NestJS DI benefits for SDK services

**Implementation:**
- Moved OAuth services from API to SDK (December 8, 2025)
- Moved RAG services to SDK (December 8, 2025)
- Updated all worker imports to use public SDK API

---

### ADR-002: Public SDK Exports Only

**Date:** December 8, 2025
**Status:** Accepted

**Context:**
Workers were importing from internal SDK paths like `@devflow/sdk/src/rag/indexing/repository-indexer`, causing coupling to SDK's internal structure.

**Decision:**
1. SDK exports everything through `src/index.ts`
2. Each SDK subdirectory has an `index.ts` that re-exports its public API
3. Consumers must import from `@devflow/sdk`, never from internal paths

**Consequences:**
- ✅ SDK can refactor internal structure freely
- ✅ Clear public API surface
- ✅ tsc-alias handles all path resolution
- ⚠️ Must maintain index.ts files when adding new exports

**Implementation:**
- Created index files for RAG subdirectories (indexing, retrieval, chunking, metrics)
- Updated SDK main index to export all modules
- Updated worker imports to use public API

---

## Future Guidelines

### Adding New SDK Services

When creating a new SDK service:

1. **Create plain TypeScript class**
   ```typescript
   // packages/sdk/src/notifications/email.service.ts
   export class EmailService {
     constructor(private readonly config: EmailConfig) {}

     async send(to: string, subject: string, body: string) {
       // Implementation
     }
   }
   ```

2. **Add to module index**
   ```typescript
   // packages/sdk/src/notifications/index.ts
   export { EmailService } from './email.service';
   export type { EmailConfig } from './email.types';
   ```

3. **Export from SDK main index**
   ```typescript
   // packages/sdk/src/index.ts
   export * from './notifications';
   ```

4. **Create factory function (optional but recommended)**
   ```typescript
   // packages/sdk/src/notifications/index.ts
   export function createEmailService(config: EmailConfig): EmailService {
     return new EmailService(config);
   }
   ```

### Adding New API Endpoints

When creating a new API endpoint:

1. **Create NestJS controller**
   ```typescript
   // packages/api/src/notifications/notifications.controller.ts
   @Controller('notifications')
   export class NotificationsController {
     @Post('send')
     async send(@Body() dto: SendEmailDto) {
       // Use SDK service
       const emailService = new EmailService(config);
       return emailService.send(dto.to, dto.subject, dto.body);
     }
   }
   ```

2. **If complex logic, create API service**
   ```typescript
   // packages/api/src/notifications/notifications.service.ts
   @Injectable()
   export class NotificationsService {
     private readonly emailService: EmailService;

     constructor(private readonly config: ConfigService) {
       this.emailService = new EmailService({
         apiKey: this.config.get('EMAIL_API_KEY'),
       });
     }

     async sendWelcomeEmail(userId: string) {
       // Complex orchestration logic here
       // Uses SDK service internally
     }
   }
   ```

3. **Keep orchestration in API, utilities in SDK**
   - API: Handles HTTP, validation, orchestration, database access
   - SDK: Handles external API calls, business logic, reusable utilities

### Adding New Worker Activities

When creating a new worker activity:

1. **Create plain async function**
   ```typescript
   // packages/worker/src/activities/notification.activities.ts
   import { EmailService } from '@devflow/sdk';

   export async function sendEmail(input: SendEmailInput): Promise<void> {
     const emailService = new EmailService({
       apiKey: process.env.EMAIL_API_KEY!,
     });

     await emailService.send(input.to, input.subject, input.body);
   }
   ```

2. **Import SDK services, never API services**
   ```typescript
   // ✅ Good
   import { EmailService } from '@devflow/sdk';

   // ❌ Bad - API has NestJS decorators
   import { NotificationsService } from '@devflow/api';
   ```

3. **Register activity in worker index**
   ```typescript
   // packages/worker/src/activities/index.ts
   export * from './notification.activities';
   ```

### Decision Checklist

Before writing new code, ask:

| Question | Answer | Action |
|----------|--------|--------|
| Does this handle HTTP requests? | YES | Put in API with NestJS |
| Does this handle HTTP requests? | NO | Continue checklist |
| Will workers or CLI need this? | YES | Put in SDK (plain TS) |
| Will workers or CLI need this? | NO | Can stay in API |
| Is this business logic/utilities? | YES | Put in SDK (plain TS) |
| Is this orchestration/coordination? | YES | OK in API with NestJS |
| Does this need database access? | YES | Can be API or SDK with Prisma |
| Is this a Temporal activity? | YES | Worker (plain TS) |
| Is this a Temporal workflow? | YES | Worker (plain TS) |

### Examples by Service Type

| Service Type | Location | Framework | Why |
|--------------|----------|-----------|-----|
| REST endpoint | API | NestJS | HTTP handling |
| Webhook handler | API | NestJS | HTTP handling + routing |
| OAuth flow endpoints | API | NestJS | HTTP redirects + session |
| Token encryption | SDK | Plain TS | ✅ Workers need tokens |
| Token storage | SDK | Plain TS | ✅ Shared by API + workers |
| Linear API client | SDK | Plain TS | ✅ Used by API + workers |
| GitHub API client | SDK | Plain TS | ✅ Used by API + workers + CLI |
| RAG indexing | SDK | Plain TS | ✅ Workers run indexing |
| RAG retrieval | SDK | Plain TS | ✅ Used by activities |
| Spec generation | Worker | Plain TS | Temporal activity |
| Code generation | Worker | Plain TS | Temporal activity |
| PR creation | Worker | Plain TS | Temporal activity |
| Temporal client | API | NestJS | Only API starts workflows |
| Temporal activities | Worker | Plain TS | ✅ Runs in worker process |
| CLI commands | CLI | oclif | ✅ Uses SDK directly |
| Database models | API | Prisma | Can be shared if needed |
| Logger utilities | Common | Plain TS | ✅ Used everywhere |
| Type definitions | Common | Plain TS | ✅ Shared types |

---

## Architecture Validation

### Build Verification

Verify the architecture is correct by checking builds:

```bash
# Build SDK (should succeed with no warnings)
pnpm --filter @devflow/sdk build

# Build worker (should succeed with no NestJS imports)
pnpm --filter @devflow/worker build

# Build API (can use NestJS freely)
pnpm --filter @devflow/api build

# Check for problematic imports in compiled output
grep -r "@devflow/sdk/src/" packages/worker/dist/ || echo "✅ Clean"
grep -r "@nestjs" packages/sdk/dist/ || echo "✅ Clean"
```

### Import Verification

Check that imports follow the rules:

```bash
# SDK should not import NestJS
grep -r "@nestjs" packages/sdk/src/ || echo "✅ Clean"

# Worker should not import from API
grep -r "@devflow/api" packages/worker/src/ || echo "✅ Clean"

# Worker should not import SDK internal paths
grep -r "@devflow/sdk/src/" packages/worker/src/ || echo "✅ Clean"

# CLI should not import from API
grep -r "@devflow/api" packages/cli/src/ || echo "✅ Clean"
```

---

## OAuth Architecture

### Overview

DevFlow implements OAuth 2.0 for secure, multi-tenant authentication with GitHub and Linear. Each project can have its own OAuth credentials, enabling true SaaS multi-tenancy.

### OAuth Implementation Layers

```
┌─────────────────────────────────────────────────────────────┐
│ API Layer (@devflow/api/src/auth)                          │
│ • AuthController - HTTP endpoints for OAuth flows          │
│ • NestJS services with @Injectable decorators              │
│ • Handles HTTP requests/responses, validation              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ imports SDK services
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ SDK Layer (@devflow/sdk/src/auth) - Plain TypeScript       │
│ • OAuthService - Core OAuth logic                          │
│ • TokenEncryptionService - AES-256-GCM encryption          │
│ • TokenStorageService - Database operations                │
│ • TokenRefreshService - Automatic token refresh            │
│ • OAuthResolverService - Resolve tokens for projects       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ used by
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Worker Layer (@devflow/worker/src/services)                │
│ • OAuth Context - Retrieves project OAuth tokens           │
│ • Activities use SDK OAuth services                        │
│ • No NestJS dependencies                                   │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

**OAuthApplication Model:**
- Stores per-project OAuth app credentials
- `clientSecret` encrypted with AES-256-GCM
- Supports multiple flow types: `device`, `authorization_code`
- One app per project per provider

**OAuthConnection Model:**
- Stores user OAuth tokens (refresh tokens)
- `refreshToken` encrypted with AES-256-GCM
- Automatic refresh when expired
- Tracks connection status and failures

### Supported OAuth Flows

#### 1. Authorization Code Flow (Linear)

**Best for:** Web applications with callback URLs

```
User → API /auth/linear/authorize → Linear OAuth Page
  ↓
User authorizes
  ↓
Linear → API /auth/linear/callback?code=xxx
  ↓
API exchanges code for tokens
  ↓
Tokens encrypted and stored in database
```

**Endpoints:**
- `POST /api/v1/auth/linear/authorize` - Get authorization URL
- `GET /api/v1/auth/linear/callback` - Handle OAuth callback

#### 2. Device Flow (GitHub)

**Best for:** CLI tools, headless environments

```
User → API /auth/github/device/initiate
  ↓
API → GitHub Device Flow API
  ↓
User gets: userCode (ABCD-1234) + verificationUri
  ↓
User visits GitHub + enters code
  ↓
API polls /auth/github/device/poll
  ↓
Tokens encrypted and stored in database
```

**Endpoints:**
- `POST /api/v1/auth/github/device/initiate` - Start device flow
- `POST /api/v1/auth/github/device/poll` - Poll for tokens

### Security Features

**1. Token Encryption (AES-256-GCM):**
```typescript
// All tokens encrypted before storage
const encrypted = await tokenEncryption.encrypt(refreshToken);
// Stored: { ciphertext, iv, authTag }
```

**2. Automatic Token Refresh:**
```typescript
// Tokens automatically refreshed before expiry
if (connection.expiresAt < Date.now() + 5 * 60 * 1000) {
  await tokenRefresh.refresh(connection);
}
```

**3. Per-Project Isolation:**
- Each project has isolated OAuth credentials
- Tokens never shared between projects
- Cascade delete on project deletion

**4. Refresh Failure Tracking:**
- Failed refreshes tracked in database
- Connection marked inactive after repeated failures
- Failure reasons logged for debugging

### OAuth Service Responsibilities

| Service | Location | Responsibilities |
|---------|----------|------------------|
| **AuthController** | API | HTTP endpoints, validation, responses |
| **OAuthService** | SDK | OAuth flows, token exchange, app management |
| **TokenEncryptionService** | SDK | Encrypt/decrypt tokens with AES-256-GCM |
| **TokenStorageService** | SDK | Database CRUD for apps & connections |
| **TokenRefreshService** | SDK | Automatic token refresh logic |
| **OAuthResolverService** | SDK | Resolve access tokens for projects |

### Worker OAuth Integration

**Workers use OAuth via SDK services:**

```typescript
// packages/worker/src/services/oauth-context.ts
import { OAuthResolverService } from '@devflow/sdk';

export async function getGitHubToken(projectId: string): Promise<string> {
  const resolver = new OAuthResolverService(prisma);
  return resolver.getAccessToken(projectId, 'GITHUB');
}

export async function getLinearToken(projectId: string): Promise<string> {
  const resolver = new OAuthResolverService(prisma);
  return resolver.getAccessToken(projectId, 'LINEAR');
}
```

**Activities use OAuth tokens:**

```typescript
// packages/worker/src/activities/vcs.activities.ts
import { GitHubProvider } from '@devflow/sdk';
import { getGitHubToken } from '@/services/oauth-context';

export async function createBranch(input: CreateBranchInput) {
  const token = await getGitHubToken(input.projectId);
  const github = new GitHubProvider({ token });
  return github.createBranch(input.owner, input.repo, input.branchName);
}
```

### API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/apps/register` | POST | Register OAuth app for project |
| `/auth/apps` | GET | List project's OAuth apps |
| `/auth/apps/:provider/delete` | POST | Delete OAuth app |
| `/auth/:provider/device/initiate` | POST | Start device flow (GitHub) |
| `/auth/:provider/device/poll` | POST | Poll for device flow tokens |
| `/auth/linear/authorize` | POST | Get Linear authorization URL |
| `/auth/linear/callback` | GET | Handle Linear OAuth callback |
| `/auth/connections` | GET | List project's OAuth connections |
| `/auth/:provider/disconnect` | POST | Revoke OAuth connection |
| `/auth/:provider/refresh` | POST | Force token refresh |

### Migration from Legacy Tokens

**Old Approach (Deprecated):**
```bash
# Hardcoded tokens in .env
GITHUB_TOKEN=ghp_xxx
LINEAR_API_KEY=lin_api_xxx
```

**New Approach (OAuth):**
```bash
# 1. Register OAuth app
POST /api/v1/auth/apps/register

# 2. Connect user via OAuth flow
POST /api/v1/auth/linear/authorize

# 3. Tokens stored encrypted in database per project
```

**Benefits:**
- ✅ Multi-tenant: Each project has own credentials
- ✅ Secure: Tokens encrypted in database
- ✅ Automatic: Token refresh handled automatically
- ✅ Revocable: Users can revoke access anytime
- ✅ Auditable: Track connection status and failures

### Documentation Links

- **Setup Guide:** [docs/LINEAR_OAUTH_SETUP.md](./docs/LINEAR_OAUTH_SETUP.md)
- **Multi-Tenant Architecture:** [docs/OAUTH_MULTITENANT.md](./docs/OAUTH_MULTITENANT.md)
- **API Reference:** [packages/api/src/auth/auth.controller.ts](./packages/api/src/auth/auth.controller.ts)
- **SDK Services:** [packages/sdk/src/auth/](./packages/sdk/src/auth/)

---

## Configuration Management

### Layered Configuration Architecture

DevFlow uses a **4-layer configuration system** that handles the constraints of Temporal workflows while maintaining type safety and validation.

```
┌─────────────────────────────────────────────────────────────┐
│                    Configuration Layers                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Layer 1: Environment Variables (process.env)         │  │
│  │ - Raw environment variables                           │  │
│  │ - Only accessible in: API, Activities, Worker Init   │  │
│  │ - NOT accessible in: Workflows                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Layer 2: Config Loaders (@devflow/common/config)     │  │
│  │ - loadConfig() - Loads all configuration             │  │
│  │ - validateConfig() - Validates at startup            │  │
│  │ - Zod schemas for type safety and validation         │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Layer 3: Runtime Config (passed to workflows)        │  │
│  │ - WorkflowConfig interface                            │  │
│  │ - Loaded at workflow start in WorkflowsService       │  │
│  │ - Passed via WorkflowInput                            │  │
│  │ - Type-safe, serializable                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Layer 4: Workflow Context (inside workflows)         │  │
│  │ - Extracted from WorkflowInput                        │  │
│  │ - Default fallbacks for all values                    │  │
│  │ - Pure TypeScript - no Node.js dependencies          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Usage by Context

#### API & Activities (process.env available)

```typescript
import { loadConfig } from '@devflow/common';

// In API bootstrap or activity function
const config = loadConfig();

// Access configuration
console.log(config.linear.statuses.specInProgress);
console.log(config.app.port);
```

#### Workflows (process.env NOT available)

```typescript
import type { WorkflowInput } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';

export async function myWorkflow(input: WorkflowInput) {
  // Extract config with fallback
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  // Use config throughout workflow
  await updateLinearTask({
    status: LINEAR_STATUSES.specInProgress,
  });
}
```

#### WorkflowsService (passes config to workflows)

```typescript
import { loadConfig, WorkflowConfig } from '@devflow/common';

export class WorkflowsService {
  private workflowConfig: WorkflowConfig;

  async onModuleInit() {
    const fullConfig = loadConfig();
    this.workflowConfig = {
      linear: {
        statuses: fullConfig.linear.statuses,
      },
    };
  }

  async start(dto: StartWorkflowDto) {
    await this.client.workflow.start('myWorkflow', {
      args: [{
        taskId: dto.taskId,
        config: this.workflowConfig, // Pass config
      }],
    });
  }
}
```

### Configuration Files

- **Config Loader:** `packages/common/src/config/config-loader.ts`
- **Workflow Config Types:** `packages/common/src/types/workflow-config.types.ts`
- **Usage in API:** `packages/api/src/main.ts` (validation at startup)
- **Usage in Workflows:** `packages/worker/src/workflows/*.workflow.ts`

### Key Principles

1. **Fail Fast** - Config validation at startup catches errors early
2. **Type Safety** - Zod schemas ensure runtime type correctness
3. **Clear Boundaries** - Obvious where config can/cannot be used
4. **Testability** - Easy to inject mock configs in tests
5. **Serializable** - Workflow configs must be JSON-serializable
6. **Defaults** - Workflows always have fallback defaults

---

## Summary

**The DevFlow architecture follows these core principles:**

1. **NestJS stays in API** - Decorators and DI only where HTTP is handled
2. **SDK is plain TypeScript** - No framework dependencies, reusable everywhere
3. **Workers are plain TypeScript** - Simple async functions using SDK
4. **Public API surface** - Import from `@devflow/sdk`, never internal paths
5. **Constructor injection** - Simple DI without framework magic
6. **Clear boundaries** - HTTP at edges, business logic in middle, utilities at core

**Benefits of this architecture:**

- ✅ **Maintainable** - Clear separation of concerns
- ✅ **Reusable** - SDK works in API, workers, CLI, tests
- ✅ **Testable** - No framework mocks needed for SDK
- ✅ **Deployable** - Workers bundle cleanly
- ✅ **Flexible** - Easy to add new providers, services, activities
- ✅ **Scalable** - Each package can scale independently

**The golden rule remains:**

> **"If workers or CLI need it, it must be plain TypeScript in SDK."**

---

**Last Updated:** December 8, 2025
**Maintained By:** DevFlow Team
**Questions?** See [DOCUMENTATION.md](./DOCUMENTATION.md) or [CLAUDE.md](./CLAUDE.md)
