# Feature Specification: Association Graph for Memory

**Feature Branch**: `007-association-graph`
**Created**: 2026-03-09
**Status**: Draft
**Source**: [idea.md](../../ideas/004-association-graph/idea.md)
**Input**: Association graph — knowledge graph layer for the memory system enabling associative navigation, concept extraction, and relationship discovery

## Clarifications

### Session 2026-03-09

- Q: How should the association graph hook into `memory.upsert`? → A: MemoryStore emits a `memory:upserted` event via EventBus after successful write; the graph service subscribes to this event. Follows the EventBus pattern used by McpBridgeService.
- Q: How should the extraction LLM call access the LLM client? → A: Use `createLlmAdapter(context)` from plugin utils — the canonical pattern for plugin LLM access. Graceful degradation if LLM adapter is unavailable (extraction silently disabled, graph still usable for manual associations).
- Q: Should graph edges be bidirectional for traversal? → A: Edges are stored as directed but `memory.related` traverses both directions (outgoing and incoming edges). "A uses B" means B appears as related to A too. `memory.path` also considers edges in both directions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Explore Related Concepts (Priority: P1)

When the LLM agent needs to find concepts connected to a topic, it calls `memory.related` with a concept identifier and optional depth/type filters. The system traverses the in-memory graph and returns a list of related nodes with their relationship types and weights.

**Why this priority**: Core value proposition — enables associative exploration that BM25 text search cannot provide.

**Independent Test**: Can be fully tested by populating a graph with known nodes/edges, calling `memory.related`, and verifying the returned neighbors match expected graph structure.

**Acceptance Scenarios**:

1. **Given** a graph containing nodes "Node-RED", "MQTT", "Docker" with edges "Node-RED→uses→MQTT" and "Node-RED→depends_on→Docker", **When** the agent calls `memory.related({ concept: "node-red", depth: 1 })`, **Then** the system returns both "MQTT" and "Docker" with their respective relation types and weights.
2. **Given** the same graph, **When** the agent calls `memory.related({ concept: "node-red", depth: 1, type: "tool" })`, **Then** only nodes of type "tool" are returned.
3. **Given** a concept that does not exist in the graph, **When** the agent calls `memory.related({ concept: "unknown-concept" })`, **Then** the system returns an empty result set with no error.

---

### User Story 2 — Manual Association (Priority: P1)

When the LLM agent observes a relationship between two concepts during a conversation, it calls `memory.associate` to record the link. Nodes are auto-created if they don't exist. If the edge already exists, its weight is reinforced.

**Why this priority**: Enables deliberate graph construction — the agent can record knowledge relationships it discovers.

**Independent Test**: Can be tested by calling `memory.associate` with two concepts, then verifying the nodes and edge exist in the graph via `memory.related`.

**Acceptance Scenarios**:

1. **Given** an empty graph, **When** the agent calls `memory.associate({ from: "Bun", to: "TypeScript", rel: "runtime_for" })`, **Then** both nodes are created (type defaults to "concept") and an edge is created with weight 0.5.
2. **Given** an existing edge "Bun→runtime_for→TypeScript" with weight 0.5, **When** the agent calls `memory.associate` with the same parameters, **Then** the edge weight increases by 0.1 (to 0.6), capped at 1.0.
3. **Given** a call with optional node types `memory.associate({ from: "Bun", fromType: "tool", to: "TypeScript", toType: "language", rel: "runtime_for" })`, **Then** nodes are created with the specified types.

---

### User Story 3 — Auto-Extraction on Upsert (Priority: P1)

When a memory is stored via `memory.upsert`, the system automatically extracts concepts and relationships from the text using a lightweight LLM call, then merges the extracted nodes and edges into the graph. This process is non-blocking — the upsert returns immediately.

**Why this priority**: Enables organic graph growth without manual curation — the graph builds itself from stored knowledge.

**Independent Test**: Can be tested by calling `memory.upsert` with text containing identifiable concepts, waiting briefly, then verifying new nodes/edges appear in the graph.

**Acceptance Scenarios**:

1. **Given** a memory plugin with the association graph active, **When** the agent calls `memory.upsert({ text: "Decided to use JSONL for graph storage instead of SQLite" })`, **Then** within 2 seconds, the graph contains nodes for "JSONL", "SQLite", and "graph-storage" with appropriate relations.
2. **Given** an extraction that identifies a node already in the graph (by normalized ID), **When** the extracted node is merged, **Then** the existing node is preserved (no duplicate) and any new edges are added.
3. **Given** an LLM extraction failure (timeout, malformed response), **When** the extraction errors, **Then** the original upsert is unaffected and the error is logged without user notification.

---

### User Story 4 — Path Discovery (Priority: P2)

When the agent needs to find the connection between two seemingly unrelated concepts, it calls `memory.path` to find the shortest path through the graph.

**Why this priority**: Valuable for reasoning about indirect relationships, but less frequently needed than direct neighbor exploration.

**Independent Test**: Can be tested by creating a chain of nodes A→B→C and verifying `memory.path("A", "C")` returns the full path.

**Acceptance Scenarios**:

1. **Given** a graph with path Zod→validates→PluginSDK→used_by→MemoryPlugin, **When** the agent calls `memory.path({ from: "zod", to: "memory-plugin" })`, **Then** the system returns the ordered path with intermediate nodes and relation labels.
2. **Given** two nodes with no connecting path, **When** the agent calls `memory.path`, **Then** the system returns an empty path with no error.
3. **Given** multiple paths between two nodes, **When** the agent calls `memory.path`, **Then** the shortest path (by hop count, weighted by inverse edge weight) is returned.

---

### User Story 5 — Search Enrichment (Priority: P2)

When the agent performs a `memory.search`, results are automatically enriched by expanding top-hit concepts through graph neighbors. Secondary searches on neighbor labels are merged with lower weighting, surfacing associatively related knowledge.

**Why this priority**: Multiplies the value of existing search by leveraging graph connections — but requires a populated graph to be useful.

**Independent Test**: Can be tested by populating memory files and graph, searching a term, and verifying results include graph-expanded hits marked with source "graph".

**Acceptance Scenarios**:

1. **Given** a search for "authentication" with graph neighbors "bcrypt" and "editor-password", **When** search expansion is active (default), **Then** results include direct BM25 hits plus expanded hits from neighbor searches, with expanded hits scored at 50% of their BM25 score.
2. **Given** search with `expand: false`, **When** the search executes, **Then** only direct BM25 results are returned (no graph expansion).
3. **Given** a search term with no matching graph nodes, **When** expansion is attempted, **Then** the search behaves identically to non-expanded search with no performance penalty.

---

### User Story 6 — Context Injection (Priority: P3)

The memory context provider automatically detects conversation topics by matching keywords from recent messages against graph node labels, then injects a concise "Related concepts" section into the system prompt.

**Why this priority**: Most speculative — effectiveness depends on graph quality. Delivers passive value without explicit tool calls.

**Independent Test**: Can be tested by simulating a conversation about a topic present in the graph and verifying the context provider output includes related concepts.

**Acceptance Scenarios**:

1. **Given** a conversation mentioning "plugin architecture" and a graph node "plugin-system" with neighbors, **When** the context provider runs, **Then** it injects up to 10 related concepts with relation types into the system prompt.
2. **Given** no graph nodes match conversation keywords, **When** the context provider runs, **Then** no graph section is injected (no empty sections).
3. **Given** the injected context, **Then** it does not exceed 200 tokens to avoid prompt bloat.

---

### Edge Cases

- What happens when the graph file is corrupted or contains malformed JSONL lines? → Malformed lines are skipped with a warning; valid lines are loaded.
- What happens when the graph exceeds 10,000 nodes? → System logs a warning; oldest low-weight nodes are candidates for manual pruning (no automatic eviction in MVP).
- What happens when two concepts have different labels but the same slugified ID? → They are treated as the same node; the first label is preserved.
- What happens on concurrent upserts triggering simultaneous extractions? → Extractions are serialized via a queue; graph mutations are atomic (in-memory Map operations).

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Graph file missing on startup | (silent — empty graph initialized) | Graph starts empty, builds from future upserts |
| Graph file corrupted/malformed | (silent — partial load) | Valid lines loaded, malformed lines skipped with warning in logs |
| LLM extraction timeout during upsert | (silent — upsert succeeds) | Extraction skipped; logged for debugging; next upsert retries normally |
| LLM extraction returns invalid JSON | (silent — upsert succeeds) | Extraction discarded; error logged |
| Graph file write failure (disk full) | (silent — in-memory graph preserved) | Retry flush on next mutation; warn in logs |
| Node not found for `memory.related` | Tool returns empty results | Agent can try different concept name or use `memory.search` instead |
| Path not found for `memory.path` | Tool returns empty path | Agent informed no connection exists |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an in-memory knowledge graph that persists to a JSONL file, loading fully on startup.
- **FR-002**: Each graph node MUST have a unique identifier (slugified from label), a human-readable label, a type classification, and a creation timestamp.
- **FR-003**: Each graph edge MUST connect two nodes with a named relationship, a weight (0.0–1.0), and a creation timestamp.
- **FR-004**: System MUST provide a base relation vocabulary (`related_to`, `uses`, `used_by`, `part_of`, `contains`, `depends_on`, `enables`, `contradicts`, `replaces`, `inspired_by`, `chosen_over`, `instance_of`) while accepting normalized free-form relations.
- **FR-005**: System MUST provide a `memory.associate` tool that creates or reinforces a link between two concepts, auto-creating nodes if they don't exist.
- **FR-006**: System MUST provide a `memory.related` tool that returns graph neighbors of a concept with configurable depth (1–3) and optional type filtering. Traversal MUST follow edges in both directions (outgoing and incoming).
- **FR-007**: System MUST provide a `memory.path` tool that finds the shortest weighted path between two concepts.
- **FR-008**: System MUST automatically extract concepts and relationships from text on every `memory.upsert` call using a lightweight LLM call. The upsert hook MUST use EventBus subscription to a `memory:upserted` event. If the LLM adapter is unavailable, extraction MUST be silently disabled.
- **FR-009**: Auto-extraction MUST be non-blocking — the upsert operation returns immediately; extraction runs asynchronously.
- **FR-010**: Node deduplication MUST use slugified label comparison (lowercase, non-alphanumeric replaced with hyphens).
- **FR-011**: Edge weight reinforcement MUST increment by 0.1 on each re-discovery, capped at 1.0.
- **FR-012**: Graph mutations MUST be flushed to disk with debouncing (writes batched within 500ms after the last mutation).
- **FR-013**: System MUST enrich `memory.search` results by expanding queries through graph neighbor traversal, with expansion enabled by default and an opt-out flag.
- **FR-014**: Expanded search results MUST be scored at 50% of their BM25 score and marked with their source ("direct" or "graph").
- **FR-015**: System MUST provide a context provider that injects related graph concepts into the system prompt based on conversation topic detection.
- **FR-016**: Context injection MUST be limited to a maximum of 10 concepts and approximately 200 tokens.

### Key Entities

- **GraphNode**: A concept in the knowledge graph — identified by slugified label, typed (concept, tool, decision, person, project, domain, etc.), with optional metadata and creation timestamp.
- **GraphEdge**: A directed relationship between two nodes — named relation, weight (0.0–1.0, reinforced by usage), creation timestamp.
- **AssociationGraph**: The graph service managing nodes, edges, persistence, traversal algorithms (BFS, shortest path), and extraction pipeline.

## Performance Requirements

| Metric | Target | Justification |
|--------|--------|---------------|
| Graph load time (≤10K nodes) | < 500ms | Startup must not be noticeably delayed |
| `memory.related` (depth 1) | < 50ms | Called during conversations; must feel instant |
| `memory.path` | < 100ms | Graph traversal on in-memory structure |
| Auto-extraction latency | < 2s (async, non-blocking) | Must not delay upsert response |
| Search expansion overhead | < 100ms added to search | Must not noticeably slow search |
| JSONL flush (debounced) | < 100ms | Background write, not user-facing |

## Data & State *(mandatory — feature involves persistence)*

- **Data ownership**: System-owned (the bot's knowledge graph)
- **Storage**: Single JSONL file (`~/.slashbot/graph.jsonl`) — one JSON object per line, type-discriminated
- **Access control**: Read/write by the bot process only; file permissions 0600
- **Retention policy**: Indefinite; no automatic pruning in MVP. Warning logged at 5,000 nodes.
- **Concurrent modification**: Single-writer model; extraction queue serializes mutations. In-memory Map is the authority; disk is a persistence mirror.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The knowledge graph grows to 50+ nodes organically within the first week of normal bot usage, without manual curation.
- **SC-002**: `memory.related` returns useful (non-empty) results for at least 70% of concepts that have been mentioned in 3+ stored memories.
- **SC-003**: `memory.search` with graph expansion returns at least 20% more relevant results compared to BM25-only search, measured by the agent using expanded results in its responses.
- **SC-004**: Auto-extraction correctly identifies at least 2 concepts and 1 relationship per upsert on average, measured over 50 upserts.
- **SC-005**: The bot can answer "what's related to X?" queries by using `memory.related` and synthesizing a connected answer from graph + memory search results.

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [ideas/004-association-graph/idea.md](../../ideas/004-association-graph/idea.md)
- **Features**: [01-graph-store](../../ideas/004-association-graph/features/01-graph-store.md), [02-search-enrichment](../../ideas/004-association-graph/features/02-search-enrichment.md), [03-context-injection](../../ideas/004-association-graph/features/03-context-injection.md)

### Technical Constraints
- Must integrate with existing MemoryStore plugin without breaking changes
- JSONL file must stay small enough for full in-memory load (target: <10K nodes, <50K edges)
- Auto-extraction adds latency to `memory.upsert` — must be non-blocking or fast (<2s)
- Each upsert triggers a lightweight LLM call for extraction — must use a small/fast model to keep costs low
- A few thousand nodes is sufficient for a personal bot's knowledge graph
- JSONL + in-memory Map is fast enough (no need for a graph DB)

### Implementation Guidance
- File: `src/plugins/services/association-graph.ts` (~200-250 lines)
- Storage: `.slashbot/graph.jsonl` (one JSON object per line, `t:"n"` for nodes, `t:"e"` for edges)
- Node IDs: `label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')`
- Debounce flush: 500ms after last mutation
- Graph loaded fully in memory on startup from JSONL, flushed on mutation (debounced)
- BFS for `neighbors()`, Dijkstra (inverted weights) for `path()`
- Extraction prompt should return structured JSON: `{ nodes: [...], edges: [...] }`
- Register tools in existing memory plugin (`src/plugins/memory/index.ts`)
- Extraction: fire-and-forget with error logging (non-blocking)
- Auto-create node types as "concept" default when not specified
- Search expansion: max 3 neighbor labels searched, max 3 extra results
- Context injection: tokenize last N messages, match against graph node labels/IDs

### Discovery Decisions
- Graph population: Auto-extraction on every upsert (option C)
- Primary use case: All — search enrichment + explicit exploration + auto context (option D)
- Node granularity: Mixed with types (option C) — broad and fine concepts, typed for filtering
- Relation types: Hybrid (option C) — base vocabulary + normalized free-form relations
- Phasing: MVP (store+tools+extraction), P2 (search enrichment), P3 (context injection)

### Base Relation Vocabulary
`related_to`, `uses`, `used_by`, `part_of`, `contains`, `depends_on`, `enables`, `contradicts`, `replaces`, `inspired_by`, `chosen_over`, `instance_of`
