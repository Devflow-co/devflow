# DevFlow Utility Scripts

This directory contains utility scripts for DevFlow development and setup.

## Available Scripts

### `create-new-project.ts`

Interactive script to create a new DevFlow project with OAuth configuration.

**Purpose:** Streamlines the process of creating a new project in the database and registering OAuth applications for GitHub and Linear.

**Usage:**
```bash
cd /Users/victorgambert/Sites/DevFlow

DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" \
OAUTH_ENCRYPTION_KEY="$OAUTH_ENCRYPTION_KEY" \
npx ts-node scripts/create-new-project.ts
```

**What it does:**
1. Prompts for project details (name, description, repository)
2. Configures Linear settings (trigger status, next status)
3. Sets up AI provider configuration
4. Registers GitHub OAuth app (Device Flow)
5. Registers Linear OAuth app (Authorization Code Flow)
6. Provides next steps for OAuth connection

**Prerequisites:**
- `OAUTH_ENCRYPTION_KEY` environment variable set
- Database running and accessible
- Valid GitHub and Linear OAuth credentials (optional for testing)

**Output:**
- Creates Project record in database
- Creates OAuthApplication records for GitHub and Linear
- Displays project ID and next steps

### `migrate-imports.js`

Utility script to migrate relative imports to `@/*` path aliases across the monorepo.

**Purpose:** Converts relative imports (e.g., `../../utils/helper`) to path aliases (e.g., `@/utils/helper`) for cleaner, more maintainable imports.

**Usage:**
```bash
node scripts/migrate-imports.js
```

**What it does:**
1. Scans all TypeScript files in `packages/*/src/`
2. Identifies relative imports (`./` or `../`)
3. Converts them to `@/*` path aliases
4. Updates files in place

**Affected packages:**
- `packages/sdk`
- `packages/worker`
- `packages/api`
- `packages/common`

**Example transformation:**
```typescript
// Before
import { logger } from '../../common/logger';
import { Config } from '../config/types';

// After
import { logger } from '@/common/logger';
import { Config } from '@/config/types';
```

**Note:** This script modifies files in place. Ensure you have committed your changes before running.

## Script Guidelines

When adding new utility scripts to this directory:

1. **Naming:** Use descriptive kebab-case names (e.g., `setup-database.ts`, `check-dependencies.sh`)
2. **Shebang:** Include appropriate shebang line:
   - Node.js: `#!/usr/bin/env node`
   - TypeScript: `#!/usr/bin/env ts-node`
   - Bash: `#!/bin/bash`
3. **Documentation:** Add a comment block at the top explaining:
   - Purpose of the script
   - Usage instructions
   - Required environment variables
   - Prerequisites
4. **Make executable:** `chmod +x scripts/your-script.sh`
5. **Update this README:** Document the new script in this file

## Related Directories

- **`tests/`** - Test scripts (E2E, integration, unit tests)
- **`packages/*/scripts/`** - Package-specific scripts
- **`infra/`** - Infrastructure and deployment scripts

## Environment Variables

Common environment variables used by these scripts:

```bash
# Database
DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public"

# OAuth Security
OAUTH_ENCRYPTION_KEY="<base64-encoded-32-byte-key>"

# Generate encryption key:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Additional Resources

- [Complete Documentation](../.docs/DOCUMENTATION.md)
- [Testing Guide](../.docs/TESTING_NEW_PROJECT_WORKFLOW.md)
- [Architecture Documentation](../.docs/ARCHITECTURE.md)

---

**Last Updated:** December 9, 2025
