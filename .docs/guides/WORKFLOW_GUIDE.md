# DevFlow Workflow Guide

Complete guide to the three-phase Agile workflow and advanced features.

## Three-Phase Agile Workflow

DevFlow implements a three-phase workflow for transforming Linear tasks into deployable code.

```
Phase 1: Refinement    → Clarify requirements, estimate complexity
Phase 2: User Story    → Formal user story with acceptance criteria
Phase 3: Technical Plan → Architecture decisions, implementation steps
```

**Important:** Phases do NOT auto-chain. Each phase must be manually triggered by moving the issue to the corresponding "To X" status.

---

## Phase 1: Refinement

**Trigger Status:** `To Refinement`
**Output Status:** `Refinement Ready` or `Refinement Failed`

### What It Does

1. Detects task type (feature, bug, enhancement, chore)
2. Clarifies business context and objectives
3. Identifies ambiguities and questions for Product Owner
4. Proposes splitting if story is too large
5. Estimates complexity (T-shirt sizing: XS, S, M, L, XL)
6. Generates preliminary acceptance criteria

### Output

Refinement markdown appended to Linear issue description.

### Context Documents Created

Phase 1 creates two Linear documents for each issue:

| Document | Content | Usage |
|----------|---------|-------|
| **Codebase Context** | Relevant source code via RAG | File names in Phase 1, full content in Phases 2 & 3 |
| **Documentation Context** | Project config, dependencies, docs | Full content in all phases |

---

## Phase 2: User Story

**Trigger Status:** `To User Story`
**Output Status:** `UserStory Ready` or `UserStory Failed`

### What It Does

1. Transforms refined need into formal user story (As a, I want, So that)
2. Defines detailed, testable acceptance criteria
3. Creates Definition of Done
4. Evaluates business value
5. Estimates complexity in story points (Fibonacci: 1, 2, 3, 5, 8, 13, 21)

### Output

User story markdown in Linear document.

### Sub-Issue Creation

If Phase 1 suggested splitting the task (L/XL complexity):
- Sub-issues are automatically created in Linear
- Dependencies between sub-issues are preserved
- Parent becomes an epic container
- Each sub-issue starts at `To Refinement`

---

## Phase 3: Technical Plan

**Trigger Status:** `To Plan`
**Output Status:** `Plan Ready` or `Plan Failed`

### What It Does

1. Analyzes codebase with RAG (Retrieval Augmented Generation)
2. Defines architecture and technical decisions
3. Lists files to modify
4. Creates detailed implementation steps
5. Defines testing strategy
6. Identifies technical risks

### Output

Technical plan markdown in Linear document.

### LLM Council (Optional)

When `ENABLE_COUNCIL=true`, Phase 3 uses a 3-stage deliberation:

1. **Collect Responses** - Query all council models in parallel
2. **Peer Rankings** - Each model evaluates and ranks responses
3. **Chairman Synthesis** - Best insights combined into final output

```bash
# Enable council for Phase 3
ENABLE_COUNCIL=true
COUNCIL_MODELS=anthropic/claude-sonnet-4,openai/gpt-4o,google/gemini-2.0-flash-exp
COUNCIL_CHAIRMAN_MODEL=anthropic/claude-sonnet-4
```

---

## Parent-Child Issue Management

DevFlow automatically manages parent-child relationships for epics.

### Cascade: Parent → Children

When a parent issue moves to `To User Story` or `To Plan`:

```
Parent: "Refinement Ready" → "To User Story"
        ↓ [Automatic Cascade]
Child 1: → "To User Story" (workflow starts)
Child 2: → "To User Story" (workflow starts)
Child 3: → "To User Story" (workflow starts)
```

- Child workflows start in **parallel**
- Parent workflow is **skipped** (it's just a container)
- Children already at the target status are ignored

### Rollup: Children → Parent

When a child completes a phase (reaches a "Ready" status):

```
Child 1: "UserStory Ready"  (rank 7)
Child 2: "UserStory Ready"  (rank 7)
Child 3: "Refinement Ready" (rank 3)  ← minimum
        ↓
Parent: "Refinement Ready" (rolled up to minimum)
```

The parent status always reflects the **least advanced** child.

### Status Hierarchy

```typescript
const statusOrder = [
  'To Refinement',           // rank 0
  'Refinement In Progress',  // rank 1
  'Refinement Failed',       // rank 2
  'Refinement Ready',        // rank 3
  'To User Story',           // rank 4
  'UserStory In Progress',   // rank 5
  'UserStory Failed',        // rank 6
  'UserStory Ready',         // rank 7
  'To Plan',                 // rank 8
  'Plan In Progress',        // rank 9
  'Plan Failed',             // rank 10
  'Plan Ready',              // rank 11
  'Done',                    // rank 12
];
```

---

## PO Questions & Answers

When refinement generates questions for the Product Owner:

```
1. Refinement generates questions
        ↓
2. DevFlow posts each question as Linear comment
        ↓
3. Issue status: "Refinement In Progress" (awaiting answers)
        ↓
4. PO replies to comments in Linear
        ↓
5. Webhook detects replies (parent comment match)
        ↓
6. Question marked as answered
        ↓
7. When all questions answered:
   - Workflow restarts automatically
   - Answers injected into context
   - Refinement regenerated with clarifications
```

### Question Tracking

Questions are tracked in the database:

```sql
TaskQuestion {
  id              String
  taskId          String
  question        String    -- Question text
  linearCommentId String    -- Linear comment ID
  answered        Boolean   -- Has PO replied?
  answerText      String?   -- PO's answer
  answeredAt      DateTime?
}
```

---

## Context Documents

### Codebase Context Document

**Content:** Source code extracted via RAG
- Files and functions similar to the task
- Relevance scores for each chunk
- Language and code type (class, function, etc.)

### Documentation Context Document

**Content:** Project configuration and relevant documentation
- Framework, language, package manager, main paths
- Production/dev dependencies
- Conventions and architectural patterns
- RAG-filtered documentation (*.md, docs/, README)

### Usage by Phase

| Phase | Codebase Context | Documentation Context |
|-------|------------------|----------------------|
| Phase 1 | Created (file names only in prompt) | Created + included in prompt |
| Phase 2 | Loaded, full content passed to AI | Loaded, full content passed to AI |
| Phase 3 | Loaded, full content passed to AI | Loaded, full content passed to AI |

---

## Configuration

### Status Configuration

All statuses are defined centrally in `@devflow/common`:

```typescript
import {
  getStatusRank,      // Get rank of a status
  isTriggerStatus,    // Check if triggers a workflow
  isCascadeStatus,    // Check if cascades to children
  isRollupStatus,     // Check if triggers parent rollup
  getStatusAtRank,    // Get status at a given rank
} from '@devflow/common';
```

### Environment Variables

See [ENV_VARIABLES.md](../ENV_VARIABLES.md) for Linear status configuration.

---

## Workflow Router

The main workflow (`devflowWorkflow`) routes to the appropriate sub-workflow:

| Trigger Status | Sub-workflow | Output Status |
|----------------|--------------|---------------|
| `To Refinement` | `refinementWorkflow` | `Refinement Ready` |
| `To User Story` | `userStoryWorkflow` | `UserStory Ready` |
| `To Plan` | `technicalPlanWorkflow` | `Plan Ready` |

---

## Key Files

### Workflows
- `packages/worker/src/workflows/devflow.workflow.ts` - Main router
- `packages/worker/src/workflows/phases/refinement.workflow.ts`
- `packages/worker/src/workflows/phases/user-story.workflow.ts`
- `packages/worker/src/workflows/phases/technical-plan.workflow.ts`

### Activities
- `packages/worker/src/activities/refinement.activities.ts`
- `packages/worker/src/activities/linear.activities.ts`

### Configuration
- `packages/common/src/types/workflow-config.types.ts`

---

**See also:**
- [ARCHITECTURE.md](../ARCHITECTURE.md) for system architecture
- [TESTING.md](./TESTING.md) for testing the workflow
