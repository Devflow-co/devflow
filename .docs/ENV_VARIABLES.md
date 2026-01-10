# Environment Variables

Complete reference for all DevFlow environment variables.

## Required Variables

### OAuth Token Encryption

```bash
# REQUIRED - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
OAUTH_ENCRYPTION_KEY=<base64-string>
```

### Database

```bash
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow?schema=public
```

### Temporal

```bash
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=devflow
```

### Redis

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## AI Providers

### OpenRouter (Recommended)

```bash
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

### Anthropic (Direct)

```bash
ANTHROPIC_API_KEY=sk-ant-xxx
```

### OpenAI (Direct)

```bash
OPENAI_API_KEY=sk-proj-xxx
```

### Ollama (Local LLM - Phase 4)

```bash
# Ollama server URL (local or remote)
OLLAMA_BASE_URL=http://localhost:11434

# Code generation model (default: deepseek-coder:6.7b)
OLLAMA_CODE_MODEL=deepseek-coder:6.7b

# Embeddings model (for future use)
OLLAMA_EMBEDDINGS_MODEL=nomic-embed-text

# Request timeout (ms, default: 300000 = 5 minutes)
OLLAMA_TIMEOUT=300000

# Enable Ollama for Phase 4 (default: true when OLLAMA_BASE_URL is set)
ENABLE_OLLAMA=true
```

**Note:** Phase 4 uses Ollama by default for privacy-first code generation. No cloud fallback.

---

## Linear Integration

### Four-Phase Workflow Statuses

```bash
# Phase 1: Refinement
LINEAR_STATUS_TO_REFINEMENT=To Refinement
LINEAR_STATUS_REFINEMENT_IN_PROGRESS=Refinement In Progress
LINEAR_STATUS_REFINEMENT_READY=Refinement Ready
LINEAR_STATUS_REFINEMENT_FAILED=Refinement Failed

# Phase 2: User Story
LINEAR_STATUS_TO_USER_STORY=To User Story
LINEAR_STATUS_USER_STORY_IN_PROGRESS=UserStory In Progress
LINEAR_STATUS_USER_STORY_READY=UserStory Ready
LINEAR_STATUS_USER_STORY_FAILED=UserStory Failed

# Phase 3: Technical Plan
LINEAR_STATUS_TO_PLAN=To Plan
LINEAR_STATUS_PLAN_IN_PROGRESS=Plan In Progress
LINEAR_STATUS_PLAN_READY=Plan Ready
LINEAR_STATUS_PLAN_FAILED=Plan Failed

# Phase 4: Code Generation (v2.6.0)
LINEAR_STATUS_TO_CODE=To Code
LINEAR_STATUS_CODE_IN_PROGRESS=Code In Progress
LINEAR_STATUS_CODE_REVIEW=Code Review
LINEAR_STATUS_CODE_READY=Code Ready
LINEAR_STATUS_CODE_FAILED=Code Failed
```

### Webhook

```bash
LINEAR_WEBHOOK_SECRET=xxx
```

### Default Project (Optional)

```bash
DEFAULT_PROJECT_ID=your-project-id
```

---

## LLM Council (v2.2.0)

```bash
# Enable council deliberation (Phase 3 only)
ENABLE_COUNCIL=false

# Council member models (comma-separated)
COUNCIL_MODELS=anthropic/claude-sonnet-4,openai/gpt-4o,google/gemini-2.0-flash-exp

# Chairman model for synthesis
COUNCIL_CHAIRMAN_MODEL=anthropic/claude-sonnet-4

# Timeout per request (ms)
COUNCIL_TIMEOUT=120000
```

---

## Figma Integration

```bash
# Enable/disable AI analysis of screenshots
FIGMA_VISION_ENABLED=true

# AI model for vision analysis
FIGMA_VISION_MODEL=anthropic/claude-sonnet-4

# Max screenshots to analyze (cost control)
FIGMA_VISION_MAX_SCREENSHOTS=3

# Timeout per screenshot (ms)
FIGMA_VISION_TIMEOUT=30000
```

---

## User Authentication (v2.5.0)

### Session

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SESSION_SECRET=<base64-string>
```

### Google OAuth

```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/user-auth/google/callback
```

### GitHub OAuth (User Login)

```bash
GITHUB_USER_CLIENT_ID=xxx
GITHUB_USER_CLIENT_SECRET=xxx
GITHUB_USER_CALLBACK_URL=http://localhost:3000/api/v1/user-auth/github/callback
```

### Email (SMTP)

```bash
SMTP_HOST=localhost       # Use 'mailpit' in docker-compose
SMTP_PORT=1025
SMTP_FROM=noreply@devflow.local
SMTP_SECURE=false

# Optional for production:
# SMTP_USER=xxx
# SMTP_PASS=xxx
```

### Frontend

```bash
FRONTEND_URL=http://localhost:3001
```

---

## RAG System

```bash
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=devflow_codebase
```

---

## Supabase Storage

Used for avatar and logo uploads.

```bash
# Supabase project URL
SUPABASE_URL=https://xxx.supabase.co

# Service role key (server-side only, has full access)
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Storage bucket name
SUPABASE_BUCKET=devflow
```

**Setup Instructions:**
1. Create a Supabase project at https://supabase.com
2. Go to Project Settings > API to get URL and service key
3. Create a bucket named "devflow" in Storage
4. Configure bucket policies for public read access (optional)

---

## Application

```bash
# API port (default: 3000)
PORT=3000

# Log level
LOG_LEVEL=info

# Node environment
NODE_ENV=development
```

---

## Legacy Variables (Deprecated)

These variables are deprecated but still supported for backwards compatibility:

```bash
# Use OAuth instead of direct tokens
GITHUB_TOKEN=ghp_xxx          # DEPRECATED: Use OAuth
LINEAR_API_KEY=lin_api_xxx    # DEPRECATED: Use OAuth
```

---

## Example .env File

```bash
# Required
OAUTH_ENCRYPTION_KEY=<generate-this>
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow?schema=public
SESSION_SECRET=<generate-this>

# Infrastructure
TEMPORAL_ADDRESS=localhost:7233
REDIS_HOST=localhost
REDIS_PORT=6379
QDRANT_HOST=localhost
QDRANT_PORT=6333

# AI - Phases 1-3 (at least one required)
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# AI - Phase 4: Ollama (local LLM, privacy-first)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CODE_MODEL=deepseek-coder:6.7b
OLLAMA_TIMEOUT=300000

# Linear
LINEAR_WEBHOOK_SECRET=xxx

# User Auth (optional)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@devflow.local

# Frontend
FRONTEND_URL=http://localhost:3001

# Supabase Storage (for avatar/logo uploads)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_BUCKET=devflow
```

---

**See also:** [guides/GETTING_STARTED.md](./guides/GETTING_STARTED.md) for setup instructions.
