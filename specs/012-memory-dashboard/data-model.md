# Data Model: Memory Dashboard

**Branch**: `012-memory-dashboard` | **Date**: 2026-03-17

## Entities

### MemoryStats (EXISTING — from MemoryStore)

```typescript
interface MemoryStats {
  files: number;
  chunks: number;
  indexedAt: string;  // ISO 8601 timestamp
}
```

**Source**: `src/plugins/services/memory-store.ts`
**Used by**: `GET /api/memory/stats`

### GraphStats (NEW — aggregated from AssociationGraph)

```typescript
interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  nodeTypeDistribution: Record<string, number>;  // e.g., { concept: 42, tool: 10, ... }
}
```

**Source**: Computed from AssociationGraph service at query time
**Used by**: `GET /api/memory/stats`

### CombinedStats (NEW — API response shape)

```typescript
interface CombinedStats {
  memory: MemoryStats;
  graph: GraphStats | null;  // null when graph service unavailable
  recentActivity: DayCount[];  // last 7 days
}

interface DayCount {
  date: string;     // YYYY-MM-DD
  count: number;    // entries on that day
}
```

**Used by**: `GET /api/memory/stats`

### MemoryFileNode (NEW — file tree representation)

```typescript
interface MemoryFileNode {
  name: string;         // filename or directory name
  path: string;         // relative path from memory root
  type: 'file' | 'directory';
  children?: MemoryFileNode[];  // only for directories
}
```

**Used by**: `GET /api/memory/files`

### MemoryFileContent (NEW — file read response)

```typescript
interface MemoryFileContent {
  path: string;         // relative path
  content: string;      // raw markdown content
  lastModified: string; // ISO 8601 timestamp
}
```

**Used by**: `GET /api/memory/files/:path`

### GraphNode (EXISTING — from AssociationGraph spec 007)

```typescript
interface GraphNode {
  id: string;           // slugified label
  label: string;        // human-readable
  type?: string;        // concept, tool, decision, person, project, domain
  meta?: Record<string, string>;
  created: string;      // ISO 8601
}
```

**Source**: `specs/007-association-graph/spec.md`
**Used by**: `GET /api/memory/graph`, `GET /api/memory/search`

### GraphEdge (EXISTING — from AssociationGraph spec 007)

```typescript
interface GraphEdge {
  from: string;         // source node ID
  to: string;           // target node ID
  rel: string;          // relationship type
  weight: number;       // 0.0-1.0
  created: string;      // ISO 8601
}
```

**Source**: `specs/007-association-graph/spec.md`
**Used by**: `GET /api/memory/graph`, `GET /api/memory/graph/neighbors/:id`

### GraphData (NEW — graph API response)

```typescript
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

**Used by**: `GET /api/memory/graph`

### NeighborResult (EXISTING — from AssociationGraph spec 007)

```typescript
interface NeighborResult {
  id: string;
  label: string;
  type?: string;
  rel: string;
  weight: number;
  direction: 'outgoing' | 'incoming';
}
```

**Source**: `specs/007-association-graph/spec.md`
**Used by**: `GET /api/memory/graph/neighbors/:id`

### UnifiedSearchResult (NEW — search API response)

```typescript
interface UnifiedSearchResult {
  memory: MemorySearchHit[];
  graph: GraphSearchHit[];
}

interface MemorySearchHit {
  path: string;
  line: number;
  text: string;
  score: number;
}

interface GraphSearchHit {
  node: GraphNode;
  matchedOn: 'label';  // extensible for future match types
  edges: GraphEdge[];   // immediate connections
}
```

**Used by**: `GET /api/memory/search`

### TimelineDay (NEW — timeline API response)

```typescript
interface TimelineDay {
  date: string;          // YYYY-MM-DD
  entries: TimelineEntry[];
}

interface TimelineEntry {
  timestamp: string;     // ISO 8601
  tags: string[];
  preview: string;       // first ~200 chars
  content: string;       // full markdown content
}
```

**Used by**: `GET /api/memory/timeline`

## Entity Relationships

```text
CombinedStats
├── MemoryStats (from MemoryStore.stats())
├── GraphStats (from AssociationGraph, optional)
└── DayCount[] (computed from timeline data)

MemoryFileNode (tree)
├── MemoryFileNode[] (children, recursive)
└── MemoryFileContent (on file read)

GraphData
├── GraphNode[] (all nodes)
└── GraphEdge[] (all edges)

UnifiedSearchResult
├── MemorySearchHit[] (from MemoryStore.search())
└── GraphSearchHit[] (label match + edges, optional)
    ├── GraphNode (matched node)
    └── GraphEdge[] (immediate connections)

TimelineDay
└── TimelineEntry[] (daily note entries)
```

## Storage

All data is read from existing storage locations:

| Data | Storage | Access Method |
|------|---------|---------------|
| Memory files | `~/.slashbot/memory/**/*.md` | Direct filesystem read/write |
| Memory index | In-memory (MemoryStore) | `memory.store` service |
| Graph data | `~/.slashbot/graph.jsonl` | `memory.graph` service (optional) |
| Daily notes | `~/.slashbot/memory/YYYYMM/YYYYMMDD.md` | MemoryStore + filesystem |

No new storage locations are created by this feature.
