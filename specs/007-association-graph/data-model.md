# Data Model: Association Graph for Memory

**Feature**: 007-association-graph | **Date**: 2026-03-09

## Entities

### GraphNode (NEW)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | string | Slugified label (unique key) | `label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')` |
| label | string | Human-readable name | Non-empty |
| type | string | Node classification | Default: "concept". Values: concept, tool, decision, person, project, domain, etc. |
| meta | Record<string, string> | Optional metadata | Optional |
| created | string | ISO 8601 timestamp | Auto-set on creation |

**State transitions**: None (nodes are created and exist; no state machine)

### GraphEdge (NEW)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| from | string | Source node ID | Must reference existing node |
| to | string | Target node ID | Must reference existing node |
| rel | string | Relationship label (normalized) | Non-empty; normalized to lowercase with hyphens |
| weight | number | Reinforcement weight | 0.0–1.0; initial: 0.5; +0.1 per re-discovery; capped at 1.0 |
| created | string | ISO 8601 timestamp | Auto-set on creation |

**Uniqueness**: Composite key `(from, to, rel)` — only one edge per directed relation between two nodes.

### MemoryHit (EXTENDED)

| Field | Type | Description | Change |
|-------|------|-------------|--------|
| path | string | Memory file path | Existing |
| line | number | Line number (1-based) | Existing |
| text | string | Matched line text | Existing |
| score | number | BM25 relevance score | Existing |
| source | "direct" \| "graph" | Hit origin | **NEW** — indicates whether hit came from direct BM25 or graph expansion |

## JSONL Storage Format

File: `~/.slashbot/graph.jsonl`

Each line is a JSON object with type discriminator `t`:

```
{"t":"n","id":"node-red","label":"Node-RED","type":"tool","created":"2026-03-09T10:00:00Z"}
{"t":"n","id":"mqtt","label":"MQTT","type":"tool","created":"2026-03-09T10:00:00Z"}
{"t":"e","from":"node-red","to":"mqtt","rel":"uses","weight":0.5,"created":"2026-03-09T10:00:00Z"}
```

## In-Memory Structure

```
nodes: Map<string, GraphNode>     // Key: node ID
edges: Map<string, GraphEdge[]>   // Key: node ID → outgoing edges
reverseEdges: Map<string, GraphEdge[]>  // Key: node ID → incoming edges (for bidirectional traversal)
```

## Relationships

```
MemoryStore --emits--> memory:upserted --triggers--> AssociationGraph.extractAndMerge()
AssociationGraph --provides--> neighbors(), path() --used-by--> memory.related, memory.path tools
AssociationGraph --provides--> nodeLabels() --used-by--> memory.context provider (topic matching)
MemoryStore.search() --optionally-uses--> AssociationGraph.neighbors() --for--> search expansion
```
