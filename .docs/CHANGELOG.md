# CHANGELOG - DevFlow

## [Unreleased]
### Added
- **Phase 4: Code Generation** - Automated code generation with local LLM (privacy-first)
  - OllamaProvider for local LLM inference (deepseek-coder:6.7b by default)
  - 9-step orchestrator workflow:
    1. Sync task from Linear
    2. Update status → "Code In Progress"
    3. Get technical plan document (Phase 3)
    4. Parse technical plan
    5. Get codebase context (RAG chunks)
    6. Fetch full file contents from GitHub (filesAffected)
    7. Generate code (Ollama with full context)
    8. Create branch + commit + draft PR
    9. Update status → "Code Review"
  - Full file context fetching from GitHub for accurate modifications
  - Draft PR creation with automatic Linear linking
  - Usage tracking for local LLM calls (analytics)
  - New Linear statuses: To Code, Code In Progress, Code Review, Code Ready, Code Failed
  - Docker Compose services for Ollama with model auto-pull

- **Analytics Module** - Usage metrics and cost tracking dashboard
  - Analytics API endpoints for organization usage data
  - Dashboard components: KPIs, cost trends, token usage, model distribution
  - Phase performance and workflow throughput charts
  - Quota indicators for plan limits

- **User Authentication Module** - Complete authentication system with email verification
  - UserAuthModule for handling authentication processes
  - Email verification and password reset functionalities
  - Session management with secure token generation
  - DTOs for user signup, login, and password management
  - Google and GitHub OAuth services for third-party authentication
  - Comprehensive unit and integration tests for authentication features
  - Docker and environment configurations for email service integration

- **User & Organization Settings** - Complete settings interface
  - User profile management (name, avatar, email)
  - Password change for non-SSO users
  - Organization settings (name, logo, billing email)
  - Team member management (invite, role change, remove)
  - Supabase Storage integration for avatar and logo uploads
  - Role-based access control (OWNER, ADMIN, MAINTAINER, VIEWER)
  - New pages: `/settings/profile`, `/settings/organization`
  - Settings links added to user dropdown menu in navbar

## [2.5.1] - 2025-12-28
### Changed
- **Documentation Reorganization** - Complete restructure of project documentation
  - Slimmed down `CLAUDE.md` from 914 to ~210 lines (optimized for AI agents)
  - Created `.docs/README.md` as documentation index
  - Created `.docs/ENV_VARIABLES.md` consolidating all environment variables
  - Created `.docs/guides/` directory with:
    - `GETTING_STARTED.md` - Quick setup guide
    - `WORKFLOW_GUIDE.md` - Three-phase workflow details
    - `TROUBLESHOOTING.md` - Common issues and solutions
    - `TESTING.md` - Testing strategies and commands
  - Moved OAuth docs to `.docs/integrations/`
  - Moved RAG PHASE docs to `.docs/rag/`
  - Created `.docs/rag/README.md` as RAG system overview
  - All documentation now in English
  - Removed redundant `DOCUMENTATION.md` (content distributed to specific guides)

## [2.5.0] - 2025-12-22
### Added
- **Linear Document Integration** - Create and link Linear documents
  - Document creation and issue linking support
  - Test utilities for document operations
  - SDK with document management capabilities
  - Manual tests for French issue creation and Perplexity integration
  - Updated worker activities for better context extraction and refinement

## [2.4.0] - 2025-12-21
### Fixed
- **Workflow Phase Continuation** - All phases can now continue after PO answers
  - Extended "In Progress" status acceptance to all phases (not just Refinement)
  - Phase 1 accepts: "To Refinement" or "Refinement In Progress"
  - Phase 2 accepts: "To User Story" or "UserStory In Progress"
  - Phase 3 accepts: "To Plan" or "Plan In Progress"
  - Fixes PO questions flow where answering all questions re-triggers workflow with answers

### Added
- **E2E Test Scripts** for PO questions feature
  - `answer-questions.ts` - Simulates PO answering questions via Linear API
  - `check-questions.ts` - Checks TaskQuestion database state
  - `simulate-answer-webhooks.ts` - Simulates Linear comment webhooks locally

## [2.3.0] - 2025-12-21
### Added
- **Parent-Child Issue Management** - Cascade and rollup support
  - Cascade: parent status automatically cascades to children ("To User Story" or "To Plan")
  - Rollup: parent status reflects minimum (least progressed) child status
  - Skip parent workflow when cascading (only children need processing)
- **Sub-Issue Creation from Refinement**
  - Parse `suggestedSplit` from refinement output in user-story workflow
  - Create sub-issues in Linear with dependencies preserved
  - Update parent to "UserStory Ready" as epic container
  - Add comment explaining split with sub-issue links
- **PO Questions Tracking**
  - TaskQuestion model to track questions posted to Linear
  - Detect PO answers via comment webhook (reply to question comment)
  - Mark questions as answered and track answer text
  - Re-trigger workflow when all questions answered
  - `awaitingPOAnswers` flag added to Task model
- **Centralized Status Configuration**
  - `statusOrder` in WorkflowConfig for status hierarchy (13 statuses)
  - `workflow` config with `triggerStatuses`, `cascadeStatuses`, `rollupStatuses`
  - Helper functions: `getStatusRank()`, `isTriggerStatus()`, `isCascadeStatus()`, `isRollupStatus()`, `getStatusAtRank()`
- **Linear Client Enhancements**
  - `getIssueChildren()` to fetch child issues
  - `updateMultipleIssuesStatus()` for parallel updates
  - `createSubIssue()` for sub-issue creation with parent reference
- **E2E Testing**
  - `test-refinement-workflow.sh/ts` for automated E2E testing
  - Updated `tests/e2e/README.md` with new test documentation

### Changed
- Removed hardcoded STATUS_HIERARCHY from linear-sync-api.service.ts
- Removed hardcoded status arrays from webhooks.service.ts

## [2.2.0] - 2025-12-19
### Added
- **LLM Council 3-Stage Deliberation System**
  - CouncilService with 3-stage deliberation (collect → rank → synthesize)
  - Ranking parser for anonymous label creation and aggregate rankings
  - Council types and configuration to @devflow/common
  - `formatCouncilSummaryAsMarkdown` for Linear output
  - Comprehensive unit tests (36 tests) for council service
- **New Environment Variables**
  - `ENABLE_COUNCIL=true` - enables council deliberation
  - `COUNCIL_MODELS` - comma-separated list of models
  - `COUNCIL_CHAIRMAN_MODEL` - chairman for synthesis

### Changed
- Updated refinement, user-story, and technical-plan activities to use council
- Replaced existing ENABLE_MULTI_LLM scoring approach with peer-ranking model

### Removed
- Deprecated spec-multi-llm.activities.ts

### Fixed
- Pre-existing test failures in SDK package

## [2.1.0] - 2025-12-15
### Added
- **Enhanced Figma Integration** - Validation, error handling, and configurable vision analysis
  - `getUserInfo()` method for OAuth connection testing
  - File key validation with clear error messages (20-30 alphanumeric chars)
  - Improved error handling for all API methods (404, 401, 403, 429)
  - `handleApiError()` helper for consistent error messages
- **Flexible Figma Configuration**
  - FigmaConfig schema with vision analysis settings
  - Configurable vision analysis (enable/disable, model selection, limits)
  - Environment variables: `FIGMA_VISION_ENABLED`, `FIGMA_VISION_MODEL`, `FIGMA_VISION_MAX_SCREENSHOTS`, `FIGMA_VISION_TIMEOUT`
  - Load and use configuration in context extraction activities
- **Comprehensive FIGMA_CONFIGURATION.md** guide (75+ pages)
- **Enhanced OAuth Integration Testing**
  - IntegrationsTestService for testing OAuth connections
  - New CLI commands for testing integrations
  - Manual tests for GitHub, Linear, Figma, and Sentry integrations

### Changed
- Updated `.env.example` with new Sentry and Figma OAuth integration details
- Enhanced `CLAUDE.md` with Figma configuration section

## [2.0.0] - 2025-12-14
### Added
- **Unified Integration Services Pattern** - Consistent external API interactions
  - New Figma, Sentry, and GitHub integration services
  - Better testability, reusability, and consistency across services
- **OAuth Security & Scalability Guide**
  - Cryptographically secure state generation
  - Timing-safe state comparison to mitigate CSRF and timing attacks
  - Production recommendations and best practices
- **Best Practices Integration**
  - Fetch and integrate best practices into technical plan generation

### Changed
- Architecture documentation updated to reflect version 1.1.0
  - New sections: Architecture Validation, OAuth Architecture, Configuration Management
  - Integration Services Pattern documentation
- Enhanced OAuth service with improved security
- Updated API and CLI modules with new integration services
- Enhanced project creation and Linear configuration commands
- Enhanced workflow configuration and agent imports

### Security
- Cryptographically secure state generation for OAuth
- Timing-safe state comparison to prevent timing attacks
- Improved OAuth token management

## [1.14.0] - 2025-12-13
### Added
- **Comment Synchronization** - Sync Linear comments to database
  - New `TaskComment` model in Prisma schema with author info and timestamps
  - `LinearClient.getComments(issueId)` - Get all comments for an issue
  - `LinearClient.getComment(commentId)` - Get a single comment by ID
  - `LinearComment` type exported from SDK
  - `LinearSyncApiService.syncCommentToDatabase()` - Sync single comment
  - `LinearSyncApiService.syncAllCommentsForIssue()` - Sync all comments for an issue
  - `LinearSyncApiService.createCommentInLinear()` - Create comment from DevFlow
  - `LinearSyncApiService.getTaskComments()` - Get comments from database
  - Auto-sync comments via webhooks on create/update events

### Changed
- Webhook response now includes `issueSynced` and `commentSynced` fields (replaces `autoSynced`)

## [1.13.0] - 2025-12-13
### Added
- Linear Custom Fields support in SDK (getCustomFields, createCustomField, getIssueCustomFields, updateIssueCustomField)
- LinearSetupService for automatic DevFlow custom fields creation (Figma URL, Sentry URL, GitHub Issue URL)
- API endpoints: POST /projects/:id/linear/setup-custom-fields, GET /projects/:id/linear/teams
- Task model enriched with figmaUrl, sentryUrl, githubIssueUrl fields
- CLI commands: integrations:show, integrations:configure, integrations:setup-linear
- OAuth support for Figma (Auth Code), Sentry (Auth Code), GitHub Issues (Device Flow)
- Complete project:create wizard with OAuth and Linear Custom Fields setup
- syncLinearTask now reads Custom Fields from Linear (priority) with description parsing fallback
- Context extraction activities for external integrations (context-extraction.activities.ts)

### Changed
- project:create transformed into complete setup wizard with --skip-oauth and --skip-integrations options
- oauth:connect extended to support 5 providers (GitHub, Linear, Figma, Sentry, GitHub Issues)

## [1.12.1] - 2025-12-06
- Ajout de la règle explicite pour agents Claude/Cursor : terminer chaque tâche par une mise à jour documentation et tracer l’état dans les PR.
- Harmonisation des métadonnées et rappels de documentation dans `DOCUMENTATION.md` et `CLAUDE.md`.

## [1.12.0] - 2025-11-01
- Support OpenAI GPT-4.
- Analyse de codebase via API GitHub (repository tree, languages, search, multiple files, fileExists).
- 6 langages de dépendances et 15+ frameworks détectés.
- Warning Notion automatisé, endpoint `link-repository`, optimisations de performances (génération, spec, code).

## [1.11.0]
- Initial release.

## [1.10.0]
- Ajout provider GitHub.

## [1.9.0]
- Ajout provider Anthropic.

