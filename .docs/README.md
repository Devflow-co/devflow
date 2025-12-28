# DevFlow Documentation

**Version:** 2.5.1 | **Updated:** December 28, 2025

Welcome to the DevFlow documentation. This index helps you navigate to the right documentation for your needs.

## Quick Links

| Need | Document |
|------|----------|
| **AI Agent Context** | [CLAUDE.md](../CLAUDE.md) |
| **Architecture Deep Dive** | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Getting Started** | [guides/GETTING_STARTED.md](./guides/GETTING_STARTED.md) |
| **Environment Variables** | [ENV_VARIABLES.md](./ENV_VARIABLES.md) |

---

## Documentation Structure

### Core Documentation

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Architecture decisions, NestJS boundaries, module design, OAuth architecture |
| [ARCHITECTURE_QUICK_REFERENCE.md](./ARCHITECTURE_QUICK_REFERENCE.md) | Quick decision trees for architecture choices |
| [ENV_VARIABLES.md](./ENV_VARIABLES.md) | All environment variables with descriptions |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |

### Guides

| File | Description |
|------|-------------|
| [guides/GETTING_STARTED.md](./guides/GETTING_STARTED.md) | Installation, prerequisites, quick setup |
| [guides/WORKFLOW_GUIDE.md](./guides/WORKFLOW_GUIDE.md) | Three-phase workflow, parent-child cascade, LLM Council |
| [guides/TROUBLESHOOTING.md](./guides/TROUBLESHOOTING.md) | Common errors and solutions |
| [guides/TESTING.md](./guides/TESTING.md) | Testing strategies, E2E tests, integration tests |

### Integrations

| File | Description |
|------|-------------|
| [integrations/LINEAR_OAUTH_SETUP.md](./integrations/LINEAR_OAUTH_SETUP.md) | Linear OAuth setup guide |
| [integrations/SENTRY_OAUTH_SETUP.md](./integrations/SENTRY_OAUTH_SETUP.md) | Sentry OAuth setup guide |
| [integrations/FIGMA_CONFIGURATION.md](./integrations/FIGMA_CONFIGURATION.md) | Figma integration and vision analysis |
| [integrations/OAUTH_MULTITENANT.md](./integrations/OAUTH_MULTITENANT.md) | Multi-tenant OAuth architecture |
| [integrations/OAUTH_SECURITY_SCALABILITY.md](./integrations/OAUTH_SECURITY_SCALABILITY.md) | OAuth security and scalability patterns |

### RAG System

| File | Description |
|------|-------------|
| [rag/README.md](./rag/README.md) | RAG system overview |
| [rag/PHASE2_OPENROUTER_UPDATE.md](./rag/PHASE2_OPENROUTER_UPDATE.md) | OpenRouter integration for embeddings |
| [rag/PHASE3_CHUNKING_INDEXING.md](./rag/PHASE3_CHUNKING_INDEXING.md) | Code chunking and AST-based indexing |
| [rag/PHASE4_RETRIEVAL_SYSTEM.md](./rag/PHASE4_RETRIEVAL_SYSTEM.md) | RAG retrieval system |
| [rag/PHASE5_INTEGRATION.md](./rag/PHASE5_INTEGRATION.md) | RAG integration with workflows |
| [rag/PHASE6_TESTS_VALIDATION.md](./rag/PHASE6_TESTS_VALIDATION.md) | Testing and validation |
| [rag/PHASE7_MONITORING.md](./rag/PHASE7_MONITORING.md) | Monitoring and metrics |

---

## By Role

### For AI Agents (Claude, Cursor)
Start with [CLAUDE.md](../CLAUDE.md) - concise reference for AI context.

### For Developers
1. [guides/GETTING_STARTED.md](./guides/GETTING_STARTED.md) - Setup your environment
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the codebase
3. [guides/WORKFLOW_GUIDE.md](./guides/WORKFLOW_GUIDE.md) - Learn the three-phase workflow

### For DevOps
1. [ENV_VARIABLES.md](./ENV_VARIABLES.md) - Configure the application
2. [guides/TROUBLESHOOTING.md](./guides/TROUBLESHOOTING.md) - Debug issues
3. [integrations/](./integrations/) - Set up OAuth providers

---

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

**Current Version:** 2.5.1
- User authentication with sessions
- Web frontend (Nuxt 3)
- Email verification
- Google/GitHub OAuth for user login
