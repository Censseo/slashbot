# Tasks: Association Graph for Memory

**Input**: Design documents from `/specs/007-association-graph/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included per constitution (TDD principle).

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Project initialization — no new project setup needed (extending existing plugin)

- [X] T001 [NEW] Create `src/plugins/services/association-graph.ts` with AssociationGraph class skeleton (constructor, empty methods: `load()`, `flush()`, `addNode()`, `addEdge()`, `neighbors()`, `shortestPath()`, `slugify()`)
- [X] T002 [P] [NEW] Create `src/plugins/services/association-graph.test.ts` with test scaffolding and imports

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core graph data structure and persistence — blocks all user stories

- [X] T003 [EXTEND] Add `memory:upserted` event emission to `MemoryStore.upsert()` in `src/plugins/services/memory-store.ts` — after successful write, get EventBus via constructor injection or parameter, emit `{ text, tags, file, path, line }`
- [X] T004 Implement `GraphNode` and `GraphEdge` types and `BASE_RELATIONS` constant (related_to, uses, used_by, part_of, contains, depends_on, enables, contradicts, replaces, inspired_by, chosen_over, instance_of) in `src/plugins/services/association-graph.ts` — interfaces matching data-model.md (id, label, type, meta?, created for nodes; from, to, rel, weight, created for edges)
- [X] T005 Implement `slugify()` method: `label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')`
- [X] T006 Implement JSONL persistence — `load()`: read `~/.slashbot/graph.jsonl` line by line, parse each JSON object, skip malformed lines with warning, populate `nodes` Map and `edges`/`reverseEdges` Maps. `flush()`: serialize all nodes and edges to JSONL, write atomically with 0600 permissions
- [X] T007 Implement debounced flush — `scheduleDirtyFlush()`: after mutation, debounce 500ms before calling `flush()`. Use `setTimeout`/`clearTimeout` pattern
- [X] T008 [P] Implement `addNode()` — create or return existing node by slugified ID. Auto-set type to "concept" if not provided. Set created timestamp. Mark dirty
- [X] T009 [P] Implement `addEdge()` — create edge or reinforce existing (weight +0.1, cap 1.0). Initial weight 0.5. Composite key `(from, to, rel)`. Update both `edges` and `reverseEdges` Maps. Mark dirty
- [X] T010 Implement `neighbors()` — BFS traversal to configurable depth (1-3). Traverse both outgoing edges and incoming (reverseEdges). Optional type filter on result nodes. Return `{ id, label, type, rel, weight, direction: "outgoing"|"incoming" }[]`
- [X] T011 Implement `shortestPath()` — Dijkstra with inverted weights (1 - weight as cost). Traverse edges in both directions. Return ordered path `{ node, rel?, direction? }[]` or empty array
- [X] T012 [P] Write unit tests for `slugify()`, `addNode()`, `addEdge()` (creation, dedup, weight reinforcement) in `association-graph.test.ts`
- [X] T013 [P] Write unit tests for `neighbors()` (depth 1/2, type filter, bidirectional, unknown node) and `shortestPath()` (direct, multi-hop, no path) in `association-graph.test.ts`
- [X] T014 [P] Write unit tests for JSONL persistence (`load()`, `flush()`, malformed line handling) in `association-graph.test.ts`

---

## Phase 3: User Story 1 — Explore Related Concepts (P1)

**Goal**: Agent can call `memory.related` to find concepts connected to a topic
**Independent Test**: Populate graph, call tool, verify neighbors returned

- [X] T015 [US1] [EXTEND] Register `memory.related` tool in `src/plugins/memory/index.ts` — Zod schema: `{ concept: string, depth?: number (1-3), type?: string }`. Execute: slugify concept, call `graph.neighbors()`, return results as JSON
- [X] T016 [US1] [EXTEND] Register AssociationGraph as service `memory.graph` in memory plugin setup — instantiate with workspaceRoot, call `graph.load()`, register service via `context.registerService()`

---

## Phase 4: User Story 2 — Manual Association (P1)

**Goal**: Agent can call `memory.associate` to manually link concepts
**Independent Test**: Call associate, verify nodes/edges created via `memory.related`

- [X] T017 [US2] [EXTEND] Register `memory.associate` tool in `src/plugins/memory/index.ts` — Zod schema: `{ from: string, to: string, rel: string, fromType?: string, toType?: string }`. Execute: call `graph.addNode()` for both, `graph.addEdge()`, return edge info

---

## Phase 5: User Story 3 — Auto-Extraction on Upsert (P1)

**Goal**: Concepts automatically extracted from upserted text via LLM
**Independent Test**: Upsert text, verify graph contains extracted nodes/edges

- [X] T018 [US3] [NEW] Implement `extractAndMerge(text: string)` method in AssociationGraph — use `createLlmAdapter(context)` for LLM call with structured JSON output prompt. Parse response `{ nodes: [{label, type}], edges: [{from, to, rel}] }`. Merge into graph via `addNode()`/`addEdge()`. Use synthetic sessionId (e.g. "graph-extraction") and agentId. Set noTools: true, maxSteps: 1. Wrap in try/catch, log errors silently
- [X] T019 [US3] [EXTEND] Subscribe to `memory:upserted` event in memory plugin setup — get EventBus via `resolveCommonServices(context).events`, subscribe, call `graph.extractAndMerge(payload.text)` fire-and-forget (no await). Store unsubscribe function for cleanup
- [X] T020 [US3] [NEW] Create extraction prompt — minimal prompt asking LLM to extract concepts and relationships from text, return JSON `{ nodes: [{label, type}], edges: [{from, to, rel}] }`. Use `noTools: true` and fast model if configurable
- [X] T021 [P] [US3] Write tests for extraction — mock LLM adapter, verify merge behavior, verify error handling (timeout, invalid JSON, null adapter)

---

## Phase 6: User Story 4 — Path Discovery (P2)

**Goal**: Agent can call `memory.path` to find shortest path between concepts
**Independent Test**: Create chain A→B→C, call path, verify full path returned

- [X] T022 [US4] [EXTEND] Register `memory.path` tool in `src/plugins/memory/index.ts` — Zod schema: `{ from: string, to: string }`. Execute: slugify both, call `graph.shortestPath()`, return path info

---

## Phase 7: User Story 5 — Search Enrichment (P2)

**Goal**: `memory.search` expanded via graph neighbors
**Independent Test**: Search term, verify expanded results with source markers

- [X] T023 [US5] [EXTEND] Add `source: "direct" | "graph"` field to `MemoryHit` interface in `src/plugins/services/memory-store.ts`
- [X] T024 [US5] [EXTEND] Add optional `graph?: AssociationGraph` and `expand?: boolean` parameters to `MemoryStore.search()` — default expand=true. After BM25 results, if graph provided and expand=true: extract top concept from query, get neighbors (depth 1, max 3), run secondary BM25 searches on neighbor labels, merge results scored at 50%, mark source="graph", deduplicate by (path, line)
- [X] T025 [US5] [EXTEND] Update `memory.search` tool registration in `src/plugins/memory/index.ts` — add `expand` parameter to Zod schema, pass graph instance and expand flag to `store.search()`
- [X] T026 [P] [US5] Write tests for search expansion — mock graph neighbors, verify expanded results, verify scoring at 50%, verify opt-out with `expand: false`

---

## Phase 8: User Story 6 — Context Injection (P3)

**Goal**: System prompt enriched with graph concepts based on conversation topic
**Independent Test**: Simulate conversation keywords matching graph nodes, verify context output

- [X] T027 [US6] [EXTEND] Enhance `memory.context` provider in `src/plugins/memory/index.ts` — after existing MEMORY.md + daily notes sections, add graph section: get all node labels from graph, match recent conversation messages via ChatHistoryStore service (context.getService) — tokenize last 5 messages, match words against node IDs, get neighbors (depth 1) for matched nodes, format as "## Associated Concepts\n- {label} ({rel} {neighbor})" limited to 10 entries / ~200 tokens
- [X] T028 [P] [US6] Write test for context injection — mock graph with known nodes, verify output format and token limit

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: Final integration, prompt contribution, cleanup

- [X] T029 [EXTEND] Add prompt contribution in memory plugin describing the 3 new graph tools — brief description of `memory.associate`, `memory.related`, `memory.path` for LLM awareness. Priority ~25 (near existing memory prompt at 20)
- [X] T030 [P] Run full test suite `bun run test src/plugins/services/association-graph.test.ts` and fix any failures
- [X] T031 [P] Run `tsc --noEmit` to verify type safety across modified files

---

## Phase 10: Review Corrections

**Source**: Review 2026-03-09 (branch: 007-association-graph)
**Purpose**: Address findings from code review

- [X] T032 [HIGH] Add `memory:upserted` event type to EventMap via declaration merging — eliminates `as any` casts in memory-store.ts and memory/index.ts
- [X] T033 [HIGH] Add extraction tests with mock LLM adapter — verify `extractAndMerge()` merge behavior, error handling (invalid JSON, null adapter)
- [X] T034 [MEDIUM] Remove unused `GraphEdge` import from association-graph.test.ts
- [X] T035 [LOW] Add 5K node warning in `addNode()` — log warning when nodeCount exceeds 5000 (spec requirement)
- [X] T036 [LOW] Log graph load errors via context.logger instead of swallowing in memory/index.ts

---

## Dependencies

```text
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1: Related) ─┐
                                          → Phase 4 (US2: Associate) ├→ Phase 9 (Polish)
                                          → Phase 5 (US3: Extraction)│
                       Phase 2 ──────────→ Phase 6 (US4: Path) ─────┤
                       Phase 2 ──────────→ Phase 7 (US5: Search) ───┤
                       Phase 2 ──────────→ Phase 8 (US6: Context) ──┘
```

Phases 3-8 can be implemented in parallel after Phase 2 completes (all depend only on foundational graph service).

## Parallel Execution Examples

**Within Phase 2**: T008+T009 in parallel, T012+T013+T014 in parallel
**After Phase 2**: Phases 3+4+5+6 can all start simultaneously
**Within Phase 7**: T023+T024 sequential, T026 after T024

## Implementation Strategy

**MVP**: Phases 1-5 (graph store + 3 tools + extraction) — delivers core value
**Full**: Add Phases 6-8 (path discovery, search enrichment, context injection)

---

## Idea Technical Traceability

**Source Idea**: [ideas/004-association-graph/idea.md](../../ideas/004-association-graph/idea.md)

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| JSONL persistence (`graph.jsonl`) | T006, T007 | Mapped |
| Node ID slugification | T005 | Mapped |
| Debounce flush 500ms | T007 | Mapped |
| BFS for neighbors | T010 | Mapped |
| Dijkstra for path | T011 | Mapped |
| Register tools in memory plugin | T015, T017, T022 | Mapped |
| Fire-and-forget extraction | T018, T019 | Mapped |
| Base relation vocabulary | T004 (type constants) | Mapped |
| Search expansion (max 3 neighbors, 50% score) | T024 | Mapped |
| Context injection (keyword matching, 200 tokens) | T027 | Mapped |
| `createLlmAdapter` for extraction | T018 | Mapped |
| EventBus `memory:upserted` event | T003, T019 | Mapped |

### Divergences from Idea

None — all technical requirements from idea preserved in plan and tasks.

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 0 | — |
| EXTEND | 12 | T003, T015, T016, T017, T019, T022, T023, T024, T025, T027, T029 |
| NEW | 16 | T001, T002, T004-T014, T018, T020 (graph core + extraction) |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| MemoryStore | EXTEND | T003, T023, T024 | Add event emission and search expansion |
| Memory Plugin | EXTEND | T015-T029 | Add tools, service registration, context enhancement |
| createLlmAdapter | REUSE | T018 | Canonical LLM access pattern |
| EventBus | REUSE | T019 | Existing pub/sub system |
| AssociationGraph | NEW | T001-T014 | No existing graph structure in codebase |

NEW ratio: ~40% — acceptable since graph algorithms are genuinely new capability not found in existing codebase.
