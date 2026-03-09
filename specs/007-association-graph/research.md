# Research: Association Graph for Memory

**Feature**: 007-association-graph | **Date**: 2026-03-09

## Existing Codebase Analysis

### Reusable Components

| Component | Location | Reuse Decision | Notes |
|-----------|----------|---------------|-------|
| MemoryStore | `src/plugins/services/memory-store.ts` | EXTEND | Add EventBus emit after upsert; add `expand` param to search |
| Memory Plugin | `src/plugins/memory/index.ts` | EXTEND | Add 3 new tools + enhanced context provider |
| createLlmAdapter | `src/plugins/utils.ts` | REUSE | Use as-is for extraction LLM calls |
| EventBus | `src/core/kernel/event-bus.ts` | REUSE | Subscribe to `memory:upserted` event |
| PluginRegistrationContext | `src/plugin-sdk/index.d.ts` | REUSE | registerTool, registerService, contributeContextProvider |
| McpBridgeService pattern | `src/plugins/nodered/services/McpBridgeService.ts` | REUSE (pattern) | Follow same EventBus subscription + dispose pattern |

### Existing Patterns to Follow

| Pattern | Source | Application |
|---------|--------|-------------|
| Service class with init/dispose | McpBridgeService | AssociationGraph service |
| EventBus subscribe + unsubscribe | McpBridgeService | Upsert event subscription |
| Tool registration with Zod schemas | Memory plugin | 3 new tools |
| Context provider contribution | Memory plugin | Enhanced context with graph data |
| Debounced file I/O | FlowMetadataStore | JSONL persistence |
| JSONL file format | (new pattern) | graph.jsonl |

### Potential Conflicts

| Area | Risk | Mitigation |
|------|------|------------|
| MemoryStore modification | Breaking existing search API | Add optional `expand` param with default true; add `source` field to MemoryHit |
| Memory plugin size | Plugin getting too large | AssociationGraph is a separate service class; plugin is thin wiring |
| LLM cost | Each upsert triggers extraction | Use fastest available model; keep prompt minimal |

## Technical Decisions

### Decision 1: Graph Service Architecture

- **Decision**: Standalone `AssociationGraph` service class in `src/plugins/services/association-graph.ts`
- **Existing code considered**: MemoryStore pattern (service with file I/O), McpBridgeService (event-driven service)
- **Reuse approach**: NEW (no existing graph structure) but follows established service patterns
- **Rationale**: Graph algorithms (BFS, Dijkstra) and JSONL persistence are new capabilities not found in codebase

### Decision 2: Upsert Hook Mechanism

- **Decision**: MemoryStore emits `memory:upserted` event via EventBus; graph service subscribes
- **Existing code considered**: McpBridgeService event subscription pattern, Hook system
- **Reuse approach**: REUSE EventBus pattern from McpBridgeService
- **Rationale**: EventBus is the canonical cross-plugin communication mechanism (architecture registry ADR anti-pattern: no direct cross-plugin imports)

### Decision 3: LLM Access for Extraction

- **Decision**: Use `createLlmAdapter(context)` with `noTools: true` for pure text completion
- **Existing code considered**: `createLlmAdapter` in `src/plugins/utils.ts`, `LlmCompletionInput` with `noTools` flag
- **Reuse approach**: REUSE existing LLM adapter
- **Rationale**: Canonical pattern; graceful null return if services unavailable

### Decision 4: Search Enhancement

- **Decision**: Modify `MemoryStore.search()` to accept optional `AssociationGraph` reference and `expand` flag
- **Existing code considered**: Current MemoryStore.search() returns `MemoryHit[]`
- **Reuse approach**: EXTEND MemoryStore
- **Rationale**: Must add `source` field to `MemoryHit` and graph-based expansion logic

### Decision 5: Context Provider Enhancement

- **Decision**: Extend existing `memory.context` provider to include graph associations
- **Existing code considered**: Current provider reads MEMORY.md + daily notes
- **Reuse approach**: EXTEND existing context provider
- **Rationale**: Single context provider with graph section appended; avoids duplicate providers

### Decision 6: JSONL Persistence

- **Decision**: Single JSONL file at `~/.slashbot/graph.jsonl` with type discriminator `t: "n" | "e"`
- **Existing code considered**: FlowMetadataStore (JSON file), MemoryStore (markdown files)
- **Reuse approach**: NEW (JSONL is a new persistence pattern for this project)
- **Rationale**: JSONL is append-friendly, human-readable, and enables full in-memory load on startup. Simpler than JSON for frequent small writes.
