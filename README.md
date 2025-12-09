# DevFlow

**Universal DevOps orchestrator that transforms Linear tasks into deployed code**

[![GitHub](https://img.shields.io/badge/github-victorgambert/devflow-blue)](https://github.com/victorgambert/devflow)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## Overview

DevFlow is an intelligent DevOps orchestration platform that automatically transforms Linear issues into production-ready code, tests, and deployments. It leverages AI agents, semantic codebase analysis, and workflow automation to streamline the software development lifecycle.

### Key Features

- **Automated Code Generation**: Transform Linear tasks into production-ready code
- **Multi-LLM Support**: Parallel processing with Claude, GPT-4, Gemini, and more
- **Semantic Codebase Analysis**: RAG-powered code understanding and similarity search
- **CI/CD Integration**: Automatic PR creation, testing, and deployment
- **OAuth Multi-tenant**: Secure per-project authentication for GitHub and Linear
- **Workflow Orchestration**: Powered by Temporal.io for reliable execution
- **Budget & Governance**: Built-in cost controls and policy management

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

### Installation

```bash
# Clone the repository
git clone https://github.com/victorgambert/devflow.git
cd devflow

# Install dependencies
pnpm install

# Start infrastructure services
docker-compose up -d

# Run database migrations
pnpm db:migrate

# Start the API server
pnpm dev

# Start the Temporal worker (in another terminal)
pnpm dev:worker
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
# OAuth Token Encryption (REQUIRED)
OAUTH_ENCRYPTION_KEY=<base64-string>

# Linear Configuration
LINEAR_WEBHOOK_SECRET=xxx
LINEAR_TRIGGER_STATUS="To Spec"

# AI Provider (choose one or more)
OPENROUTER_API_KEY=sk-or-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Database
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow

# Temporal
TEMPORAL_ADDRESS=localhost:7233

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Architecture

DevFlow is built as a modern monorepo with clear separation of concerns:

```
devflow/
├── packages/
│   ├── api/              # NestJS REST API
│   ├── worker/           # Temporal workflow workers
│   ├── sdk/              # Core SDK (VCS, CI, AI, Linear, RAG)
│   ├── cli/              # Command-line interface
│   └── common/           # Shared types and utilities
├── .docs/                # Centralized documentation
├── infra/                # Infrastructure as code
└── docker-compose.yml    # Local development environment
```

**Important Architecture Rules:**
- NestJS decorators are **only** used in `@devflow/api`
- SDK, worker, CLI, and common packages are **plain TypeScript**
- Configuration is loaded centrally and passed to workflows
- Temporal workflows run in sandboxed environments

## Documentation

### Core Documentation
- **[CLAUDE.md](CLAUDE.md)** - Quick reference for AI agents (Claude/Cursor) - **Root level for auto-detection**
- **[ARCHITECTURE.md](.docs/ARCHITECTURE.md)** - Complete architecture guide
- **[DOCUMENTATION.md](.docs/DOCUMENTATION.md)** - Full technical documentation
- **[CHANGELOG.md](.docs/CHANGELOG.md)** - Version history

### Implementation Guides
- **[ARCHITECTURE_QUICK_REFERENCE.md](.docs/ARCHITECTURE_QUICK_REFERENCE.md)** - Quick architecture reference
- **[LINEAR_OAUTH_SETUP.md](.docs/LINEAR_OAUTH_SETUP.md)** - Setting up Linear OAuth
- **[OAUTH_MULTITENANT.md](.docs/OAUTH_MULTITENANT.md)** - Multi-tenant OAuth architecture
- **[TESTING_NEW_PROJECT_WORKFLOW.md](.docs/TESTING_NEW_PROJECT_WORKFLOW.md)** - Testing workflows

### Phase Documentation
- **[PHASE2_OPENROUTER_UPDATE.md](.docs/PHASE2_OPENROUTER_UPDATE.md)** - OpenRouter integration
- **[PHASE3_CHUNKING_INDEXING.md](.docs/PHASE3_CHUNKING_INDEXING.md)** - Code chunking & indexing
- **[PHASE4_RETRIEVAL_SYSTEM.md](.docs/PHASE4_RETRIEVAL_SYSTEM.md)** - RAG retrieval system
- **[PHASE5_INTEGRATION.md](.docs/PHASE5_INTEGRATION.md)** - System integration
- **[PHASE6_TESTS_VALIDATION.md](.docs/PHASE6_TESTS_VALIDATION.md)** - Testing & validation
- **[PHASE7_MONITORING.md](.docs/PHASE7_MONITORING.md)** - Monitoring & observability

## Workflow

The complete DevFlow workflow:

```
1. Create Linear issue with description
   ↓
2. Webhook triggers DevFlow
   ↓
3. Analyze codebase (RAG-powered)
   ↓
4. Generate technical specification (Multi-LLM)
   ↓
5. Generate code (frontend + backend)
   ↓
6. Generate tests (unit + E2E)
   ↓
7. Create Pull Request
   ↓
8. Run CI/CD with auto-fix loop
   ↓
9. Deploy preview environment
   ↓
10. Auto-merge (if configured)
```

## CLI Usage

```bash
# Initialize DevFlow in a project
devflow init

# Connect services
devflow connect linear
devflow connect github

# Check task status
devflow status <task-id>

# Run specific workflow step
devflow run <task-id> --step dev

# Health check
devflow doctor
```

## API Endpoints

### Core Endpoints
- `GET /health` - Health check
- `POST /projects` - Create project
- `GET /projects/:id` - Get project
- `POST /tasks/sync/linear` - Sync Linear tasks
- `POST /webhooks/linear` - Linear webhook receiver
- `POST /workflows/:id/start` - Start workflow

### OAuth Endpoints
- `POST /auth/apps/register` - Register OAuth app
- `POST /auth/linear/authorize` - Linear OAuth flow
- `POST /auth/github/device/initiate` - GitHub Device Flow
- `GET /auth/connections` - List OAuth connections

## Development

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @devflow/sdk build

# Type check
pnpm typecheck
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @devflow/sdk test

# Run E2E tests
pnpm test:e2e
```

### Monitoring

- **Temporal UI**: http://localhost:8080
- **Prisma Studio**: http://localhost:5555
- **API**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001

## Troubleshooting

### Common Issues

**OAuth not configured**
```bash
# Connect OAuth for your project
POST /api/v1/auth/{provider}/device/initiate
```

**Database connection failed**
```bash
docker-compose up -d postgres
```

**Temporal not reachable**
```bash
docker-compose up -d temporal
```

**Worker not processing**
```bash
# Check worker logs
docker-compose logs -f worker

# Restart worker
docker-compose restart worker
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Test additions or changes

## License

MIT License - see [LICENSE](./LICENSE) file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/victorgambert/devflow/issues)
- **Documentation**: [.docs folder](.docs/)
- **Email**: support@devflow.io

## Acknowledgments

Built with:
- [Temporal.io](https://temporal.io) - Workflow orchestration
- [NestJS](https://nestjs.com) - API framework
- [Prisma](https://prisma.io) - Database ORM
- [Anthropic Claude](https://anthropic.com) - AI code generation
- [Qdrant](https://qdrant.tech) - Vector database
- [Linear](https://linear.app) - Issue tracking

---

**Made with ❤️ by the DevFlow team**
