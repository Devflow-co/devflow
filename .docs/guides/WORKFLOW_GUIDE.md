# DevFlow Workflow Guide

Complete guide to the four-phase Agile workflow and advanced features.

## Four-Phase Agile Workflow

DevFlow implements a four-phase workflow for transforming Linear tasks into deployable code.

```
Phase 1: Refinement     → Clarify requirements, estimate complexity
Phase 2: User Story     → Formal user story with acceptance criteria
Phase 3: Technical Plan → Architecture decisions, implementation steps
Phase 4: Code Generation → Automated code + draft PR (privacy-first, local LLM)
```

**Important:** Phases do NOT auto-chain. Each phase must be manually triggered by moving the issue to the corresponding "To X" status.

**Privacy-First:** Phase 4 uses Ollama (local LLM) by default. All code and data remain on-premise with no cloud fallback.

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

Technical plan markdown in Linear document with:
- Architecture decisions
- Implementation steps
- Files to affect (used by Phase 4)
- Testing strategy
- Risks and mitigations

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

## Phase 4: Code Generation (Privacy-First)

**Trigger Status:** `To Code`
**Output Status:** `Code Review` or `Code Failed`

### What It Does

1. Retrieves technical plan from Phase 3
2. Fetches full file contents from GitHub (for files listed in `filesAffected`)
3. **(V3)** Detects ambiguities and asks clarifying questions
4. Generates production-ready code using local LLM (Ollama)
5. **(V3)** Validates code in isolated container (lint, typecheck, tests)
6. **(V3)** Presents solution choices when validation fails with multiple fixes
7. **(V3)** Requests pre-PR approval (optional)
8. Creates a feature branch
9. Commits generated files
10. Creates a draft PR for human review

### Privacy-First Architecture

Phase 4 uses **Ollama** (local LLM) by default:
- All inference runs locally on your infrastructure
- No code or data sent to cloud services
- No cloud fallback - fails locally if Ollama unavailable

### V3 Interactive Features (Human-in-the-Loop)

Phase 4 V3 adds **interactive code generation** with human feedback:

#### 1. Ambiguity Detection (Pre-Generation)

Before generating code, the AI analyzes the technical plan for:
- **Architectural ambiguities** - Multiple valid implementation approaches
- **Missing specifications** - Details needed but not specified
- **Conflicting patterns** - Existing code that could conflict
- **Integration uncertainties** - Unclear how new code should integrate

When ambiguities are detected, a **clarification question** is posted to Linear as a comment with options for the developer to choose.

#### 2. Solution Choice (Post-Failure)

When generated code fails validation (lint, typecheck, tests), the AI:
- Analyzes the error and identifies root cause
- Determines if multiple valid fixes exist
- If yes, posts a **solution choice question** to Linear
- Developer picks the preferred approach

#### 3. Pre-PR Approval (Optional)

Before creating a PR, the workflow can:
- Generate a code preview showing all changes
- Post an **approval request** to Linear
- Wait for `APPROVE` or `REJECT:reason` response

### Question Response Format

Questions are posted as Linear comments. Developers respond by:

| Question Type | Response Format |
|---------------|-----------------|
| Clarification | `OPTION:A` or `OPTION:B` or free text |
| Solution Choice | `OPTION:A` or `OPTION:B` or free text |
| Approval | `APPROVE` or `REJECT:reason` |

### Timeout Behavior

Each question has a configurable timeout (default: 24 hours):
- **Clarification:** Uses AI-recommended option on timeout
- **Solution Choice:** Uses AI-recommended fix on timeout
- **Approval:** Auto-approves on timeout (creates draft PR)

### V3 Orchestrator Workflow (Up to 23 Steps)

```
Phase A: Setup (Steps 1-6)
├── Step 1: Sync task from Linear
├── Step 2: Update status → "Code In Progress"
├── Step 3: Get technical plan document
├── Step 4: Parse technical plan (filesAffected, steps)
├── Step 5: Get codebase context (RAG chunks)
└── Step 6: Fetch full files from GitHub

Phase B: Pre-Generation Analysis (V3 - Steps 7-9)
├── Step 7: Detect ambiguities in technical plan
├── Step 8: Post clarification question (if ambiguities)
└── Step 9: Wait for response signal (with timeout)

Phase C: Generation Loop (Steps 10-15)
├── Step 10: Generate code (Ollama - local LLM)
├── Step 11: Execute in container (lint, typecheck, test)
├── Step 12: Analyze failures (if failed)
├── Step 13: Detect multiple solutions (V3)
├── Step 14: Post solution choice question (if multiple)
└── Step 15: Wait for response signal (with timeout)

Phase D: Pre-PR Approval (V3 - Steps 16-18)
├── Step 16: Generate code preview
├── Step 17: Post approval question
└── Step 18: Wait for approval signal (with timeout)

Phase E: Commit & PR (Steps 19-21)
├── Step 19: Create branch
├── Step 20: Commit files
└── Step 21: Create draft PR

Phase F: Finalization (Steps 22-23)
├── Step 22: Update status → "Code Review"
└── Step 23: Log completion metrics
```

### Context Provided to AI

| Context Type | Source | Purpose |
|--------------|--------|---------|
| RAG Chunks | Qdrant | Code patterns and conventions |
| Full Files | GitHub API | Complete content of files to modify |
| Technical Plan | Linear Document | Architecture, steps, testing strategy |
| User Story | Linear Document | Acceptance criteria, business value |
| Human Responses | Linear Comments | Clarifications and choices (V3) |

### Output

- **Feature Branch:** `feat/<task-identifier>-<title-slug>`
- **Draft PR:** Requires human review before merge
- **PR includes:**
  - Summary of changes
  - Files modified/created
  - Link to Linear issue
  - Test plan checklist

### Configuration

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CODE_MODEL=deepseek-coder:6.7b
OLLAMA_TIMEOUT=300000

# Code Generation Features
ENABLE_AUTO_STATUS_UPDATE=true
REUSE_CODEBASE_CONTEXT=true
CREATE_DRAFT_PR=true

# V3 Interactive Features
ENABLE_AMBIGUITY_DETECTION=true      # Enable pre-generation analysis
ENABLE_SOLUTION_CHOICE=true          # Enable multi-solution handling
ENABLE_PRE_PR_APPROVAL=false         # Require approval before PR
CLARIFICATION_TIMEOUT_HOURS=24       # Timeout for clarification questions
SOLUTION_TIMEOUT_HOURS=24            # Timeout for solution choices
APPROVAL_TIMEOUT_HOURS=48            # Timeout for approval requests
```

### Human Review Required

Phase 4 always creates **draft PRs** to ensure:
- Human review before merging
- Code quality validation
- Security review
- Test verification

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
  'To Code',                 // rank 12  (Phase 4)
  'Code In Progress',        // rank 13  (Phase 4)
  'Code Failed',             // rank 14  (Phase 4)
  'Code Review',             // rank 15  (Phase 4)
  'Code Ready',              // rank 16  (Phase 4)
  'Done',                    // rank 17
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
| `To Refinement` | `refinementOrchestrator` | `Refinement Ready` |
| `To User Story` | `userStoryOrchestrator` | `UserStory Ready` |
| `To Plan` | `technicalPlanOrchestrator` | `Plan Ready` |
| `To Code` | `codeGenerationOrchestrator` | `Code Review` |

---

## Key Files

### Workflows
- `packages/worker/src/workflows/devflow.workflow.ts` - Main router
- `packages/worker/src/workflows/orchestrators/refinement.orchestrator.ts`
- `packages/worker/src/workflows/orchestrators/user-story.orchestrator.ts`
- `packages/worker/src/workflows/orchestrators/technical-plan.orchestrator.ts`
- `packages/worker/src/workflows/orchestrators/code-generation.orchestrator.ts` - Phase 4 V3
- `packages/worker/src/workflows/orchestrators/code-generation-v2.orchestrator.ts` - Modular version

### Code Generation Sub-Workflows (V2 Modular)
- `packages/worker/src/workflows/steps/code-generation/setup.workflow.ts` - Task sync & status
- `packages/worker/src/workflows/steps/code-generation/context-retrieval.workflow.ts` - Plan & context
- `packages/worker/src/workflows/steps/code-generation/ambiguity-detection.workflow.ts` - V3 analysis
- `packages/worker/src/workflows/steps/code-generation/generate-code.workflow.ts` - Ollama generation
- `packages/worker/src/workflows/steps/code-generation/container-validation.workflow.ts` - Lint/test
- `packages/worker/src/workflows/steps/code-generation/solution-detection.workflow.ts` - V3 multi-fix
- `packages/worker/src/workflows/steps/code-generation/pre-approval.workflow.ts` - V3 approval
- `packages/worker/src/workflows/steps/code-generation/commit-pr.workflow.ts` - Branch/PR
- `packages/worker/src/workflows/steps/code-generation/finalization.workflow.ts` - Status/metrics

### Workflow Signals (V3)
- `packages/worker/src/workflows/signals/code-question-response.signal.ts` - Human response signal

### Activities
- `packages/worker/src/activities/refinement.activities.ts`
- `packages/worker/src/activities/linear.activities.ts`
- `packages/worker/src/activities/code-generation.activities.ts` - Phase 4 (ambiguity/solution detection)
- `packages/worker/src/activities/interactive.activities.ts` - V3 question posting
- `packages/worker/src/activities/vcs.activities.ts` - Git operations

### AI Providers
- `packages/sdk/src/agents/ollama.provider.ts` - Local LLM (Phase 4)
- `packages/sdk/src/agents/openrouter.provider.ts` - Cloud LLM (Phases 1-3)

### AI Prompts (V3)
- `packages/sdk/src/agents/prompts/ambiguity-detection/` - Pre-generation analysis
- `packages/sdk/src/agents/prompts/solution-detection/` - Multi-solution handling

### Configuration
- `packages/common/src/types/workflow-config.types.ts`
- `packages/common/src/types/automation-config.types.ts`

### Database Schema
- `packages/api/prisma/schema.prisma` - `PendingCodeQuestion` model (V3)

---

**See also:**
- [ARCHITECTURE.md](../ARCHITECTURE.md) for system architecture
- [TESTING.md](./TESTING.md) for testing the workflow
- [ENV_VARIABLES.md](../ENV_VARIABLES.md) for Ollama configuration
