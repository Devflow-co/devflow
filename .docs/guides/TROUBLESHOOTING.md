# Troubleshooting Guide

Common issues and solutions for DevFlow.

## Infrastructure Issues

### Database Connection Failed

**Symptoms:** `ECONNREFUSED` or `Connection refused` errors

**Solutions:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Verify connection
psql $DATABASE_URL -c "SELECT 1"

# If container is unhealthy, recreate it
docker-compose down postgres
docker-compose up -d postgres
```

### Temporal Not Reachable

**Symptoms:** `Failed to connect to Temporal` or workflows not starting

**Solutions:**
```bash
# Check if Temporal is running
docker-compose ps temporal

# Restart Temporal (wait 30s after)
docker-compose restart temporal

# Check Temporal UI
open http://localhost:8080

# Check logs
docker-compose logs -f temporal
```

### Redis Not Connected

**Symptoms:** Token caching failures or session errors

**Solutions:**
```bash
# Check if Redis is running
docker-compose ps redis

# Restart Redis
docker-compose restart redis

# Test connection
redis-cli -h localhost -p 6379 PING
# Expected: PONG
```

---

## OAuth Issues

### "OAuth not configured"

**Cause:** No OAuth application registered for the project/provider.

**Solution:**
```bash
# Register OAuth app via CLI
devflow oauth:register <project-id> <provider>

# Or connect via API
POST /api/v1/auth/apps/register
```

### "OAuth connection inactive"

**Cause:** Token expired and refresh failed.

**Solution:**
```bash
# Test the integration
devflow integrations:test <project-id> --provider <provider>

# Force token refresh
POST /api/v1/auth/<provider>/refresh
Body: {"projectId": "your-project-id"}

# If still failing, reconnect
devflow oauth:connect <project-id> <provider>
```

### "Bad credentials" (GitHub)

**Cause:** Token invalid or revoked.

**Solutions:**
1. Check if token was revoked in GitHub settings
2. Reconnect: `devflow oauth:connect <project-id> github`
3. Verify scopes are correct: `repo`, `workflow`, `read:user`

---

## API Issues

### API Not Starting

**Symptoms:** Port already in use or startup errors

**Solutions:**
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 pnpm --filter @devflow/api dev
```

### OAUTH_ENCRYPTION_KEY Not Set

**Symptoms:** `OAUTH_ENCRYPTION_KEY is required` error

**Solution:**
```bash
# Generate key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env
OAUTH_ENCRYPTION_KEY=<generated-key>
```

---

## Workflow Issues

### Workflow Not Triggering

**Checklist:**
1. ✓ Worker is running (`pnpm --filter @devflow/worker dev`)
2. ✓ OAuth connections are active (`devflow oauth:status <project-id>`)
3. ✓ Linear webhook is configured
4. ✓ Issue status matches trigger status (e.g., `To Refinement`)
5. ✓ Check worker logs for errors

### Workflow Stuck

**Solutions:**
```bash
# Check Temporal UI for workflow status
open http://localhost:8080

# Look for failed activities
# Click on workflow → History → Look for red items

# Check worker logs
docker-compose logs -f worker
```

### Phase Output Not Appearing in Linear

**Possible causes:**
1. Linear OAuth token expired - refresh or reconnect
2. Insufficient permissions - check Linear app scopes
3. Activity failed - check Temporal UI for errors

---

## AI/LLM Issues

### "Rate limit exceeded"

**Cause:** Too many API calls to AI provider.

**Solutions:**
- OpenRouter: Check your credits at https://openrouter.ai/account
- Anthropic: Rate limits are per-minute, wait and retry
- Use a different model or provider

### "Insufficient credits"

**Solution:**
1. Add credits to your AI provider account
2. Or switch to a different provider in `.env`

---

## Build Issues

### TypeScript Errors

```bash
# Rebuild all packages
pnpm build

# If path alias issues
cd packages/sdk
pnpm build  # Runs tsc && tsc-alias
```

### "Cannot find module @devflow/sdk"

```bash
# Ensure packages are built
pnpm build

# Check symlinks
ls -la node_modules/@devflow/
```

---

## Logs

### View All Logs

```bash
# Docker services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f temporal
```

### Enable Debug Mode

```bash
# Set log level
export LOG_LEVEL=debug

# Restart services
pnpm --filter @devflow/api dev
```

### Temporal Workflow Logs

1. Open http://localhost:8080
2. Navigate to your workflow
3. Click "History" tab
4. Expand activities to see inputs/outputs

---

## Reset Everything

If all else fails:

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d

# Re-run migrations
cd packages/api
pnpm db:push
pnpm db:generate
cd ../..

# Rebuild
pnpm build
```

---

## Getting Help

1. Check logs: `docker-compose logs -f api worker`
2. Verify services: `docker-compose ps`
3. Check Temporal UI: http://localhost:8080
4. Review this guide for specific errors

**See also:**
- [GETTING_STARTED.md](./GETTING_STARTED.md) for setup
- [ENV_VARIABLES.md](../ENV_VARIABLES.md) for configuration
