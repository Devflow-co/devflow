# RAG System Documentation

DevFlow uses Retrieval-Augmented Generation (RAG) to provide relevant codebase context to AI during workflow phases.

## Overview

The RAG system analyzes and indexes your codebase, then retrieves relevant code snippets when generating refinements, user stories, and technical plans.

## Architecture

```
Codebase → Chunking → Embedding → Vector Store (Qdrant)
                                       ↓
AI Prompt ← Context Retrieval ← Similarity Search
```

## Phase Documents

The RAG implementation is documented across several phases:

| Phase | Document | Description |
|-------|----------|-------------|
| Phase 2 | [PHASE2_OPENROUTER_UPDATE.md](./PHASE2_OPENROUTER_UPDATE.md) | OpenRouter integration for embeddings |
| Phase 3 | [PHASE3_CHUNKING_INDEXING.md](./PHASE3_CHUNKING_INDEXING.md) | Code chunking and AST-based indexing |
| Phase 4 | [PHASE4_RETRIEVAL_SYSTEM.md](./PHASE4_RETRIEVAL_SYSTEM.md) | RAG retrieval system implementation |
| Phase 5 | [PHASE5_INTEGRATION.md](./PHASE5_INTEGRATION.md) | Integration with DevFlow workflows |
| Phase 6 | [PHASE6_TESTS_VALIDATION.md](./PHASE6_TESTS_VALIDATION.md) | Testing and validation strategies |
| Phase 7 | [PHASE7_MONITORING.md](./PHASE7_MONITORING.md) | Monitoring, metrics, and observability |

## Key Components

### SDK Services

- `RepositoryIndexer` - Indexes codebase into vector store
- `CodeChunker` - Splits code into semantic chunks
- `EmbeddingService` - Generates embeddings via OpenRouter
- `RetrievalService` - Retrieves relevant context
- `CodeSimilarityService` - Finds similar code patterns

### Context Documents

During Phase 1 (Refinement), two context documents are created:

1. **Codebase Context Document** - Relevant source code via RAG
2. **Documentation Context Document** - Project config and documentation

These documents are stored in Linear and loaded in subsequent phases.

## Configuration

```bash
# Qdrant vector store
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=devflow_codebase

# Embeddings (via OpenRouter)
OPENROUTER_API_KEY=sk-or-xxx
```

## Usage in Workflows

```typescript
// Phase 1: Refinement
const codeContext = await retrieveContext({
  projectId,
  query: issueDescription,
  topK: 10,
});

// Context is passed to AI for better understanding
const refinement = await generateRefinement({
  task,
  codebaseContext: codeContext,
  documentationContext: docContext,
});
```

---

**See:** [ARCHITECTURE.md](../ARCHITECTURE.md) for how RAG fits into the overall system.
