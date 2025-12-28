# Getting Started with DevFlow

Quick guide to set up and run DevFlow locally.

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose
- PostgreSQL 15+ (via Docker)
- Redis 7+ (via Docker)

## Quick Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-org/devflow.git
cd devflow
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Generate required keys:

```bash
# OAuth encryption key
node -e "console.log('OAUTH_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"

# Session secret
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
```

Add the generated keys to your `.env` file.

**See:** [ENV_VARIABLES.md](../ENV_VARIABLES.md) for all configuration options.

### 3. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Temporal (port 7233)
- Temporal UI (http://localhost:8080)
- Qdrant (port 6333)
- Mailpit (http://localhost:8025 - for dev emails)

### 4. Set Up Database

```bash
cd packages/api
pnpm db:push
pnpm db:generate
cd ../..
```

### 5. Build Packages

```bash
pnpm build
```

### 6. Start Development Servers

**Terminal 1 - API:**
```bash
pnpm --filter @devflow/api dev
```

**Terminal 2 - Worker:**
```bash
pnpm --filter @devflow/worker dev
```

**Terminal 3 - Web (optional):**
```bash
pnpm --filter @devflow/web dev
```

### 7. Verify Setup

```bash
# Check API health
curl http://localhost:3000/api/v1/health

# Expected: {"status":"ok","timestamp":"...","uptime":...}
```

## Service URLs

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Web Frontend | http://localhost:3001 |
| Temporal UI | http://localhost:8080 |
| Qdrant Dashboard | http://localhost:6333/dashboard |
| Prisma Studio | http://localhost:5555 (run `npx prisma studio`) |
| Mailpit (emails) | http://localhost:8025 |

## Next Steps

1. **Set up OAuth providers** - See [integrations/](../integrations/) for OAuth setup guides
2. **Create a project** - Use CLI: `devflow project:create`
3. **Connect Linear** - `devflow oauth:connect <project-id> linear`
4. **Test the workflow** - See [TESTING.md](./TESTING.md)

## Common Issues

### Port Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Database Connection Failed

```bash
# Restart PostgreSQL
docker-compose restart postgres

# Verify it's healthy
docker-compose ps
```

### Temporal Not Reachable

```bash
# Restart Temporal
docker-compose restart temporal

# Wait 30s for it to initialize
# Check UI at http://localhost:8080
```

**See:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more solutions.

---

**Next:** [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) to understand the three-phase workflow.
