# Memory Specification

> Source of truth for memory functionality.
> Last updated: 2026-03-09

## Overview

The memory domain provides persistent knowledge storage with BM25 text search, an association graph for relationship discovery, and context injection for LLM conversations.

## Features

### Association Graph

> Added: 2026-03-09 | Source: specs/007-association-graph/

Knowledge graph layer enabling associative navigation, concept extraction, and relationship discovery on top of the existing memory store.

#### User Stories

1. **Explore Related Concepts (P1)** - `memory.related` traverses the in-memory graph to find nodes connected to a topic, with optional depth and type filters. Edges are directed but traversal is bidirectional.

2. **Manual Association (P1)** - `memory.associate` records a relationship between two concepts. Nodes are auto-created if missing. Duplicate edges reinforce weight (+0.1, capped at 1.0).

3. **Auto-Extraction on Upsert (P1)** - When `memory.upsert` stores text, the system extracts concepts/relationships via a lightweight LLM call (`createLlmAdapter`) and merges them into the graph. Non-blocking; graceful degradation if LLM unavailable.

4. **Path Discovery (P2)** - `memory.path` finds the shortest path between two concepts using BFS weighted by inverse edge weight.

5. **Search Enrichment (P2)** - `memory.search` expands top BM25 hits through graph neighbors, merging secondary results at 50% score. Controllable via `expand: false`.

6. **Context Injection (P3)** - Graph-aware context provider matches conversation topics against node labels and injects neighbor context into LLM system prompts.

#### Entities

**GraphNode**: `id` (slugified label), `label`, `type` (concept/tool/decision/person/project/domain), `meta`, `created`

**GraphEdge**: `from`, `to`, `rel` (normalized), `weight` (0.0-1.0), `created`. Unique key: `(from, to, rel)`

**MemoryHit** (extended): Added `source: "direct" | "graph"` field to indicate hit origin.

#### Storage

- JSONL file at `~/.slashbot/graph.jsonl` with type discriminator (`t: "n"` for nodes, `t: "e"` for edges)
- Full in-memory load on startup into `Map<string, GraphNode>` and adjacency lists
- Append-only writes; periodic compaction rewrites full file

#### Architecture

- `AssociationGraph` service registered via InversifyJS DI
- Subscribes to `memory:upserted` EventBus events for auto-extraction
- Exposes `neighbors()`, `path()`, `nodeLabels()` for tools and context provider
- Tools: `memory.related`, `memory.associate`, `memory.path` (Zod v4 schemas)

#### Business Rules

- Node IDs are slugified from labels (lowercase, hyphens, no trailing hyphens)
- Edge weight starts at 0.5, reinforced by +0.1 per re-discovery, capped at 1.0
- Extraction failures are silent — upsert is never affected
- Search expansion disabled when graph has no matching nodes (zero overhead)

---
