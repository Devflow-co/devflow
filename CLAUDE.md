# CLAUDE.md - DevFlow

**Version:** 1.14.0
**Mise à jour:** 8 décembre 2025
**Statut:** Production Ready

## Rappel agents (Claude + Cursor)
- Finir chaque tâche par une étape Documentation (code, infra, CI, scripts, data, tests).
- Mettre à jour les fichiers concernés : `DOCUMENTATION.md`, `ARCHITECTURE.md`, `CLAUDE.md`, README/notes du package impacté, scripts ou guides infra.
- Dans chaque PR, ajouter `Documentation: mise à jour (fichiers)` ou `Documentation: N/A (raison)`.
- Si un workflow/commande change, documenter l'usage, les prérequis et le rollback attendu.
- Si aucune doc n'est requise, l'indiquer explicitement avec justification dans la PR/Linear.

## Vue d'ensemble
DevFlow est un orchestrateur DevOps universel qui transforme automatiquement les tâches Linear en code déployé.

### Workflow principal
1. Créer une tâche dans Linear avec description
2. Analyse de la codebase via GitHub API
3. Génération de la spécification technique
4. Génération de code (frontend + backend)
5. Génération des tests (unitaires + E2E)
6. Création d'une Pull Request
7. Exécution CI/CD + auto-fix en boucle si échec
8. Déploiement d'une preview app
9. Merge automatique (si configuré)

## Architecture & monorepo
- API : NestJS (REST) - **NestJS only in API layer**
- Orchestration : Temporal.io
- Base de données : PostgreSQL 16 + Prisma ORM
- Cache : Redis 7
- Node.js >= 20, pnpm workspace

**⚠️ Architecture Rule:** NestJS decorators (@Injectable, @Module, @Controller) are used **only in @devflow/api**. SDK, worker, CLI and common packages are **plain TypeScript** to ensure reusability and clean builds. See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete guidelines.

```
devflow/
├── packages/
│   ├── api/              # API REST NestJS (port 3000)
│   ├── worker/           # Temporal workers
│   ├── sdk/              # SDK (VCS, CI, AI, Linear, codebase)
│   ├── cli/              # CLI oclif
│   ├── common/           # Types, utils, logger
│   └── observability/    # Metrics/Tracing/SLA
├── infra/                # Helm charts, manifestes K8s
├── config/               # Prometheus, Grafana, Tempo
└── docker-compose.yml    # Environnement dev
```

## Packages clés

### @devflow/api
- Endpoints : `/health`, `/projects`, `/tasks`, `/tasks/sync/linear`, `/webhooks/linear`, `/webhooks/github`, `/workflows/:id/start`.
- Dépendances : `@nestjs/*`, `@prisma/client`, `@temporalio/client`.

### @devflow/worker
- Workflow principal : `packages/worker/src/workflows/devflow.workflow.ts`.
- Activities clés : `syncLinearTask`, `updateLinearTask`, `appendSpecToLinearIssue`, `appendWarningToLinearIssue`, `generateSpecification`, `generateCode`, `generateTests`, `createBranch`, `commitFiles`, `createPullRequest`, `waitForCI`, `runTests`, `analyzeTestFailures`, `mergePullRequest`, `sendNotification`.

### @devflow/sdk
- **VCS** : GitHubProvider (13/13).
- **CI/CD** : GitHubActionsProvider (10/10).
- **Linear** : `LinearClient` - getTask, queryIssues, queryIssuesByStatus, updateStatus, updateDescription, appendToDescription, addComment.
- **AI** : AnthropicProvider, OpenAIProvider, OpenRouterProvider, Cursor (non implémenté).
- **Codebase analysis** : `structure-analyzer.ts`, `dependency-analyzer.ts`, `code-similarity.service.ts`, `documentation-scanner.ts`.
- **Gouvernance/Sécurité** : `policy.guard.ts`, `auto-merge.engine.ts`, `audit.logger.ts`, `security.scanner.ts`.

### @devflow/cli
- Commandes : `init`, `connect linear`, `connect github`, `status <task>`, `run <task> --step dev`, `doctor`.

### @devflow/common
- **Configuration** : `loadConfig()`, `validateConfig()` - Gestion centralisée de la configuration avec validation Zod
- **Types** : WorkflowInput, WorkflowConfig, DEFAULT_WORKFLOW_CONFIG
- **Règle importante** : Les workflows Temporal ne peuvent PAS accéder à `process.env`. La configuration doit être passée via `WorkflowInput`.

## Gestion de la Configuration

DevFlow utilise un système de configuration à 4 couches pour gérer les contraintes des workflows Temporal:

1. **process.env** - Variables d'environnement (API, Activities uniquement)
2. **loadConfig()** - Chargeur centralisé avec validation Zod
3. **WorkflowInput.config** - Configuration passée aux workflows
4. **Extraction dans workflows** - Config extraite avec fallback sur DEFAULT_WORKFLOW_CONFIG

**Usage:**
- **API/Activities:** `const config = loadConfig();`
- **Workflows:** `const config = input.config || DEFAULT_WORKFLOW_CONFIG;`
- **Validation au démarrage:** `validateConfig()` dans `main.ts`

Voir [ARCHITECTURE.md](./ARCHITECTURE.md#configuration-management) pour les détails complets.

## Workflows Temporal
`devflowWorkflow` orchestre Linear → Spec → Code → PR → CI → Merge avec auto-fix.

### Data Flow
```
Linear Webhook → API → Temporal Workflow
        ↓
    syncLinearTask
        ↓
    generateSpecification (Claude/GPT-4)
        ↓
    appendSpecToLinearIssue + appendWarningToLinearIssue
        ↓
    generateCode + generateTests
        ↓
    createBranch → commitFiles → createPullRequest
        ↓
    waitForCI (loop with auto-fix up to 3 attempts)
        ↓
    mergePullRequest
        ↓
    updateLinearTask (Done)
```

## Configuration rapide

### Variables d'environnement essentielles
```bash
# OAuth Token Encryption (REQUIRED)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
OAUTH_ENCRYPTION_KEY=<base64-string>

# Linear
LINEAR_WEBHOOK_SECRET=xxx
LINEAR_TRIGGER_STATUS=To Spec
LINEAR_NEXT_STATUS=Spec Ready

# AI Providers
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Database
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=devflow

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Configuration OAuth (par projet)

DevFlow utilise OAuth 2.0 pour se connecter à GitHub et Linear. Chaque projet peut avoir ses propres credentials OAuth.

**Documentation détaillée:**
- `docs/LINEAR_OAUTH_SETUP.md` - Guide setup Linear OAuth
- `docs/OAUTH_MULTITENANT.md` - Architecture multi-tenant OAuth

#### Étape 1: Enregistrer l'application OAuth

```bash
# Enregistrer une app Linear OAuth pour un projet
POST /api/v1/auth/apps/register
Content-Type: application/json

{
  "projectId": "your-project-id",
  "provider": "LINEAR",
  "clientId": "your-linear-client-id",
  "clientSecret": "your-linear-client-secret",
  "redirectUri": "http://localhost:3000/api/v1/auth/linear/callback",
  "scopes": ["read", "write", "issues:create", "comments:create"],
  "flowType": "authorization_code"
}

# Enregistrer une app GitHub OAuth (Device Flow)
POST /api/v1/auth/apps/register
Content-Type: application/json

{
  "projectId": "your-project-id",
  "provider": "GITHUB",
  "clientId": "your-github-client-id",
  "clientSecret": "your-github-client-secret",
  "redirectUri": "urn:ietf:wg:oauth:2.0:oob",
  "scopes": ["repo", "workflow", "read:user"],
  "flowType": "device"
}
```

#### Étape 2: Connecter l'utilisateur

**Linear (Authorization Code Flow):**
```bash
# 1. Obtenir l'URL d'autorisation
POST /api/v1/auth/linear/authorize
Body: {"projectId": "your-project-id"}

# 2. L'utilisateur visite l'URL et autorise

# 3. Callback automatique vers /api/v1/auth/linear/callback
```

**GitHub (Device Flow):**
```bash
# 1. Initier le Device Flow
POST /api/v1/auth/github/device/initiate
Body: {"projectId": "your-project-id"}

# Response: { "userCode": "ABCD-1234", "verificationUri": "https://github.com/login/device" }

# 2. L'utilisateur visite l'URL et entre le code

# 3. Poller pour obtenir les tokens
POST /api/v1/auth/github/device/poll
Body: {"deviceCode": "xxx", "projectId": "your-project-id"}
```

#### Étape 3: Vérifier la connexion

```bash
# Lister les connexions OAuth d'un projet
GET /api/v1/auth/connections?project=your-project-id

# Forcer le refresh d'un token
POST /api/v1/auth/linear/refresh
Body: {"projectId": "your-project-id"}

# Déconnecter un provider
POST /api/v1/auth/linear/disconnect
Body: {"projectId": "your-project-id"}
```

## Commandes utiles
- Installation : `pnpm install`
- Infra locale : `docker-compose up -d`
- Build : `pnpm build`
- API dev : `pnpm dev`
- Worker dev : `pnpm dev:worker`
- Tests : `pnpm test`
- DB : `pnpm db:migrate`

## Troubleshooting rapide
- `OAuth not configured` → Connecter OAuth pour le projet via `/api/v1/auth/{provider}/device/initiate`
- `Database connection failed` → `docker-compose up -d postgres`
- `Temporal not reachable` → `docker-compose up -d temporal`
- `Redis not connected` → `docker-compose up -d redis`
- Logs : `docker-compose logs -f api worker`

## Fichiers clés à consulter
- `ARCHITECTURE.md` (architecture & NestJS boundaries - **LIRE EN PREMIER**)
- `DOCUMENTATION.md` (documentation complète)
- `docs/LINEAR_OAUTH_SETUP.md` (guide setup Linear OAuth)
- `docs/OAUTH_MULTITENANT.md` (architecture multi-tenant OAuth)
- `packages/worker/src/workflows/devflow.workflow.ts` (workflow principal)
- `packages/sdk/src/linear/linear.client.ts` (Linear client)
- `packages/sdk/src/agents/agent.interface.ts` (interface AI agents)
- `packages/sdk/src/auth/` (OAuth services - token encryption, storage, refresh)
- `packages/api/src/auth/` (OAuth HTTP endpoints)
- `packages/api/prisma/schema.prisma` (schéma complet)
