# Quickstart: Memory Dashboard

**Branch**: `012-memory-dashboard` | **Date**: 2026-03-17

## Prerequisites

- Slashbot running with webui plugin enabled
- Web UI accessible (gateway API serving frontend)
- Memory plugin loaded (provides `memory.store` service)
- Association graph service optional (provides `memory.graph` service if spec 007 is implemented)

## Development Setup

```bash
# 1. Switch to feature branch
git checkout 012-memory-dashboard

# 2. Install dependencies (if any new ones)
bun install

# 3. Start slashbot in development mode
bun run dev

# 4. Open web UI
open http://localhost:3000  # or configured gateway port
```

## File Locations

### Backend (new files)

```
src/plugins/webui/
├── handlers/
│   ├── memory-stats.ts      # GET /api/memory/stats
│   ├── memory-search.ts     # GET /api/memory/search
│   ├── memory-files.ts      # GET/PUT/DELETE /api/memory/files[/:path]
│   ├── memory-notes.ts      # POST /api/memory/notes
│   ├── memory-timeline.ts   # GET /api/memory/timeline
│   └── memory-graph.ts      # GET /api/memory/graph, /api/memory/graph/neighbors/:id
├── index.ts                 # EXTEND: register new routes
└── types.ts                 # EXTEND: add memory schemas
```

### Frontend (new files)

```
frontend/public/
├── index.html               # EXTEND: add Memory nav tab + page div
└── js/
    └── memory.js            # NEW: Alpine.js memory dashboard component
```

### Tests

```
tests/
├── unit/
│   └── webui/
│       ├── memory-stats.test.ts
│       ├── memory-search.test.ts
│       ├── memory-files.test.ts
│       ├── memory-notes.test.ts
│       ├── memory-timeline.test.ts
│       └── memory-graph.test.ts
└── integration/
    └── webui/
        └── memory-api.test.ts
```

## Testing

```bash
# Run all tests
bun run test

# Run memory-specific tests
bun run test tests/unit/webui/memory-

# Run with coverage
bun run test --coverage
```

## Key Patterns

### Adding a new handler

```typescript
// src/plugins/webui/handlers/memory-stats.ts
export function createMemoryStatsHandler(context: PluginRegistrationContext) {
  const store = context.getService<MemoryStore>('memory.store');
  if (!store) throw new Error("webui: required service 'memory.store' not available");

  // Optional service — null if unavailable
  const graph = context.getService<AssociationGraph>('memory.graph') ?? null;

  return async function handleMemoryStats(
    _req: IncomingMessage,
    res: ServerResponse,
    _ctx: GatewayCallContext,
  ): Promise<void> {
    const memoryStats = await store.stats();
    const graphStats = graph ? computeGraphStats(graph) : null;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ memory: memoryStats, graph: graphStats }));
  };
}
```

### Registering routes in plugin setup

```typescript
// In src/plugins/webui/index.ts setup()
const handleMemoryStats = createMemoryStatsHandler(context);
context.registerHttpRoute({
  method: 'GET',
  path: '/api/memory/stats',
  pluginId: 'slashbot.webui',
  description: 'Memory and graph statistics',
  handler: handleMemoryStats,
});
```

### Frontend data loading

```javascript
// In memory.js
async loadStats() {
  const token = localStorage.getItem('slashbot_token') || '';
  try {
    const res = await fetch('/api/memory/stats', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 401) { this._handleUnauthorized(); return; }
    if (!res.ok) { this.error = 'Failed to load stats'; return; }
    this.stats = await res.json();
  } catch (err) {
    this.error = 'Network error: ' + (err.message || String(err));
  }
}
```
