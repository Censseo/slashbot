# API Contracts: Memory Dashboard

**Branch**: `012-memory-dashboard` | **Date**: 2026-03-17

All endpoints require Bearer token authentication (existing gateway auth).
All endpoints are registered in the webui plugin via `context.registerHttpRoute()`.

## Endpoints

### GET /api/memory/stats (NEW)

Returns combined memory and graph statistics.

**Request**: No parameters.

**Response** `200`:
```json
{
  "memory": {
    "files": 42,
    "chunks": 156,
    "indexedAt": "2026-03-17T10:30:00Z"
  },
  "graph": {
    "nodeCount": 200,
    "edgeCount": 450,
    "nodeTypeDistribution": {
      "concept": 120,
      "tool": 30,
      "decision": 25,
      "person": 10,
      "project": 10,
      "domain": 5
    }
  },
  "recentActivity": [
    { "date": "2026-03-17", "count": 5 },
    { "date": "2026-03-16", "count": 3 }
  ]
}
```

**Response when graph unavailable** `200`:
```json
{
  "memory": { "files": 42, "chunks": 156, "indexedAt": "..." },
  "graph": null,
  "recentActivity": [...]
}
```

---

### GET /api/memory/search?q={query}&limit={n} (NEW)

Unified search across memory store and association graph.

**Query Parameters**:
- `q` (required): Search query string
- `limit` (optional, default: 20): Max results per source

**Response** `200`:
```json
{
  "memory": [
    {
      "path": "memory/concepts/testing.md",
      "line": 5,
      "text": "Testing is a core practice...",
      "score": 0.85
    }
  ],
  "graph": [
    {
      "node": {
        "id": "testing",
        "label": "Testing",
        "type": "concept",
        "created": "2026-03-10T..."
      },
      "matchedOn": "label",
      "edges": [
        { "from": "testing", "to": "vitest", "rel": "uses", "weight": 0.8, "created": "..." }
      ]
    }
  ]
}
```

**Response** `400`: `{ "error": "Query parameter 'q' is required" }`

---

### GET /api/memory/files (NEW)

Returns memory directory as a tree structure.

**Response** `200`:
```json
[
  {
    "name": "MEMORY.md",
    "path": "MEMORY.md",
    "type": "file"
  },
  {
    "name": "202603",
    "path": "202603",
    "type": "directory",
    "children": [
      { "name": "20260317.md", "path": "202603/20260317.md", "type": "file" }
    ]
  }
]
```

---

### GET /api/memory/files/:path (NEW)

Reads a specific memory file.

**Path Parameter**: `path` — relative path within memory directory (URL-encoded)

**Response** `200`:
```json
{
  "path": "concepts/testing.md",
  "content": "# Testing\n\nTesting is a core practice...",
  "lastModified": "2026-03-17T10:30:00Z"
}
```

**Response** `404`: `{ "error": "File not found" }`
**Response** `403`: `{ "error": "Path outside memory directory" }`

---

### PUT /api/memory/files/:path (NEW)

Replaces the content of a memory file.

**Path Parameter**: `path` — relative path within memory directory

**Request Body**:
```json
{
  "content": "# Updated Content\n\nNew text here..."
}
```

**Response** `200`:
```json
{
  "path": "concepts/testing.md",
  "lastModified": "2026-03-17T11:00:00Z"
}
```

**Response** `400`: `{ "error": "Request body must contain 'content' string" }`
**Response** `403`: `{ "error": "Path outside memory directory" }`

---

### DELETE /api/memory/files/:path (NEW)

Deletes a memory file.

**Path Parameter**: `path` — relative path within memory directory

**Response** `200`:
```json
{
  "deleted": "concepts/old-note.md"
}
```

**Response** `404`: `{ "error": "File not found" }`
**Response** `403`: `{ "error": "Path outside memory directory" }`

---

### POST /api/memory/notes (NEW)

Appends a quick note to today's daily note file.

**Request Body**:
```json
{
  "text": "Note content to append"
}
```

**Response** `200`:
```json
{
  "path": "202603/20260317.md"
}
```

**Response** `400`: `{ "error": "Request body must contain 'text' string" }`

---

### GET /api/memory/timeline?days={n}&offset={n} (NEW)

Returns recent daily notes grouped by day.

**Query Parameters**:
- `days` (optional, default: 7): Number of days to fetch
- `offset` (optional, default: 0): Number of days to skip (for pagination)

**Response** `200`:
```json
[
  {
    "date": "2026-03-17",
    "entries": [
      {
        "timestamp": "2026-03-17T14:30:00Z",
        "tags": ["learning", "typescript"],
        "preview": "Discovered that Bun supports...",
        "content": "## Discovered that Bun supports...\n\nFull content here..."
      }
    ]
  },
  {
    "date": "2026-03-16",
    "entries": [...]
  }
]
```

---

### GET /api/memory/graph (NEW)

Returns full graph data (all nodes and edges).

**Response** `200`:
```json
{
  "nodes": [
    { "id": "testing", "label": "Testing", "type": "concept", "created": "..." }
  ],
  "edges": [
    { "from": "testing", "to": "vitest", "rel": "uses", "weight": 0.8, "created": "..." }
  ]
}
```

**Response** `503`: `{ "error": "Association graph service not available" }`

---

### GET /api/memory/graph/neighbors/:id?depth={n} (NEW)

Returns neighbors of a specific graph node.

**Path Parameter**: `id` — node ID (slugified label)
**Query Parameters**:
- `depth` (optional, default: 1): Traversal depth

**Response** `200`:
```json
{
  "node": { "id": "testing", "label": "Testing", "type": "concept", "created": "..." },
  "neighbors": [
    { "id": "vitest", "label": "Vitest", "type": "tool", "rel": "uses", "weight": 0.8, "direction": "outgoing" }
  ]
}
```

**Response** `404`: `{ "error": "Node not found" }`
**Response** `503`: `{ "error": "Association graph service not available" }`

## Zod Schemas

```typescript
// Request schemas
const SearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().optional().default(20),
});

const FileContentSchema = z.object({
  content: z.string(),
});

const QuickNoteSchema = z.object({
  text: z.string().min(1),
});

const TimelineQuerySchema = z.object({
  days: z.coerce.number().int().positive().optional().default(7),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

const NeighborQuerySchema = z.object({
  depth: z.coerce.number().int().positive().optional().default(1),
});
```
