# Feature: Graph Store & Core Tools

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 01
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Core `AssociationGraph` service with JSONL persistence, typed nodes, hybrid relations, graph traversal algorithms, and three LLM tools (`memory.associate`, `memory.related`, `memory.path`). Includes auto-extraction of concepts and relations on every `memory.upsert` call via a lightweight LLM call.

## User Value

**Who benefits**: The LLM agent and indirectly all end-users
**What they gain**: Ability to store, traverse, and discover associations between concepts in the bot's knowledge
**Success metric**: Graph grows to 50+ nodes organically within first week of use; `memory.related` returns useful results

## Scope

### This Feature Includes
- `AssociationGraph` service class with in-memory graph + JSONL persistence
- Typed `GraphNode` (id, label, type, meta, created) and `GraphEdge` (from, to, rel, weight, created)
- Base relation vocabulary + normalized free-form relations
- Graph algorithms: BFS neighbors (depth 1-3), shortest path, cluster (connected component)
- Node deduplication via slugified IDs
- Auto-extraction pipeline: on `memory.upsert`, call lightweight LLM to extract concepts + relations, merge into graph
- LLM tools:
  - `memory.associate` — manually link two concepts
  - `memory.related` — find neighbors of a concept (with optional depth and type filter)
  - `memory.path` — find shortest path between two concepts
- Debounced JSONL flush on mutation
- Full graph load on startup

### This Feature Does NOT Include
- Search enrichment (Feature 02)
- Context provider integration (Feature 03)
- Graph visualization or export
- Weight decay or pruning automation

## Key Use Cases

### Use Case 1: Manual Association
**Actor**: LLM agent
**Goal**: Record a relationship the LLM observes
**Flow**:
1. LLM calls `memory.associate({ from: "Bun", to: "TypeScript", rel: "runtime_for" })`
2. Nodes created if they don't exist, edge created/reinforced
3. Returns confirmation with current weight

### Use Case 2: Explore Neighbors
**Actor**: LLM agent
**Goal**: Find what's connected to a concept
**Flow**:
1. LLM calls `memory.related({ concept: "plugin-system", depth: 2, type: "tool" })`
2. BFS traversal returns: InversifyJS, EventBus, Zod (filtered to type "tool")
3. LLM uses these to enrich its response

### Use Case 3: Auto-Extraction
**Actor**: System (triggered by upsert)
**Goal**: Grow graph automatically
**Flow**:
1. `memory.upsert({ text: "Node-RED flows are stored as JSON and managed via Admin API v3" })`
2. Extraction LLM returns: nodes [Node-RED/tool, JSON/format, Admin API v3/tool], edges [Node-RED→uses→JSON, Node-RED→managed_by→Admin API v3]
3. Merged into graph with dedup

## Dependencies

### Requires
- Existing `MemoryStore` service (for upsert hook)
- LLM access for extraction (existing agentic infrastructure)

### Enables
- Feature 02: Search Enrichment (uses `neighbors()`)
- Feature 03: Context Injection (uses graph queries)

## Technical Hints

### Required Tools & Versions

- **Bun 1.0+**: File I/O for JSONL
- **InversifyJS**: DI registration
- **Zod v4**: Tool parameter schemas

### Implementation Notes

- File: `src/plugins/services/association-graph.ts` (~200-250 lines)
- Storage: `.slashbot/graph.jsonl` (one JSON object per line, `t:"n"` for nodes, `t:"e"` for edges)
- Node IDs: `label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')`
- Debounce flush: 500ms after last mutation
- Extraction prompt: structured JSON output, ~100 input tokens, use fastest available model
- Register tools in existing memory plugin (`src/plugins/memory/index.ts`)

## Open Questions

- Should `memory.associate` auto-create node types or require them? (suggest: auto-create as "concept" default)
- Extraction: blocking or fire-and-forget? (suggest: fire-and-forget with error logging)
- Max graph size before we need pruning? (suggest: warn at 5K nodes, hard limit at 10K)

## Notes

- The extraction prompt should be kept minimal to reduce latency and cost
- Consider a confidence threshold on extracted relations to reduce noise
- Weight reinforcement: each time a link is "re-discovered" by extraction or manual associate, increment weight by 0.1 (cap at 1.0)
