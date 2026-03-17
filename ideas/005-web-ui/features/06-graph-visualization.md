# Feature: Memory Dashboard

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 06
**Priority**: P2
**Status**: Not Specified

## Summary

A unified memory visualization dashboard for the web UI, combining an interactive association graph, a memory file explorer, a chronological timeline, statistics panels, and a unified search — all in one page. The operator gets full visibility into slashbot's knowledge base: what it remembers, how concepts are connected, and how memory evolves over time. Light editing capabilities (edit/delete memory entries, add notes) are included.

## User Value

**Who benefits**: Self-hosted operator
**What they gain**: Complete visibility and control over slashbot's memory — understand what the bot knows, how concepts relate, spot gaps or errors, and correct them without dropping to CLI
**Success metric**: Can explore the full memory (files + graph) from the dashboard, search across both, and edit/delete entries

## Scope

### This Feature Includes

#### Layout (Hybrid)
- Stats bar + unified search always visible at the top
- Tabbed views below: Graph, Explorer, Timeline

#### View A: Interactive Graph
- Force-directed graph rendering with Cytoscape.js (CDN)
- Node types visually distinguished (concept, tool, decision, person, project, domain)
- Edge labels and weight visualization
- Click node/edge to inspect details (sidebar or popover)
- Filter by node type and/or relationship type
- Zoom, pan, drag nodes
- Neighbors highlight on hover (depth 1)

#### View B: Memory Explorer
- File tree of `~/.slashbot/memory/` and `MEMORY.md`
- Click file to view contents with markdown rendering
- Edit entry inline (upsert via MemoryStore)
- Delete individual entries
- Add new note (quick note form → `memory.upsert`)

#### View C: Timeline
- Chronological view of daily notes (`memory/YYYYMM/YYYYMMDD.md`)
- Grouped by day, scrollable
- Entries show timestamp, tags, and preview text
- Click to expand full content

#### View D: Stats & Metrics (top bar)
- Graph stats: node count, edge count, node type distribution
- Memory stats: file count, chunk count, last indexed timestamp
- Activity sparkline or indicator (entries per day, recent 7 days)

#### View E: Unified Search (top bar)
- Single search input querying both MemoryStore (BM25) and AssociationGraph
- Results grouped by source (Memory / Graph)
- Click result to navigate to the relevant view (Explorer or Graph)

### This Feature Does NOT Include
- Graph editing (add/remove nodes/edges manually) — graph is built by the bot
- SPARQL-like graph querying
- Memory import/export
- Multi-user access control on memory

## Key Use Cases

### Use Case 1: Explore the Knowledge Graph
**Actor**: Self-hosted operator
**Goal**: Understand how concepts are connected in slashbot's memory
**Flow**:
1. Navigate to Memory Dashboard
2. Click the "Graph" tab
3. See force-directed graph with colored nodes by type
4. Hover over a node to highlight its neighbors
5. Click a node to see its details (label, type, metadata, connected edges)
6. Use type filter to show only "concept" + "decision" nodes

### Use Case 2: Search Across All Memory
**Actor**: Self-hosted operator
**Goal**: Find everything slashbot knows about a topic
**Flow**:
1. Type a query in the unified search bar
2. See results grouped: Memory files (with BM25 score) and Graph nodes/edges
3. Click a memory result → switches to Explorer tab with file opened
4. Click a graph result → switches to Graph tab with node focused

### Use Case 3: Review and Edit Memory
**Actor**: Self-hosted operator
**Goal**: Correct an outdated or wrong memory entry
**Flow**:
1. Open Explorer tab, browse memory files
2. Find the entry to correct
3. Click edit, modify the text inline
4. Save → calls `memory.upsert` to update
5. Alternatively, delete the entry if it's no longer relevant

### Use Case 4: Review Recent Activity
**Actor**: Self-hosted operator
**Goal**: See what the bot has been learning lately
**Flow**:
1. Check the stats bar for activity indicator
2. Click the "Timeline" tab
3. Scroll through recent daily notes grouped by day
4. Click an entry to expand and read full content

## Dependencies

### Requires
- Feature 01 (gateway-api): API endpoints for memory and graph data
- Feature 03 (admin-dashboard): dashboard layout/navigation shell

### Enables
- Nothing directly (leaf feature)

## Technical Hints

### Required Tools & Versions

- **Cytoscape.js**: latest (CDN) — graph rendering and interaction
- **Alpine.js**: 3.x (CDN) — reactive UI, already used by other features
- **Tailwind CSS**: CDN — styling, already used by other features
- **marked**: CDN — markdown rendering for memory content

### New API Endpoints Needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/memory/stats` | GET | Memory + graph stats (file count, chunk count, node count, edge count) |
| `/api/memory/search` | GET | Unified search across MemoryStore (BM25) and AssociationGraph |
| `/api/memory/files` | GET | List memory files (tree structure) |
| `/api/memory/files/:path` | GET | Read a specific memory file |
| `/api/memory/files/:path` | PUT | Update (upsert) a memory entry |
| `/api/memory/files/:path` | DELETE | Delete a memory entry |
| `/api/memory/notes` | POST | Quick note (appendToday) |
| `/api/memory/timeline` | GET | Recent daily notes (paginated, last N days) |
| `/api/memory/graph` | GET | Full graph data (nodes + edges) for Cytoscape rendering |
| `/api/memory/graph/neighbors/:id` | GET | Node neighbors (depth param) |

### Backend Services Used

- **MemoryStore** (`memory.store`): search, get, upsert, stats, appendToday, getRecentNotes
- **AssociationGraph** (`memory.graph`): nodes, edges, neighbors, stats

### Implementation Notes

- Cytoscape.js loaded via CDN (no build step), consistent with project stack
- Graph data fetched as JSON, transformed to Cytoscape elements format
- Memory file editing uses `memory.upsert` — append-style, not arbitrary file rewrite
- Stats bar refreshes on tab switch or on a polling interval (30s)
- Search debounced (300ms) to avoid excessive API calls
- Graph should handle up to 10K nodes comfortably (Cytoscape + canvas renderer)
- Consider lazy-loading graph data for large graphs (initial load = stats + top-level, expand on interaction)

## Open Questions

- How to handle graph data when AssociationGraph service is not yet available? (graceful degradation — show "Graph not available" with just memory views)
- Should the timeline support infinite scroll or pagination with "load more"?
- Should search results show a relevance score to the user?
