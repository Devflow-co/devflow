# Architecture Quick Reference

**For full details, see:** [../ARCHITECTURE.md](../ARCHITECTURE.md)

## The Golden Rule

> **"If workers or CLI need it, it must be plain TypeScript in SDK."**

## NestJS Boundary (Quick Decision Tree)

```
Does this code handle HTTP requests?
├─ YES → API with NestJS decorators ✅
└─ NO → Continue...
   ├─ Will workers or CLI need this?
   │  ├─ YES → SDK (plain TypeScript) ✅
   │  └─ NO → Can stay in API
   └─ Is this business logic?
      ├─ YES → SDK (plain TypeScript) ✅
      └─ NO (orchestration) → API with NestJS ✅
```

## Package Boundaries

| Package | Framework | Decorators | Can Import From |
|---------|-----------|------------|-----------------|
| `@devflow/api` | NestJS | ✅ YES | SDK, Common, Prisma |
| `@devflow/sdk` | None | ❌ NO | Common only |
| `@devflow/worker` | None | ❌ NO | SDK, Common, Prisma |
| `@devflow/cli` | oclif | ❌ NO | SDK, Common |
| `@devflow/common` | None | ❌ NO | Nothing (base) |

## Import Rules

### ✅ Correct

```typescript
// Import from public SDK API
import { LinearClient, GitHubProvider } from '@devflow/sdk';

// Plain TypeScript class with constructor injection
export class LinearClient {
  constructor(private config: LinearConfig) {}
}

// Factory function for easy instantiation
export function createLinearClient(config: LinearConfig) {
  return new LinearClient(config);
}
```

### ❌ Incorrect

```typescript
// ❌ Don't import SDK internal paths
import { LinearClient } from '@devflow/sdk/src/linear/linear.client';

// ❌ Don't use NestJS decorators in SDK/worker/CLI
@Injectable()
export class LinearClient { }

// ❌ Don't import API in worker
import { TasksService } from '@devflow/api';
```

## Examples by Use Case

### Adding a New Service

**If it's an external API client** (GitHub, Linear, Slack, etc.)
→ SDK (plain TypeScript)

**If it's HTTP endpoint logic**
→ API (NestJS)

**If it's a Temporal activity**
→ Worker (plain TypeScript, imports SDK)

**If it's a CLI command**
→ CLI (oclif, imports SDK)

### Adding New Functionality

| Feature | Location | Example |
|---------|----------|---------|
| New REST endpoint | API | `@Controller('emails')` |
| Email API client | SDK | `class EmailService` |
| Send email activity | Worker | `async function sendEmail()` |
| Email command | CLI | `class EmailCommand` |
| Email types | Common | `interface EmailConfig` |

## Verification Commands

```bash
# Build everything
pnpm build

# Check SDK has no NestJS
grep -r "@nestjs" packages/sdk/src/ || echo "✅ Clean"

# Check worker has no API imports
grep -r "@devflow/api" packages/worker/src/ || echo "✅ Clean"

# Check worker has no SDK internal imports
grep -r "@devflow/sdk/src/" packages/worker/src/ || echo "✅ Clean"

# Check compiled output
grep -r "@devflow/sdk/src/" packages/worker/dist/ || echo "✅ Clean"
```

## Common Mistakes

### Mistake 1: Using Decorators in SDK

```typescript
// ❌ Bad
import { Injectable } from '@nestjs/common';

@Injectable()
export class LinearClient { }
```

**Why?** Workers can't compile this. NestJS decorators only work in API.

**Fix:** Remove decorator, use plain class.

### Mistake 2: Importing SDK Internal Paths

```typescript
// ❌ Bad
import { LinearClient } from '@devflow/sdk/src/linear/linear.client';
```

**Why?** Couples to SDK internal structure, breaks with refactoring.

**Fix:** Import from public API.

```typescript
// ✅ Good
import { LinearClient } from '@devflow/sdk';
```

### Mistake 3: Importing API in Worker

```typescript
// ❌ Bad
import { TasksService } from '@devflow/api/src/tasks/tasks.service';
```

**Why?** API has NestJS decorators, worker can't compile this.

**Fix:** Move shared logic to SDK.

### Mistake 4: Putting Business Logic in API

```typescript
// ❌ Bad - API with complex business logic
@Injectable()
export class LinearService {
  async complexLinearLogic() {
    // 200 lines of business logic
  }
}
```

**Why?** Worker needs this logic too, but can't import API.

**Fix:** Move business logic to SDK, keep orchestration in API.

```typescript
// ✅ Good - SDK with business logic
export class LinearClient {
  async complexLinearLogic() {
    // 200 lines of business logic
  }
}

// ✅ Good - API orchestrates
@Injectable()
export class LinearService {
  private readonly linearClient: LinearClient;

  constructor(config: ConfigService) {
    this.linearClient = new LinearClient({ ... });
  }

  async handleRequest() {
    return this.linearClient.complexLinearLogic();
  }
}
```

## Quick Reference: What Goes Where?

| If you're writing... | Put it in... |
|---------------------|--------------|
| HTTP controller | API |
| HTTP guard/interceptor | API |
| Webhook handler | API |
| OAuth flow endpoint | API |
| Database query | API (Prisma service) |
| External API client | SDK |
| Business logic | SDK |
| Token encryption | SDK |
| RAG indexing | SDK |
| AI provider | SDK |
| Temporal workflow | Worker |
| Temporal activity | Worker |
| CLI command | CLI |
| Shared types | Common |
| Logger/utils | Common |

## Need Help?

1. Check [ARCHITECTURE.md](../ARCHITECTURE.md) for full guidelines
2. Check [CLAUDE.md](../CLAUDE.md) for development workflow
3. Check [DOCUMENTATION.md](../DOCUMENTATION.md) for complete docs
4. Use the decision tree above
5. When in doubt: **"If workers or CLI need it, SDK (plain TypeScript)"**

---

**Last Updated:** December 8, 2025
