# CHANGELOG - DevFlow

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

