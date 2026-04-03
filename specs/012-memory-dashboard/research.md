# Research: Memory Dashboard

**Branch**: `012-memory-dashboard` | **Date**: 2026-03-17

## Existing Codebase Analysis

### Reusable Components

| Component | Location | Reuse Type | Notes |
|-----------|----------|------------|-------|
| WebUI plugin structure | `src/plugins/webui/index.ts` | EXTEND | Add 10 new route registrations in existing setup() |
| Handler factory pattern | `src/plugins/webui/handlers/*.ts` | REUSE | Create new handler factories following identical pattern |
| SSE utilities | `src/plugins/webui/sse.ts` | REUSE | Not needed for memory dashboard (all JSON endpoints) |
| Zod types | `src/plugins/webui/types.ts` | EXTEND | Add memory-specific request/response schemas |
| SPA navigation | `frontend/public/index.html` | EXTEND | Add "Memory" nav button + page div |
| Alpine.js component pattern | `frontend/public/js/dashboard.js` | REUSE | Create memory.js following same lifecycle pattern |
| Auth token handling | `frontend/public/js/dashboard.js` | REUSE | Same localStorage token + Bearer header pattern |
| MemoryStore service | `src/plugins/services/memory-store.ts` | REUSE | search(), get(), stats(), appendToday(), getRecentNotes() |
| AssociationGraph service | `src/plugins/memory/` (spec 007) | REUSE (optional) | Optional runtime dependency; may not exist yet |
| Static file handler | `src/plugins/webui/handlers/static.ts` | REUSE | No changes needed; serves new JS/HTML automatically |
| marked (CDN) | Already in index.html | REUSE | Markdown rendering for memory content |

### Existing Patterns to Follow

| Pattern | Source | Application |
|---------|--------|-------------|
| Handler factory: `createXHandler(context)` → async handler | All webui handlers | 10 new memory handlers |
| Service resolution: `context.getService<T>(id)` with validation | All handlers | Resolve `memory.store`, optional `memory.graph` |
| JSON response: `res.writeHead(200, {'content-type': 'application/json'})` | plugins.ts, status-indicators.ts | All memory endpoints |
| Alpine.js component: `function name() { return { state, methods } }` | dashboard.js, chat.js | New memory.js component |
| Lifecycle: `onShow()`/`onHide()` with `x-effect` | dashboard.js | Memory page visibility management |
| Auth: `localStorage.getItem('slashbot_token')` + 401 handling | dashboard.js | All memory API calls |
| Navigation: `currentPage` state + `x-show` + `@navigate-to.window` | index.html | Add "memory" page value |

### Potential Conflicts

| Area | Conflict | Resolution |
|------|----------|------------|
| MemoryStore editing | upsert() is append-only, not replace | Use direct file write for edits (bypass MemoryStore) |
| MemoryStore deletion | No delete() method | Use filesystem unlink directly in handler |
| MemoryStore file listing | listFiles() is private | Use filesystem readdir directly in handler |
| AssociationGraph | Not yet implemented (spec 007) | Optional dependency; graceful degradation |
| Graph search | No search() method on AssociationGraph | Implement label substring match in handler |

## Technical Decisions

### Decision 1: Memory File Operations Bypass MemoryStore

- **Decision**: Edit (file replace) and Delete (unlink) operations are handled directly via filesystem in the API handler, not through MemoryStore
- **Existing code considered**: MemoryStore.upsert() (append-only), MemoryStore.get() (read-only)
- **Reuse approach**: NEW (for edit/delete); REUSE (for search, stats, appendToday, getRecentNotes)
- **Rationale**: MemoryStore was designed for append-style writes and search. Editing/deleting requires full file control. Adding edit/delete to MemoryStore would change its semantics and risk side effects.
- **Alternatives considered**: (a) Extend MemoryStore with write/delete methods — rejected because it changes MemoryStore's contract for all consumers. (b) Create a MemoryFileService wrapper — rejected as over-engineering for two simple filesystem operations.

### Decision 2: File Tree Listing via Direct Filesystem

- **Decision**: The `/api/memory/files` endpoint lists files via `readdir` on the memory directory, not through MemoryStore
- **Existing code considered**: MemoryStore.listFiles() (private method)
- **Reuse approach**: NEW (handler builds tree from filesystem)
- **Rationale**: MemoryStore.listFiles() is private and returns a flat list. The API needs a tree structure. Making it public would break encapsulation for one consumer.
- **Alternatives considered**: Make MemoryStore.listFiles() public — rejected because tree structure differs from MemoryStore's flat file model.

### Decision 3: Optional AssociationGraph Dependency

- **Decision**: The dashboard checks for `memory.graph` service at runtime. If absent, Graph tab shows "not available", graph stats show "N/A", search returns only memory results.
- **Existing code considered**: AssociationGraph spec (007), service registration pattern
- **Reuse approach**: REUSE (if service exists) / graceful degradation (if absent)
- **Rationale**: Decouples Memory Dashboard from AssociationGraph implementation timeline. Dashboard delivers value with memory views alone.
- **Alternatives considered**: Hard dependency on AssociationGraph — rejected because it would block this feature on spec 007 implementation.

### Decision 4: Graph Search via Label Substring Match

- **Decision**: Unified search queries graph nodes by case-insensitive substring match on node labels, returning matching nodes and their immediate edges
- **Existing code considered**: AssociationGraph.getAllNodeLabels(), neighbors() — no search() method exists
- **Reuse approach**: NEW (simple substring filter on in-memory node list)
- **Rationale**: AssociationGraph stores nodes in memory Maps. A label substring match is O(n) over the node list, which is fast for <10K nodes. No need for a full-text index.
- **Alternatives considered**: (a) Add search() to AssociationGraph — viable but couples graph spec to dashboard needs. (b) BM25 on labels — over-engineering for label matching.

### Decision 5: Cytoscape.js for Graph Rendering

- **Decision**: Use Cytoscape.js via CDN for interactive graph visualization
- **Existing code considered**: No graph rendering exists in codebase
- **Reuse approach**: NEW
- **Rationale**: Cytoscape.js is the de facto standard for graph visualization in JS, handles 10K+ nodes with canvas renderer, has rich interaction API (events, layout, style). Specified in feature file technical hints.
- **Alternatives considered**: D3.js (more manual work), vis.js (heavier), sigma.js (less ecosystem)

### Decision 6: Single Alpine.js Component for Memory Page

- **Decision**: One `memory()` Alpine.js component manages all sub-tabs (Graph, Explorer, Timeline) and the stats bar/search
- **Existing code considered**: `dashboard()` component pattern — single component per page
- **Reuse approach**: REUSE pattern
- **Rationale**: Follows existing pattern. Sub-tabs are internal navigation within a single page context, sharing state (e.g., search results trigger tab switches). Splitting into separate components would complicate cross-tab communication.
- **Alternatives considered**: Separate components per sub-tab — rejected because tabs share state (search navigates to graph/explorer).

## Technology Choices

| Category | Choice | Source |
|----------|--------|--------|
| Graph rendering | Cytoscape.js (CDN) | Feature file technical hints |
| Frontend framework | Alpine.js 3.x (CDN) | Existing web UI pattern |
| Styling | Tailwind CSS (CDN) | Existing web UI pattern |
| Markdown | marked (CDN) | Already loaded in index.html |
| HTML sanitization | DOMPurify (CDN) | Already loaded in index.html (used by chat.js) |
| Backend | TypeScript on Bun 1.0+ | Existing project stack |
| Validation | Zod v4 | Existing project pattern |
| Testing | Vitest | Existing project pattern |
