# Idea: Association Graph for Memory

**Created**: 2026-03-09
**Status**: Exploration
**Short Name**: association-graph

## Vision

Add a knowledge graph layer to slashbot's memory system that enables association of ideas — connecting concepts, navigating relationships, and surfacing related knowledge that BM25 text search alone cannot find. The graph complements the existing markdown-based MemoryStore, not replaces it.

## Problem Statement

### The Problem
The current memory system (BM25 full-text search over markdown files) is good at answering "find me facts about X" but cannot answer "what else is related to X?", "what's the link between A and B?", or proactively surface relevant context based on conceptual proximity.

### Current Situation
- `memory.search` only matches text — no semantic or structural associations
- Knowledge is flat: notes and facts exist independently with no connections
- The bot cannot "think associatively" about stored knowledge
- Users must remember exact terms to find related information

### Why Now?
The memory system is stable and well-integrated. Adding a graph layer is a natural evolution that multiplies the value of existing stored knowledge by making connections visible and traversable.

## Target Users

### Primary Users
- **The LLM agent**: Autonomously builds and traverses the graph during conversations to provide richer, more connected responses. Technical level: high. Motivation: better context, fewer missed connections.

### Secondary Stakeholders
- **Bot end-users** (via Telegram/Discord): Benefit indirectly from more contextual, associative responses
- **Bot operator**: Can inspect the graph to understand what the bot "knows" and how concepts relate

## Goals & Success Metrics

### Primary Goals
1. Enable the bot to navigate knowledge by association, not just keyword match
2. Auto-extract concepts and relationships from stored memories
3. Enrich search results and system context with graph-based associations

### Success Indicators
- Graph grows organically through conversations without manual curation
- `memory.search` returns more relevant results by expanding via graph neighbors
- The bot can answer "what's related to X?" and "what connects A to B?"

### MVP Definition
JSONL-based graph store with typed nodes and hybrid relations. Auto-extraction of concepts on `memory.upsert`. Three new tools: `memory.associate`, `memory.related`, `memory.path`.

## Scope

### In Scope (MVP)
- `AssociationGraph` service (JSONL persistence, in-memory graph)
- Typed nodes (`concept`, `tool`, `decision`, `person`, `project`, `domain`, etc.)
- Hybrid relation vocabulary (base set + LLM-created, normalized)
- Auto-extraction of concepts/relations on `memory.upsert` (via lightweight LLM call)
- Tools: `memory.associate`, `memory.related`, `memory.path`

### In Scope (Future)
- Enrichment of `memory.search` results via graph neighbor expansion
- Context provider: auto-inject relevant graph concepts into system prompt
- Weight reinforcement (links used more often get stronger)
- Graph visualization / export

### Explicitly Out of Scope
- Replacing the existing MemoryStore or markdown files
- External graph database (Neo4j, etc.) — JSONL is sufficient at our scale
- Embedding-based similarity (vector DB) — this is structural association, not semantic

## Key Use Cases (Sketches)

### Use Case 1: Associative Exploration
**Actor**: LLM agent (prompted by user)
**Goal**: Find concepts related to a topic
**Flow**:
1. User asks "qu'est-ce qu'on sait en rapport avec Node-RED ?"
2. Bot calls `memory.related("node-red", depth: 2)`
3. Graph returns: Node-RED → uses → MQTT, part_of → Automation, depends_on → Docker, related_to → Home Assistant
4. Bot synthesizes a connected answer from graph + memory search

### Use Case 2: Path Discovery
**Actor**: LLM agent
**Goal**: Find the connection between two seemingly unrelated concepts
**Flow**:
1. User asks "quel rapport entre Zod et le plugin memory ?"
2. Bot calls `memory.path("zod", "memory-plugin")`
3. Graph returns: Zod → validates → Plugin SDK → used_by → Memory Plugin
4. Bot explains the indirect relationship

### Use Case 3: Auto-Extraction on Upsert
**Actor**: LLM agent (automatic)
**Goal**: Grow the graph from stored knowledge
**Flow**:
1. Bot calls `memory.upsert({ text: "Decided to use JSONL for graph storage instead of SQLite" })`
2. Extraction LLM call identifies: nodes [JSONL, SQLite, graph-storage], relations [JSONL ←chosen_over→ SQLite, JSONL ←used_for→ graph-storage]
3. Nodes and edges are merged into the graph (deduplication by normalized ID)

### Use Case 4: Search Enrichment (Phase 2)
**Actor**: LLM agent
**Goal**: Get broader results from a keyword search
**Flow**:
1. Bot searches `memory.search("TypeScript")`
2. BM25 returns direct matches
3. Graph expands: TypeScript → neighbors: Zod, Bun, InversifyJS
4. Additional BM25 searches on neighbor labels, results merged with lower weight

### Use Case 5: Context Injection (Phase 3)
**Actor**: System (automatic)
**Goal**: Prime the LLM with relevant associations
**Flow**:
1. Conversation topic detected as "plugin architecture"
2. Context provider queries graph for `plugin-architecture` neighbors (depth 1)
3. Injects: "Related concepts: InversifyJS (DI), Plugin SDK, EventBus, Service Registry"
4. LLM has richer context without explicit search

## Constraints & Assumptions

### Known Constraints
- **Technical**: Must integrate with existing MemoryStore plugin without breaking changes. JSONL file must stay small enough for full in-memory load (target: <10K nodes, <50K edges).
- **Performance**: Auto-extraction adds latency to `memory.upsert` — must be non-blocking or fast (<2s).
- **Cost**: Each upsert triggers a lightweight LLM call for extraction. Must use a small/fast model to keep costs low.

### Assumptions
- A few thousand nodes is sufficient for a personal bot's knowledge graph
- JSONL + in-memory Map is fast enough (no need for a graph DB)
- The LLM can reliably extract meaningful concepts and relations from short text snippets
- Normalized string IDs (slugified labels) are sufficient for deduplication

## Features Overview

**Complexity Score**: 7/10 - Complex

### Feature Breakdown

| # | Feature | Description | Priority | Dependencies | Status |
|---|---------|-------------|----------|--------------|--------|
| 01 | graph-store | AssociationGraph service with JSONL persistence, typed nodes, hybrid relations, auto-extraction on upsert, and LLM tools (associate/related/path) | P1/MVP | None | :black_square_button: Not specified |
| 02 | search-enrichment | Enrich `memory.search` results by expanding queries through graph neighbor traversal | P2 | 01 | :black_square_button: Not specified |
| 03 | context-injection | Auto-inject relevant graph concepts into system prompt based on conversation topic | P3 | 01, 02 | :black_square_button: Not specified |

**Status Legend**: :black_square_button: Not specified → :memo: Specified → :white_check_mark: Implemented

### Feature Dependencies Graph

```text
[01-graph-store]
    ├── [02-search-enrichment]
    └── [03-context-injection]
```

### Implementation Order

1. **Phase 1 (MVP)**: 01 — Core graph store, tools, auto-extraction
2. **Phase 2**: 02 — Search enrichment via graph expansion
3. **Phase 3**: 03 — Automatic context injection

## Open Questions & Risks

### Questions to Resolve
- Which LLM model/size to use for concept extraction? (needs to be fast + cheap)
- Should extraction be blocking or fire-and-forget on upsert?
- How to handle concept deduplication when the same idea is expressed differently? (e.g., "TS" vs "TypeScript")
- Base relation vocabulary — what's the initial set?

### Identified Risks
- **Noisy graph**: Auto-extraction may create too many low-value nodes → Mitigation: confidence threshold, periodic pruning
- **Extraction quality**: Small LLM may miss nuanced relationships → Mitigation: allow manual correction via `memory.associate`
- **Graph bloat**: Unbounded growth over time → Mitigation: weight decay, max node count with LRU eviction

## Discovery Notes

### Session 2026-03-09
- Q: Peuplement du graphe → A: Auto-extraction à chaque upsert (option C)
- Q: Cas d'usage principal → A: Tout — enrichissement recherche + exploration explicite + contexte auto (option D)
- Q: Granularité des nœuds → A: Mixte avec types (option C) — concepts larges et fins, typés pour filtrage
- Q: Types de relations → A: Hybride (option C) — vocabulaire de base + relations libres normalisées
- Q: Phasing MVP → A: Accepté tel quel (MVP: store+tools+extraction, P2: search enrichment, P3: context injection)

## Technical Hints

### Required Tools & Versions

- **Bun 1.0+**: Runtime (existing)
- **InversifyJS**: DI registration of AssociationGraph service (existing)
- **Zod v4**: Schema validation for graph operations (existing)

### Data Model

```typescript
// .slashbot/graph.jsonl
interface GraphNode {
  id: string;          // slugified label
  label: string;       // human-readable name
  type: string;        // "concept" | "tool" | "decision" | "person" | "project" | "domain" | ...
  meta?: Record<string, string>;
  created: string;     // ISO date
}

interface GraphEdge {
  from: string;        // node id
  to: string;          // node id
  rel: string;         // relation label (normalized)
  weight: number;      // 0-1, reinforced by usage
  created: string;     // ISO date
}
```

### Base Relation Vocabulary

`related_to`, `uses`, `used_by`, `part_of`, `contains`, `depends_on`, `enables`, `contradicts`, `replaces`, `inspired_by`, `chosen_over`, `instance_of`

### Integration Points

- `MemoryStore.upsert()` → triggers concept extraction → `AssociationGraph.mergeExtracted()`
- `MemoryStore.search()` → (Phase 2) expanded by `AssociationGraph.neighbors()`
- `memory.context` provider → (Phase 3) enriched by `AssociationGraph.relevantConcepts()`

### Implementation Notes

- Graph loaded fully in memory on startup from JSONL, flushed on mutation (debounced)
- Node IDs are slugified labels for natural deduplication
- BFS for `neighbors()`, Dijkstra (inverted weights) for `path()`
- Extraction prompt should return structured JSON: `{ nodes: [...], edges: [...] }`
