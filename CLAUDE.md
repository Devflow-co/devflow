# CLAUDE.md - DevFlow

**Version:** 2.4.0
**Mise à jour:** 21 décembre 2025
**Statut:** Three-Phase Agile System + Context Documents + Parent-Child Cascade/Rollup + LLM Council - Production Ready

## Rappel agents (Claude + Cursor)
- Finir chaque tâche par une étape Documentation (code, infra, CI, scripts, data, tests).
- Mettre à jour les fichiers concernés : `DOCUMENTATION.md`, `ARCHITECTURE.md`, `CLAUDE.md`, README/notes du package impacté, scripts ou guides infra.
- Dans chaque PR, ajouter `Documentation: mise à jour (fichiers)` ou `Documentation: N/A (raison)`.
- Si un workflow/commande change, documenter l'usage, les prérequis et le rollback attendu.
- Si aucune doc n'est requise, l'indiquer explicitement avec justification dans la PR/Linear.

## Vue d'ensemble
DevFlow est un orchestrateur DevOps universel qui transforme automatiquement les tâches Linear en code déployé.

### Three-Phase Agile Workflow (v2.0)
DevFlow implémente un workflow Agile en trois phases distinctes pour une meilleure séparation des responsabilités:

#### Phase 1: Refinement (Affinage du backlog)
**Status:** `To Refinement` → `Refinement Ready` / `Refinement Failed`

1. Détecter le type de tâche (feature, bug, enhancement, chore)
2. Clarifier le contexte métier et les objectifs
3. Identifier les ambiguïtés et questions pour le Product Owner
4. Proposer un découpage si la story est trop grosse
5. Estimer la complexité (T-shirt sizing: XS, S, M, L, XL)
6. Générer des critères d'acceptation préliminaires

**Output:** Refinement markdown dans Linear

#### Phase 2: User Story (Story détaillée)
**Status:** `Refinement Ready` → `UserStory Ready` / `UserStory Failed`

1. Transformer le besoin raffiné en user story formelle (As a, I want, So that)
2. Définir les critères d'acceptation détaillés et testables
3. Créer la Definition of Done
4. Évaluer la valeur business
5. Estimer la complexité en story points (Fibonacci: 1,2,3,5,8,13,21)

**Output:** User story markdown dans Linear

#### Phase 3: Technical Plan (Plan d'implémentation)
**Status:** `UserStory Ready` → `Plan Ready` / `Plan Failed`

1. Analyser la codebase avec RAG (Retrieval Augmented Generation)
2. Définir l'architecture et les décisions techniques
3. Lister les fichiers à modifier
4. Créer les étapes d'implémentation détaillées
5. Définir la stratégie de tests
6. Identifier les risques techniques

**Output:** Plan technique détaillé dans Linear

### Context Documents (v2.4.0)

Phase 1 (Refinement) crée deux documents Linear attachés à chaque issue pour fournir du contexte aux phases suivantes:

#### 📂 Codebase Context Document
**Contenu:** Code source pertinent extrait via RAG (Retrieval-Augmented Generation)
- Fichiers et fonctions similaires à la tâche
- Score de pertinence pour chaque chunk
- Langage et type de code (class, function, etc.)

**Utilisation:**
| Phase | Comportement |
|-------|-------------|
| Phase 1 | Document **créé** (stocké), seuls les **noms de fichiers** dans le prompt |
| Phase 2 | Document **chargé**, contenu complet passé à l'IA |
| Phase 3 | Document **chargé**, contenu complet passé à l'IA |

#### 📚 Documentation Context Document
**Contenu:** Configuration projet et documentation pertinente
- **Project Configuration:** Framework, langage, package manager, paths principaux
- **Technical Stack:** Dépendances production/dev, librairies principales
- **Documentation:** Conventions, patterns architecturaux, extraits README/CLAUDE.md
- **Relevant Docs:** Documentation RAG filtrée (*.md, docs/, README, ARCHITECTURE)

**Utilisation:**
| Phase | Comportement |
|-------|-------------|
| Phase 1 | Document **créé** + contenu **inclus** dans le prompt IA |
| Phase 2 | Document **chargé**, contenu complet passé à l'IA |
| Phase 3 | Document **chargé**, contenu complet passé à l'IA |

#### Linear Issue Structure
```
Linear Issue (STU-54)
├── Description: Requête originale + Refinement
└── Documents:
    ├── 📂 STU-54 - Codebase Context       (Phase 1) - Code pertinent
    ├── 📚 STU-54 - Documentation Context  (Phase 1) - Stack & Docs
    ├── 📄 STU-54 - User Story             (Phase 2)
    ├── 📄 STU-54 - Best Practices         (Phase 3)
    └── 📄 STU-54 - Technical Plan         (Phase 3)
```

### Workflow Features (conservées pour référence future)
- Génération de code (frontend + backend)
- Génération des tests (unitaires + E2E)
- Création d'une Pull Request
- Exécution CI/CD + auto-fix en boucle si échec
- Déploiement d'une preview app
- Merge automatique (si configuré)

**Note:** Les phases Code/PR/CI/Merge seront ajoutées dans une version ultérieure.

## Architecture & monorepo
- API : NestJS (REST) - **NestJS only in API layer**
- Orchestration : Temporal.io
- Base de données : PostgreSQL 16 + Prisma ORM
- Cache : Redis 7
- Node.js >= 20, pnpm workspace

**⚠️ Architecture Rule:** NestJS decorators (@Injectable, @Module, @Controller) are used **only in @devflow/api**. SDK, worker, CLI and common packages are **plain TypeScript** to ensure reusability and clean builds. See [ARCHITECTURE.md](ARCHITECTURE.md) for complete guidelines.

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
- **Endpoints principaux** : `/health`, `/projects`, `/projects/:id/integrations` (GET/PUT), `/projects/:id/linear/setup-custom-fields` (POST), `/projects/:id/linear/teams` (GET), `/projects/:id/link-repository` (POST), `/tasks`, `/tasks/sync/linear`, `/webhooks/linear`, `/webhooks/github`, `/workflows/:id/start`
- **Endpoints OAuth** : `/auth/github/authorize` (POST), `/auth/github/callback` (GET), `/auth/linear/authorize` (POST), `/auth/linear/callback` (GET), `/auth/figma/authorize` (POST), `/auth/figma/callback` (GET), `/auth/sentry/authorize` (POST), `/auth/sentry/callback` (GET), `/auth/apps/register` (POST), `/auth/connections` (GET), `/auth/:provider/refresh` (POST), `/auth/:provider/disconnect` (POST)
- **Endpoints Intégrations** : `/integrations/test/:provider` (POST) - Teste la connexion OAuth et l'extraction de contexte pour GitHub, Linear, Figma, Sentry
- **Services** : `IntegrationsTestService` - Validation des connexions OAuth et contexte extraction pour tous les providers
- Dépendances : `@nestjs/*`, `@prisma/client`, `@temporalio/client`.

### @devflow/worker
- **Workflow principal** : `packages/worker/src/workflows/devflow.workflow.ts` - Router vers les sous-workflows
- **Sous-workflows (Three-Phase)** :
  - `packages/worker/src/workflows/phases/refinement.workflow.ts` - Phase 1
  - `packages/worker/src/workflows/phases/user-story.workflow.ts` - Phase 2
  - `packages/worker/src/workflows/phases/technical-plan.workflow.ts` - Phase 3
- **Activities Three-Phase** :
  - `generateRefinement`, `appendRefinementToLinearIssue`, **postQuestionsToLinear** (v2.3.0)
  - `generateUserStory`, `appendUserStoryToLinearIssue`, **createLinearSubtasks** (v2.3.0)
  - `generateTechnicalPlan`, `appendTechnicalPlanToLinearIssue`
- **Activities Context Documents** (v2.4.0):
  - `analyzeProjectContext` - Analyse structure projet, dépendances, documentation
  - `saveCodebaseContextDocument` - Sauvegarde le contexte code comme document Linear
  - `saveDocumentationContextDocument` - Sauvegarde le contexte documentation comme document Linear
  - `getPhaseDocumentContent` - Charge un document de phase (codebase_context, documentation_context, user_story, etc.)
- **Activities génériques** : `syncLinearTask`, `updateLinearTask`, `retrieveContext`, `sendNotification`, **addCommentToLinearIssue** (v2.3.0)
- **Activities legacy** (conservées) : `generateSpecification`, `generateCode`, `generateTests`, `createBranch`, `commitFiles`, `createPullRequest`, `waitForCI`, `runTests`, `analyzeTestFailures`, `mergePullRequest`

### @devflow/sdk
- **VCS** : `GitHubProvider` (13/13) - Legacy direct client. **GitHubIntegrationService** - OAuth-based service (recommended).
- **CI/CD** : `GitHubActionsProvider` (10/10).
- **Linear** : `LinearClient` - getTask, queryIssues, queryIssuesByStatus, updateStatus, updateDescription, appendToDescription, addComment, getCustomFields, createCustomField, getIssueCustomFields, updateIssueCustomField, getComments, getComment, **getIssueChildren** (v2.3.0), **updateMultipleIssuesStatus** (v2.3.0), **createSubIssue** (v2.3.0).
- **LinearSetupService** : `ensureCustomFields(teamId)`, `validateSetup(teamId)`, `getDevFlowFieldValues(issueId)` - Setup automatique des custom fields DevFlow.
- **LinearIntegrationService** : OAuth-based service - queryIssues, queryIssuesByStatus, getTask, getComments avec auto token refresh.
- **AI** : AnthropicProvider, OpenAIProvider, OpenRouterProvider, Cursor (non implémenté).
- **LLM Council** (Nouveau - v2.2.0): `CouncilService` - 3-stage deliberation system with peer ranking and chairman synthesis. See LLM Council section below.
- **Codebase analysis** : `structure-analyzer.ts`, `dependency-analyzer.ts`, `code-similarity.service.ts`, `documentation-scanner.ts`.
- **Linear Spec Formatter** (v2.4.0): `formatCodebaseContextDocument`, `formatDocumentationContextDocument` - Formatage markdown des documents de contexte.
- **Gouvernance/Sécurité** : `policy.guard.ts`, `auto-merge.engine.ts`, `audit.logger.ts`, `security.scanner.ts`.
- **Integration Services Pattern** (Nouveau - v2.1.0):
  - **GitHubIntegrationService** : getRepository, getIssue, getIssueComments, extractIssueContext - OAuth avec auto token refresh
  - **LinearIntegrationService** : queryIssues, queryIssuesByStatus, getTask, getComments - OAuth avec auto token refresh
  - **FigmaIntegrationService** : getFileMetadata, getFileComments, getDesignContext, getNodeImage - OAuth avec auto token refresh
  - **SentryIntegrationService** : getIssue, getIssueEvents, extractContext - OAuth avec auto token refresh
  - **Architecture** : Tous les services utilisent `ITokenResolver` pour la résolution automatique des tokens OAuth avec refresh et cache Redis

### @devflow/cli
- **Commandes Projet** : `init`, `project:create` (wizard complet), `project:list`, `project:show`
- **Commandes OAuth** : `oauth:register`, `oauth:connect` (GitHub, Linear, Figma, Sentry, GitHub Issues), `oauth:status`, `oauth:list`
- **Commandes Intégrations** : `integrations:show`, `integrations:configure`, `integrations:setup-linear`, `integrations:test` (Nouveau - v2.1.0) - Teste toutes les intégrations ou une spécifique (--provider github|linear|figma|sentry)
- **Commandes Workflow** : `workflow:start`, `workflow:status`
- **Commandes Configuration** : `config:linear`

### @devflow/common
- **Configuration** : `loadConfig()`, `validateConfig()` - Gestion centralisée de la configuration avec validation Zod
- **Types** : WorkflowInput, WorkflowConfig, DEFAULT_WORKFLOW_CONFIG
- **Status Helpers (v2.3.0)** : `getStatusRank()`, `isTriggerStatus()`, `isCascadeStatus()`, `isRollupStatus()`, `getStatusAtRank()` - Fonctions pour gérer la hiérarchie des statuts
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

## Workflows Temporal (Three-Phase)
Le workflow principal `devflowWorkflow` agit comme un router qui dirige vers le sous-workflow approprié selon le status Linear.

### Three-Phase Data Flow (No Auto-Chaining)
```
Each phase is triggered independently by moving the issue to a "To X" status.
Phases do NOT auto-chain - manual intervention required between phases.

Phase 1: To Refinement → refinementWorkflow → Refinement Ready (STOP)
                                                    ↓
                                          [Manual: move to "To User Story"]
                                                    ↓
Phase 2: To User Story → userStoryWorkflow → UserStory Ready (STOP)
                                                    ↓
                                          [Manual: move to "To Plan"]
                                                    ↓
Phase 3: To Plan → technicalPlanWorkflow → Plan Ready (STOP)
```

### Routing Logic
- `To Refinement` → `refinementWorkflow` (Phase 1) → `Refinement Ready`
- `To User Story` → `userStoryWorkflow` (Phase 2) → `UserStory Ready`
- `To Plan` → `technicalPlanWorkflow` (Phase 3) → `Plan Ready`

**Important:** Phases do NOT auto-chain. Each phase must be manually triggered by moving the issue to the corresponding "To X" status.

Chaque phase met à jour le status Linear et ajoute son output en markdown dans la description de l'issue.

---

## Parent-Child Issue Management (v2.3.0)

DevFlow gère automatiquement les relations parent-enfant dans Linear pour les epics et leurs sous-tâches.

### Cascade: Parent → Children

Quand une issue parent est déplacée vers "To User Story" ou "To Plan", le statut est automatiquement **cascadé** à tous ses enfants:

```
Parent: "Refinement Ready" → "To User Story"
                ↓
    [Cascade automatique]
                ↓
Child 1: → "To User Story" (workflow démarre)
Child 2: → "To User Story" (workflow démarre)
Child 3: → "To User Story" (workflow démarre)
```

**Comportement:**
- Les workflows des enfants démarrent en **parallèle**
- Le workflow du parent est **ignoré** (c'est juste un container/epic)
- Les enfants déjà au bon statut sont ignorés

### Rollup: Children → Parent

Quand un enfant termine une phase (atteint un statut "Ready" ou "Done"), le statut du parent est automatiquement mis à jour pour refléter le **minimum** (le moins avancé) de tous ses enfants:

```
Child 1: "UserStory Ready"  (rank 7)
Child 2: "UserStory Ready"  (rank 7)
Child 3: "Refinement Ready" (rank 3)  ← minimum
                ↓
Parent: "Refinement Ready" (rollup au minimum)
```

**Statuts qui déclenchent le rollup:**
- `Refinement Ready`
- `UserStory Ready`
- `Plan Ready`
- `Done`

### Configuration Centralisée des Statuts

Les statuts sont définis de manière centralisée dans `@devflow/common`:

```typescript
// packages/common/src/types/workflow-config.types.ts

DEFAULT_WORKFLOW_CONFIG.linear = {
  // Hiérarchie des statuts (du moins avancé au plus avancé)
  statusOrder: [
    'To Refinement',       // rank 0
    'Refinement In Progress',
    'Refinement Failed',
    'Refinement Ready',    // rank 3
    'To User Story',
    'UserStory In Progress',
    'UserStory Failed',
    'UserStory Ready',     // rank 7
    'To Plan',
    'Plan In Progress',
    'Plan Failed',
    'Plan Ready',          // rank 11
    'Done',                // rank 12
  ],

  workflow: {
    triggerStatuses: ['To Refinement', 'To User Story', 'To Plan'],
    cascadeStatuses: ['To User Story', 'To Plan'],
    rollupStatuses: ['Refinement Ready', 'UserStory Ready', 'Plan Ready', 'Done'],
  },
};
```

**Helper functions:**
```typescript
import {
  getStatusRank,      // Obtenir le rang d'un statut
  isTriggerStatus,    // Vérifie si déclenche un workflow
  isCascadeStatus,    // Vérifie si cascade aux enfants
  isRollupStatus,     // Vérifie si déclenche un rollup parent
  getStatusAtRank,    // Obtenir le statut à un rang donné
} from '@devflow/common';
```

---

## PO Questions & Answers (v2.3.0)

Quand le refinement génère des questions pour le Product Owner, DevFlow les poste en commentaires Linear et attend les réponses.

### Flux de Questions

```
1. Refinement génère des questions
        ↓
2. DevFlow poste chaque question en commentaire Linear
        ↓
3. Issue passe en "Refinement In Progress" (awaiting answers)
        ↓
4. PO répond aux questions (reply to comment)
        ↓
5. Webhook détecte la réponse (parent comment match)
        ↓
6. Question marquée comme répondue
        ↓
7. Quand toutes les questions sont répondues:
   - Workflow redémarre automatiquement
   - Réponses injectées dans le contexte
   - Refinement régénéré avec les clarifications
```

### Tracking en Base de Données

```prisma
model TaskQuestion {
  id              String    @id @default(cuid())
  taskId          String
  task            Task      @relation(fields: [taskId], references: [id])
  question        String    // Texte de la question
  linearCommentId String    @unique  // ID du commentaire Linear
  answered        Boolean   @default(false)
  answerText      String?   // Réponse du PO
  answerCommentId String?   // ID du commentaire de réponse
  answeredAt      DateTime?
  createdAt       DateTime  @default(now())
}
```

### Détection des Réponses

DevFlow détecte automatiquement les réponses du PO via le webhook Linear:
- Un nouveau commentaire est créé
- Le commentaire est une **réponse** (parent comment existe)
- Le parent comment correspond à une question DevFlow (via `linearCommentId`)

---

## Sub-Issue Creation from Refinement (v2.3.0)

Quand le refinement détecte qu'une tâche est trop complexe (L/XL), il peut proposer un **découpage automatique** en sous-tâches.

### Format du Suggested Split

```markdown
### 🔀 Suggested Split
**Reason:** Cette tâche couvre plusieurs domaines fonctionnels distincts...

**Proposed Stories:**
#### 1. Basic Login Authentication
Description de la sous-tâche...
**Dependencies:** None
**Acceptance Criteria:**
1. User can login with email/password
2. Invalid credentials show error message

#### 2. JWT Token Management
Description...
**Dependencies:**
- Depends on: Basic Login Authentication
**Acceptance Criteria:**
1. JWT tokens generated on successful login
2. Tokens expire after configured duration
```

### Comportement en Phase User Story

Si un `suggestedSplit` est présent dans le refinement:
1. **Création des sous-issues** dans Linear avec la relation parent
2. **Préservation des dépendances** entre sous-issues
3. **Statut initial:** `To Refinement` (chaque sous-issue passera par son propre cycle)
4. **Parent mis à jour:** `UserStory Ready` (devient un epic container)
5. **Commentaire ajouté** au parent expliquant le split avec liens vers les sous-issues

## Configuration rapide

### Variables d'environnement essentielles
```bash
# OAuth Token Encryption (REQUIRED)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
OAUTH_ENCRYPTION_KEY=<base64-string>

# Linear - Three-Phase Agile Workflow
LINEAR_WEBHOOK_SECRET=xxx

# Phase 1: Refinement
LINEAR_STATUS_TO_REFINEMENT=To Refinement
LINEAR_STATUS_REFINEMENT_IN_PROGRESS=Refinement In Progress
LINEAR_STATUS_REFINEMENT_READY=Refinement Ready
LINEAR_STATUS_REFINEMENT_FAILED=Refinement Failed

# Phase 2: User Story (requires separate "To User Story" status in Linear)
LINEAR_STATUS_TO_USER_STORY=To User Story
LINEAR_STATUS_USER_STORY_IN_PROGRESS=UserStory In Progress
LINEAR_STATUS_USER_STORY_READY=UserStory Ready
LINEAR_STATUS_USER_STORY_FAILED=UserStory Failed

# Phase 3: Technical Plan (requires separate "To Plan" status in Linear)
LINEAR_STATUS_TO_PLAN=To Plan
LINEAR_STATUS_PLAN_IN_PROGRESS=Plan In Progress
LINEAR_STATUS_PLAN_READY=Plan Ready
LINEAR_STATUS_PLAN_FAILED=Plan Failed

# AI Providers
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# LLM Council (v2.2.0) - 3-stage deliberation with peer ranking
ENABLE_COUNCIL=false  # Set to 'true' to enable council deliberation
COUNCIL_MODELS=anthropic/claude-sonnet-4,openai/gpt-4o,google/gemini-2.0-flash-exp
COUNCIL_CHAIRMAN_MODEL=anthropic/claude-sonnet-4
COUNCIL_TIMEOUT=120000

# Database
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=devflow

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional: Default project for webhooks
DEFAULT_PROJECT_ID=your-project-id
```

### Migration depuis le système legacy
Si vous utilisez l'ancien système single-phase (`To Spec` → `Spec Ready`), utilisez le script de migration:

```bash
# Dry run (preview changes)
LINEAR_API_KEY=xxx npx ts-node scripts/migrate-linear-statuses.ts --dry-run

# Execute migration
LINEAR_API_KEY=xxx npx ts-node scripts/migrate-linear-statuses.ts
```

### Configuration OAuth (par projet)

DevFlow utilise OAuth 2.0 pour se connecter à GitHub, Linear, Figma et Sentry. Chaque projet peut avoir ses propres credentials OAuth.

**Documentation détaillée:**
- `.docs/LINEAR_OAUTH_SETUP.md` - Guide setup Linear OAuth
- `.docs/SENTRY_OAUTH_SETUP.md` - Guide setup Sentry OAuth
- `.docs/OAUTH_MULTITENANT.md` - Architecture multi-tenant OAuth

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

# Enregistrer une app GitHub OAuth (Authorization Code Flow)
# Note: GitHub passe à Authorization Code Flow pour multi-tenant (v2.1.0)
POST /api/v1/auth/apps/register
Content-Type: application/json

{
  "projectId": "your-project-id",
  "provider": "GITHUB",
  "clientId": "your-github-client-id",
  "clientSecret": "your-github-client-secret",
  "redirectUri": "http://localhost:3000/api/v1/auth/github/callback",
  "scopes": ["repo", "workflow", "read:user", "read:org"],
  "flowType": "authorization_code"
}

# Enregistrer une app Sentry OAuth (Authorization Code Flow)
POST /api/v1/auth/apps/register
Content-Type: application/json

{
  "projectId": "your-project-id",
  "provider": "SENTRY",
  "clientId": "your-sentry-client-id",
  "clientSecret": "your-sentry-client-secret",
  "redirectUri": "http://localhost:3001/api/v1/auth/sentry/callback",
  "scopes": ["org:read", "project:read", "project:write", "event:read", "member:read"],
  "flowType": "authorization_code"
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

**GitHub (Authorization Code Flow):**
```bash
# 1. Obtenir l'URL d'autorisation
POST /api/v1/auth/github/authorize
Body: {"projectId": "your-project-id"}

# 2. L'utilisateur visite l'URL et autorise

# 3. Callback automatique vers /api/v1/auth/github/callback
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

## Configuration de l'Intégration Figma (v2.1.0)

DevFlow extrait automatiquement le contexte design de Figma pendant le refinement avec analyse AI des screenshots.

**Fonctionnalités:**
- ✅ Métadonnées de fichier et commentaires de design
- ✅ Screenshots de frames/composants
- ✅ Analyse AI des screenshots avec Claude Sonnet 4 (configurable)
- ✅ Validation des file keys avec messages d'erreur clairs
- ✅ Gestion d'erreurs robuste (404, 401, 429)

**Configuration Vision Analysis:**
```bash
# Activer/désactiver l'analyse AI des screenshots
FIGMA_VISION_ENABLED=true                      # true (défaut) ou false

# Choisir le modèle AI
FIGMA_VISION_MODEL=anthropic/claude-sonnet-4   # claude-sonnet-4 (défaut), claude-3.5-sonnet, gpt-4-turbo

# Limiter le nombre de screenshots analysés (contrôle des coûts)
FIGMA_VISION_MAX_SCREENSHOTS=3                 # 1-10, défaut: 3

# Timeout pour l'analyse par screenshot
FIGMA_VISION_TIMEOUT=30000                     # millisecondes, défaut: 30s
```

**Quick Start:**
```bash
# 1. Connecter OAuth Figma
devflow oauth:connect <project-id> figma

# 2. Tester la connexion
devflow integrations:test <project-id> --provider figma

# 3. Ajouter l'URL Figma dans une issue Linear
https://www.figma.com/file/<FILE_KEY>/Design?node-id=<NODE_ID>
```

**Format des File Keys:**
- 20-30 caractères alphanumériques (avec - ou _)
- Exemple valide: `TfJw2zsGB11mbievCt5c3n`
- Trouvez la file key dans l'URL Figma entre `/file/` et `/`

**Coûts et Performance:**
| Configuration | Coût AI | Temps | Qualité |
|---------------|---------|-------|---------|
| Vision désactivée | $0 | 5s | ⭐⭐⭐ |
| 1 screenshot (Sonnet 4) | $0.01-0.02 | 15s | ⭐⭐⭐⭐ |
| 3 screenshots (Sonnet 4) | $0.03-0.06 | 30s | ⭐⭐⭐⭐⭐ |

**Documentation complète:** `.docs/FIGMA_CONFIGURATION.md`

---

## LLM Council - Multi-Model Deliberation (v2.2.0)

DevFlow supports a 3-stage LLM Council deliberation system that improves output quality through peer review and chairman synthesis.

### How It Works

```
Stage 1: Collect Responses
  └─ Query all council models in parallel

Stage 2: Peer Rankings
  └─ Anonymize responses (Response A, B, C...)
  └─ Each model evaluates and ranks all responses
  └─ Calculate aggregate rankings

Stage 3: Chairman Synthesis
  └─ Chairman receives all responses + rankings
  └─ Synthesizes final answer combining best insights
```

### Configuration

```bash
# Enable council deliberation (replaces ENABLE_MULTI_LLM)
ENABLE_COUNCIL=true

# Council member models (comma-separated)
COUNCIL_MODELS=anthropic/claude-sonnet-4,openai/gpt-4o,google/gemini-2.0-flash-exp

# Chairman model for synthesis
COUNCIL_CHAIRMAN_MODEL=anthropic/claude-sonnet-4

# Timeout per request (ms)
COUNCIL_TIMEOUT=120000
```

### Features

- **Anonymized Peer Review**: Models evaluate responses labeled A, B, C to prevent bias
- **Aggregate Rankings**: Calculate average position across all peer evaluations
- **Chairman Synthesis**: Best-ranked insights combined into final output
- **Linear Summary**: Council deliberation results appended to Linear issues

### Linear Output Format

When council mode is enabled, a summary is appended to each phase output:

```markdown
---

## LLM Council Deliberation

> This output was generated through a 3-stage council deliberation process.

### Council Members
- claude-sonnet-4
- gpt-4o
- gemini-2.0-flash-exp
- **Chairman:** claude-sonnet-4

### Peer Rankings

| Rank | Model | Avg Position | Votes |
|------|-------|--------------|-------|
| 🥇 | claude-sonnet-4 | 1.33 | 3 |
| 🥈 | gpt-4o | 1.67 | 3 |
| 🥉 | gemini-2.0-flash-exp | 3.00 | 3 |

**Agreement Level:** 🟢 HIGH

**Top Ranked Model:** claude-sonnet-4

### Synthesis
Chairman (claude-sonnet-4) synthesized insights from 3 council members.
```

### Usage

Council is used **only in Phase 3 (Technical Plan)** when `ENABLE_COUNCIL=true`:
- Phase 1: Refinement → Single model (faster, less expensive)
- Phase 2: User Story → Single model (faster, less expensive)
- Phase 3: Technical Plan → **LLM Council** (better quality for critical technical decisions)

### Cost Considerations

Council mode (Phase 3 only) makes 3x API calls (Stage 1) + 3x ranking calls (Stage 2) + 1x synthesis call (Stage 3) = **7 API calls for Technical Plan**.

| Phase | Mode | API Calls | Cost |
|-------|------|-----------|------|
| Phase 1: Refinement | Single Model | 1 | $ |
| Phase 2: User Story | Single Model | 1 | $ |
| Phase 3: Technical Plan | Council (3 models) | 7 | $$$$ |
| **Total per workflow** | | **9** | **$$$$** |

### Key Files

- `packages/sdk/src/agents/council/council.service.ts` - Main service
- `packages/sdk/src/agents/council/ranking-parser.ts` - Ranking extraction
- `packages/sdk/src/agents/council/prompts/` - Stage 2 & 3 prompts
- `packages/common/src/types/council.types.ts` - TypeScript interfaces

---

## Tests d'intégration (v2.1.0)

DevFlow inclut un système complet de tests pour valider les connexions OAuth et l'extraction de contexte de tous les providers.

### Via la CLI (Recommandé)

**Tester toutes les intégrations:**
```bash
devflow integrations:test <project-id>
```

**Tester une intégration spécifique:**
```bash
devflow integrations:test <project-id> --provider github
devflow integrations:test <project-id> --provider linear
devflow integrations:test <project-id> --provider figma
devflow integrations:test <project-id> --provider sentry
```

**Résultat attendu:**
```
🧪 Testing Integration Connections

Project: your-project-id
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✔ Testing GitHub integration...
   Status: ✓ Connected
   Test: Successfully fetched repository information
   testRepo: facebook/react

✔ Testing Linear integration...
   Status: ✓ Connected
   Test: Successfully queried Linear issues
   issuesFound: 5

📊 Test Summary
   Total: 4
   Passed: 2
   Not Configured: 2
```

### Via l'API

**Endpoint:** `POST /api/v1/integrations/test/:provider`

```bash
# Tester GitHub
curl -X POST http://localhost:3000/api/v1/integrations/test/github \
  -H "Content-Type: application/json" \
  -d '{"projectId": "your-project-id"}'

# Réponse:
{
  "provider": "GITHUB",
  "status": "connected",
  "testResult": "Successfully fetched repository information",
  "details": {
    "testRepo": "facebook/react",
    "defaultBranch": "main"
  }
}
```

### Tests SDK (Développement)

Pour les développeurs, des tests manuels sont disponibles dans `packages/sdk/src/__manual_tests__/`:

```bash
# Test global de toutes les intégrations
DATABASE_URL="postgresql://..." \
PROJECT_ID="your-project-id" \
npx tsx src/__manual_tests__/test-all-integrations.ts

# Tests individuels
npx tsx src/__manual_tests__/test-github-integration.ts
npx tsx src/__manual_tests__/test-linear-integration.ts
npx tsx src/__manual_tests__/test-figma-integration.ts
npx tsx src/__manual_tests__/test-sentry-integration.ts
```

### Tests E2E (Validation complète)

Scripts de test end-to-end qui valident le système complet via la CLI:

```bash
# Test rapide des intégrations
./tests/e2e/test-integrations-e2e.sh <project-id>

# Setup complet interactif (création projet + OAuth + tests)
./tests/e2e/test-full-project-setup.sh
```

**Documentation complète:**
- `packages/sdk/src/__manual_tests__/README.md` - Tests SDK
- `tests/e2e/README.md` - Tests E2E

## Commandes utiles
- Installation : `pnpm install`
- Infra locale : `docker-compose up -d`
- Build : `pnpm build`
- API dev : `pnpm dev`
- Worker dev : `pnpm dev:worker`
- Tests : `pnpm test`
- DB : `pnpm db:migrate`

## Troubleshooting rapide
- `OAuth not configured` → Connecter OAuth pour le projet via `devflow oauth:connect <project-id> <provider>` ou `POST /api/v1/auth/{provider}/authorize`
- `OAuth connection inactive` → Tester avec `devflow integrations:test <project-id>` pour diagnostiquer
- `Integration test failed` → Vérifier les logs: `docker-compose logs -f api` et reconnecter si nécessaire
- `Database connection failed` → `docker-compose up -d postgres`
- `Temporal not reachable` → `docker-compose up -d temporal`
- `Redis not connected` → `docker-compose up -d redis`
- Logs : `docker-compose logs -f api worker`

## Fichiers clés à consulter

### Documentation
- `.docs/ARCHITECTURE.md` - Architecture & NestJS boundaries (**LIRE EN PREMIER**)
- `.docs/DOCUMENTATION.md` - Documentation complète
- `.docs/LINEAR_OAUTH_SETUP.md` - Guide setup Linear OAuth
- `.docs/SENTRY_OAUTH_SETUP.md` - Guide setup Sentry OAuth (Nouveau v2.1.0)
- `.docs/OAUTH_MULTITENANT.md` - Architecture multi-tenant OAuth

### Code source
- `packages/worker/src/workflows/devflow.workflow.ts` - Workflow principal
- `packages/worker/src/workflows/phases/` - Sub-workflows Three-Phase
- `packages/sdk/src/linear/linear.client.ts` - Linear client
- `packages/sdk/src/agents/agent.interface.ts` - Interface AI agents
- `packages/sdk/src/auth/` - OAuth services (token encryption, storage, refresh)
- `packages/api/src/auth/` - OAuth HTTP endpoints
- `packages/api/src/webhooks/webhooks.service.ts` - Webhook handling avec cascade/rollup (v2.3.0)
- `packages/api/src/linear/linear-sync-api.service.ts` - Linear sync avec cascade/rollup (v2.3.0)
- `packages/api/src/integrations/` - Integration controllers & services (Nouveau v2.1.0)
- `packages/common/src/types/workflow-config.types.ts` - Configuration centralisée des statuts (v2.3.0)
- `packages/api/prisma/schema.prisma` - Schéma complet (TaskQuestion model v2.3.0, documentationContextDocumentId v2.4.0)
- `packages/sdk/src/linear/spec-formatter.ts` - Formatage des documents Linear (Codebase Context, Documentation Context)

### Tests & validation
- `packages/sdk/src/__manual_tests__/` - Tests SDK des intégrations (Nouveau v2.1.0)
- `packages/sdk/src/__manual_tests__/README.md` - Guide des tests SDK
- `tests/e2e/` - Scripts de tests E2E (Nouveau v2.1.0)
- `tests/e2e/test-refinement-workflow.sh` - Test E2E du workflow refinement (v2.3.0)
- `tests/e2e/README.md` - Guide des tests E2E
