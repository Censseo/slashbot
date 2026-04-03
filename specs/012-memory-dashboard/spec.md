# Feature Specification: Memory Dashboard

**Feature Branch**: `012-memory-dashboard`
**Created**: 2026-03-17
**Status**: Draft
**Source**: [Feature 06](../../ideas/005-web-ui/features/06-graph-visualization.md)
**Parent Idea**: [idea.md](../../ideas/005-web-ui/idea.md)

<!--
  CONSTITUTION COMPLIANCE (v1.1.0)
  ================================
  MANDATORY SECTIONS: User Scenarios, Requirements, Error Scenarios, Success Criteria
  CONDITIONAL SECTIONS: Accessibility (UI feature), Performance (graph rendering), Security (memory editing), Data & State (memory persistence)
-->

## Clarifications

### Session 2026-03-17

- Q: MemoryStore.upsert() is append-style — how does inline editing of existing content work? → A: Editing replaces the full file content via a direct file write operation, not through MemoryStore.upsert(). The "Add Note" feature uses appendToday() as expected.
- Q: MemoryStore has no delete() method — how is FR-023 (deletion) implemented? → A: The API endpoint handles deletion directly via filesystem unlink, operating on files within the memory directory. Not routed through MemoryStore.
- Q: MemoryStore.listFiles() is private — how does FR-020 (file tree) work? → A: The API endpoint lists files from the memory directory directly via filesystem readdir, independent of MemoryStore internals.
- Q: AssociationGraph (spec 007) is designed but not yet implemented — what is the dependency strategy? → A: AssociationGraph is an optional runtime dependency. The dashboard checks for the `memory.graph` service at runtime. If unavailable, Graph tab shows a graceful degradation message, graph stats show "N/A", and unified search returns only memory results.
- Q: AssociationGraph has no search() method — how does unified search query the graph? → A: Graph search performs a case-insensitive substring match against node labels and returns matching nodes with their immediate connections. This is a lightweight client of the graph's node data, not a full-text search.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explore the Knowledge Graph (Priority: P1)

The operator navigates to the Memory Dashboard and opens the Graph tab to visualize how concepts are connected in slashbot's memory. Nodes are color-coded by type (concept, tool, decision, person, project, domain). The operator hovers over a node to highlight its direct neighbors, clicks a node to inspect its details (label, type, metadata, connected edges), and uses type/relationship filters to narrow the view. The graph supports zoom, pan, and drag interactions.

**Why this priority**: The association graph is the most distinctive and high-value visualization — it reveals concept relationships that are invisible in raw files. This is the core differentiator of the dashboard.

**Independent Test**: Can be fully tested by loading the graph view with sample data and verifying node rendering, hover highlighting, click inspection, and filter controls deliver a usable interactive graph experience.

**Acceptance Scenarios**:

1. **Given** the operator opens the Memory Dashboard, **When** they click the "Graph" tab, **Then** the system displays a force-directed graph with all nodes from the association graph, color-coded by type.
2. **Given** the graph is displayed, **When** the operator hovers over a node, **Then** the node and its direct neighbors (depth 1) are highlighted while unrelated nodes are dimmed.
3. **Given** the graph is displayed, **When** the operator clicks a node, **Then** a detail panel shows the node's label, type, metadata, creation date, and list of connected edges with their relationship types and weights.
4. **Given** the graph is displayed, **When** the operator selects one or more node type filters (e.g., "concept" + "decision"), **Then** only nodes of the selected types and their interconnecting edges are shown.
5. **Given** the graph is displayed, **When** the operator selects a relationship type filter, **Then** only edges of the selected relationship type and their connected nodes are shown.
6. **Given** the graph is displayed, **When** the operator uses scroll wheel, pinch, or pan gestures, **Then** the graph zooms and pans accordingly. Nodes can be dragged to reposition them.
7. **Given** the association graph service is unavailable, **When** the operator opens the Graph tab, **Then** a "Graph data not available" message is displayed with a retry option.

---

### User Story 2 - Search Across All Memory (Priority: P1)

The operator types a query in the unified search bar (always visible at the top of the dashboard). Results appear grouped by source: memory files (with relevance indication) and graph nodes/edges. Clicking a memory result switches to the Explorer tab with that file opened. Clicking a graph result switches to the Graph tab with that node focused and highlighted.

**Why this priority**: Search is the primary discovery mechanism — without it, the operator has no efficient way to find specific information across the entire knowledge base.

**Independent Test**: Can be tested by entering search queries and verifying results appear grouped by source, with correct navigation to the relevant view on click.

**Acceptance Scenarios**:

1. **Given** the operator is on any tab of the Memory Dashboard, **When** they type a query in the unified search bar, **Then** results appear after a short input pause, grouped into "Memory Files" and "Graph Nodes" sections.
2. **Given** search results are displayed, **When** the operator clicks a memory file result, **Then** the view switches to the Explorer tab with the matching file opened and the relevant content visible.
3. **Given** search results are displayed, **When** the operator clicks a graph node result, **Then** the view switches to the Graph tab with the matching node centered and highlighted.
4. **Given** no results match the query, **When** the search completes, **Then** a "No results found" message is displayed.
5. **Given** the operator types in the search bar, **When** they clear the input, **Then** the search results panel closes and the current tab view is restored.

---

### User Story 3 - Browse and Edit Memory Files (Priority: P2)

The operator opens the Explorer tab to browse slashbot's memory files as a file tree. Clicking a file displays its contents with markdown rendering. The operator can edit an entry inline (saved by replacing the file content directly), delete an entry, or add a new quick note (appended to today's daily note).

**Why this priority**: Direct memory manipulation gives the operator control over what slashbot knows — essential for correcting errors or removing outdated information, but secondary to visualization and search.

**Independent Test**: Can be tested by browsing the file tree, opening files, editing content, deleting entries, and adding notes — verifying each operation persists correctly.

**Acceptance Scenarios**:

1. **Given** the operator opens the Explorer tab, **When** the memory file listing loads, **Then** a file tree of the memory directory is displayed showing all memory files organized by folder structure.
2. **Given** the file tree is displayed, **When** the operator clicks a file, **Then** the file contents are displayed with markdown rendering in a content panel beside the tree.
3. **Given** a file is open in the content panel, **When** the operator clicks "Edit", **Then** the content becomes editable in a text editor area. Saving replaces the file content directly and shows a success confirmation.
4. **Given** a file is open in the content panel, **When** the operator clicks "Delete" and confirms, **Then** the entry is removed and the file tree updates to reflect the deletion.
5. **Given** the Explorer tab is active, **When** the operator clicks "Add Note" and enters text, **Then** a new quick note is appended to today's daily note file and the tree refreshes.
6. **Given** the memory directory is empty, **When** the operator opens the Explorer tab, **Then** an empty state message is shown with a prompt to add the first note.

---

### User Story 4 - Review Recent Activity on Timeline (Priority: P2)

The operator opens the Timeline tab to see a chronological view of daily notes, grouped by day. Each entry shows a timestamp, tags, and a preview. Clicking an entry expands it to show the full content. The timeline supports "load more" pagination for older entries.

**Why this priority**: Timeline provides temporal context for how memory evolves — useful for understanding recent learning patterns, but less critical than graph exploration and search.

**Independent Test**: Can be tested by loading the timeline view, verifying entries are grouped by day in reverse chronological order, and confirming expand/collapse and pagination work correctly.

**Acceptance Scenarios**:

1. **Given** the operator opens the Timeline tab, **When** daily notes exist, **Then** entries are displayed grouped by day in reverse chronological order (newest first), showing timestamp, tags, and a text preview.
2. **Given** a timeline entry is displayed, **When** the operator clicks on it, **Then** the entry expands to show the full markdown-rendered content.
3. **Given** the timeline has more entries than the initial page, **When** the operator scrolls to the bottom or clicks "Load more", **Then** additional older entries are loaded and appended.
4. **Given** no daily notes exist, **When** the operator opens the Timeline tab, **Then** an empty state message is displayed indicating no activity has been recorded yet.

---

### User Story 5 - Monitor Memory Statistics (Priority: P3)

A stats bar at the top of the Memory Dashboard (always visible) shows key metrics: graph node count, edge count, node type distribution, memory file count, chunk count, last indexed timestamp, and a recent activity indicator (entries per day for the last 7 days).

**Why this priority**: Stats provide at-a-glance context but are supplementary to the interactive views. The dashboard is useful without stats; stats alone are not useful without the views.

**Independent Test**: Can be tested by loading the dashboard and verifying all stat values are displayed, refresh correctly on tab switches, and show appropriate fallbacks when data is unavailable.

**Acceptance Scenarios**:

1. **Given** the operator opens the Memory Dashboard, **When** the page loads, **Then** the stats bar displays graph node count, edge count, memory file count, chunk count, and last indexed timestamp.
2. **Given** the stats bar is visible, **When** the operator switches between tabs, **Then** the stats refresh with current data.
3. **Given** the association graph service is unavailable, **When** stats are loaded, **Then** graph-related stats show "N/A" while memory stats still display correctly.
4. **Given** the stats bar is visible, **When** daily notes exist for recent days, **Then** a recent activity indicator shows the entry count trend for the last 7 days.

---

### Edge Cases

- What happens when the graph contains more than 5,000 nodes? The system SHOULD provide a performance warning and suggest applying filters to reduce the visible set.
- What happens when a memory file is modified externally while the Explorer has it open? The system SHOULD detect the change on the next API call and prompt the operator to reload.
- What happens when the operator edits a file and the save fails? The edited content MUST be preserved in the editor so the operator can retry without losing their changes.
- What happens when search returns results from both memory and graph but one source errors? The system MUST display the successful source results and show an error indicator for the failed source.

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Graph data fetch fails (service unavailable) | "Unable to load graph data. The association graph service may not be running." | Retry button; memory views remain functional |
| Memory file listing fails | "Unable to load memory files. Please check that the memory directory exists." | Retry button |
| Memory file save fails | "Failed to save changes. Your edits are preserved — please try again." | Retry button; edited content stays in editor |
| Memory file delete fails | "Failed to delete this entry. Please try again." | Retry button; entry remains in tree |
| Search request fails | "Search encountered an error. Please try again." | Retry button; partial results from successful source shown |
| Timeline data fetch fails | "Unable to load timeline data." | Retry button |
| Stats refresh fails | Stats show stale values with a "Last updated: [time]" indicator | Auto-retry on next tab switch |
| Network connection lost | "Connection lost. Dashboard data may be stale." | Auto-reconnect indicator; manual refresh button |

## Requirements *(mandatory)*

### Functional Requirements

#### Layout & Navigation

- **FR-001**: The Memory Dashboard MUST be accessible as a new tab within the existing admin dashboard navigation.
- **FR-002**: The dashboard MUST display a persistent stats bar and unified search input at the top of the page, visible across all tabs.
- **FR-003**: The dashboard MUST provide tabbed navigation between Graph, Explorer, and Timeline views.
- **FR-004**: Tab state MUST be preserved when switching between tabs (e.g., graph zoom level, open file in explorer, scroll position in timeline).

#### Interactive Graph (View A)

- **FR-010**: The system MUST render an interactive force-directed graph visualization from the association graph data.
- **FR-011**: Nodes MUST be visually distinguished by type using distinct colors AND a secondary visual cue (shape or text label) for each node type (concept, tool, decision, person, project, domain). Color MUST NOT be the sole means of conveying node type.
- **FR-012**: Edges MUST display their relationship label and visually indicate weight (e.g., via thickness or opacity).
- **FR-013**: Hovering over a node MUST highlight that node and its direct neighbors (depth 1), dimming all other elements.
- **FR-014**: Clicking a node MUST display a detail panel showing label, type, metadata, creation date, and connected edges.
- **FR-015**: The system MUST provide filter controls for node types and relationship types, allowing the operator to show/hide categories.
- **FR-016**: The graph MUST support zoom (scroll wheel / pinch), pan (drag on background), and node repositioning (drag on node).
- **FR-017**: When the association graph service is unavailable (not yet implemented or not running), the system MUST display a graceful degradation message on the Graph tab while other tabs remain functional. The AssociationGraph is an optional runtime dependency — the dashboard MUST NOT fail to load if this service is absent.

#### Memory Explorer (View B)

- **FR-020**: The system MUST display the memory directory contents as a navigable file tree.
- **FR-021**: Clicking a file in the tree MUST display its contents with markdown rendering.
- **FR-022**: The system MUST allow inline editing of memory entries, saving changes by replacing the file content directly (not via MemoryStore.upsert, which is append-only).
- **FR-023**: The system MUST allow deletion of individual memory entries with a confirmation prompt.
- **FR-024**: The system MUST provide a "quick note" form that appends content to the current day's daily note.

#### Timeline (View C)

- **FR-030**: The system MUST display daily notes in reverse chronological order, grouped by day.
- **FR-031**: Each timeline entry MUST show a timestamp, tags (if present), and a text preview.
- **FR-032**: Clicking a timeline entry MUST expand it to show the full content with markdown rendering.
- **FR-033**: The timeline MUST support "load more" pagination to fetch older entries.

#### Stats & Metrics (Top Bar)

- **FR-040**: The stats bar MUST display: graph node count, graph edge count, memory file count, memory chunk count, and last indexed timestamp.
- **FR-041**: The stats bar MUST display a node type distribution summary (count per type).
- **FR-042**: The stats bar MUST display a recent activity indicator showing entry counts for the last 7 days.
- **FR-043**: Stats MUST refresh when the operator switches tabs or after a polling interval (default: 30 seconds).

#### Unified Search (Top Bar)

- **FR-050**: The unified search MUST query both the memory store (BM25 full-text search) and the association graph (case-insensitive substring match on node labels) from a single input. If the graph service is unavailable, search MUST return only memory results without error.
- **FR-051**: Search results MUST be grouped by source (Memory Files and Graph Nodes/Edges).
- **FR-052**: Clicking a memory file result MUST navigate to the Explorer tab with the file opened.
- **FR-053**: Clicking a graph node result MUST navigate to the Graph tab with the node centered and highlighted.
- **FR-054**: Search input MUST be debounced (300ms minimum) to avoid excessive requests during typing.

### Key Entities

- **Memory File**: A file within the memory directory representing stored knowledge. Has a path, content (markdown), and metadata (tags, timestamps).
- **Graph Node**: A concept in the association graph. Identified by ID, with a label, type (concept/tool/decision/person/project/domain), optional metadata, and creation date.
- **Graph Edge**: A directed, weighted relationship between two graph nodes. Has source node, target node, relationship type, weight (0.0-1.0), and creation date.
- **Search Result**: A unified result item from either memory search or graph search, containing source type, display text, relevance indication, and a navigation target.
- **Timeline Entry**: A daily note entry with day grouping, timestamp, tags, preview text, and full content.

## Accessibility Requirements *(mandatory for UI features)*

| Requirement | Applies? | Acceptance Criteria |
|-------------|----------|---------------------|
| Keyboard navigation | Yes | All tabs, filters, tree items, buttons, and search reachable via Tab. Enter/Space activates. Arrow keys navigate file tree and graph node selection. |
| Screen reader support | Yes | Tabs have ARIA roles, graph nodes announced with label and type, file tree uses tree/treeitem roles, search results use live region for count announcement. |
| Color contrast | Yes | 4.5:1 for body text and node labels, 3:1 for graph edge labels and badge text. Node type colors tested against dark and light backgrounds. |
| Focus indicators | Yes | Visible focus ring on all interactive elements including graph nodes when keyboard-selected. |
| Reduced motion | Yes | Force-directed graph layout animation and hover transitions respect `prefers-reduced-motion` (instant layout, no animation). |
| Touch targets | N/A | Desktop-first; not a primary concern. Graph interaction via mouse. |

**Additional accessibility notes**: Graph visualization must provide a text-based alternative (node list with connections) accessible via screen reader. Stats bar values must be in ARIA live regions so updates are announced.

## Performance Requirements *(include if performance-sensitive)*

| Metric | Target | Justification |
|--------|--------|---------------|
| Dashboard page load (LCP) | < 2.5s | Consistent with existing web UI targets |
| Graph initial render | < 3s for up to 1,000 nodes | Force-directed layout computation is CPU-intensive; 1K nodes is the expected 90th percentile |
| Graph interaction response | < 100ms | Hover, click, and drag must feel immediate |
| Search response (end-to-end) | < 500ms | Combined memory BM25 + graph search; user perceives instant results |
| Memory file tree load | < 1s | File listing from local filesystem is fast |
| Stats refresh | < 500ms | Background non-blocking; stale data acceptable briefly |
| Graph with 5,000+ nodes | Functional with performance warning | Degraded but usable; filters recommended |

## Security Considerations *(mandatory — memory editing involves user input)*

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Input validation (memory edits) | Validate at API boundary | Memory content is free-text markdown; validate file path parameters to prevent path traversal |
| Authentication | Bearer token (existing) | All memory API endpoints require authenticated requests, consistent with existing web UI auth |
| Path traversal on file operations | Validate paths are within memory directory | File read/write/delete endpoints MUST reject paths outside the configured memory directory |
| XSS via markdown rendering | Sanitize rendered HTML | Markdown content rendered client-side MUST be sanitized to prevent script injection |
| Deletion safeguards | Confirmation prompt required | Prevent accidental data loss; no bulk delete capability |
| Rate limiting | Standard API rate limits | Consistent with existing gateway API rate limiting |

## Data & State *(mandatory — feature reads/writes persistent memory)*

- **Data ownership**: Self-hosted operator owns all memory data.
- **Storage locations**: Memory files in `~/.slashbot/memory/` (markdown files), graph data in `~/.slashbot/graph.jsonl` (JSONL). No new storage locations created by this feature.
- **Access control**: Single authenticated operator has full read/write/delete access.
- **Retention policy**: Memory entries persist until explicitly deleted by the operator. No automatic expiration.
- **Concurrent modification**: Last-write-wins for memory edits (single-user system). If a file changes externally, the next read reflects the current state.
- **Sync behavior**: Dashboard reads current state on each request; no real-time push. Stats refresh on tab switch or polling interval (30s default).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The operator can visualize the full association graph (up to 1,000 nodes) as an interactive force-directed graph, with node type filtering and neighbor highlighting, within 3 seconds of opening the Graph tab.
- **SC-002**: The operator can search across both memory files and graph nodes from a single search input and navigate directly to any result in under 2 seconds end-to-end.
- **SC-003**: The operator can browse memory files, open and read any file with markdown rendering, and edit/save an entry in under 5 clicks from the Explorer tab.
- **SC-004**: The operator can view a chronological timeline of daily notes grouped by day and expand any entry to read full content.
- **SC-005**: The dashboard displays current memory and graph statistics, refreshing on tab switches, with graceful degradation when the graph service is unavailable.
- **SC-006**: All memory editing operations (upsert, delete, quick note) persist correctly and are reflected immediately in the dashboard views.

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [ideas/005-web-ui/idea.md](../../ideas/005-web-ui/idea.md)
- **Feature**: [ideas/005-web-ui/features/06-graph-visualization.md](../../ideas/005-web-ui/features/06-graph-visualization.md)

### Technical Constraints
- Must work with slashbot's existing InversifyJS DI architecture and plugin system
- Frontend must be lightweight (no React/Vue/Svelte build pipeline)
- PenguinUI (Alpine.js + Tailwind CSS) for component library
- Static HTML + Alpine.js served by the existing gateway server
- Existing bearer token auth sufficient for single-user access

### Implementation Guidance
- **Cytoscape.js** (CDN): Graph rendering and interaction library
- **Alpine.js 3.x** (CDN): Reactive UI, consistent with existing web UI features
- **Tailwind CSS** (CDN): Styling, consistent with existing features
- **marked** (CDN): Markdown rendering for memory content
- Graph data fetched as JSON, transformed to Cytoscape elements format
- Memory file editing uses direct file write (replace content) for edits; `memory.upsert` / `appendToday` used only for "Add Note" (append-style)
- File listing and deletion handled directly via filesystem operations (MemoryStore.listFiles() is private, no delete method exists)
- Stats bar refreshes on tab switch or polling interval (30s)
- Search debounced (300ms) to avoid excessive API calls
- Consider lazy-loading graph data for large graphs (initial load = stats + top-level, expand on interaction)
- Cytoscape.js should handle up to 10K nodes with canvas renderer

### API Endpoints (from feature file)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/memory/stats` | GET | Memory + graph stats |
| `/api/memory/search` | GET | Unified search across MemoryStore and AssociationGraph |
| `/api/memory/files` | GET | List memory files (tree structure) |
| `/api/memory/files/:path` | GET | Read a specific memory file |
| `/api/memory/files/:path` | PUT | Update (upsert) a memory entry |
| `/api/memory/files/:path` | DELETE | Delete a memory entry |
| `/api/memory/notes` | POST | Quick note (appendToday) |
| `/api/memory/timeline` | GET | Recent daily notes (paginated) |
| `/api/memory/graph` | GET | Full graph data (nodes + edges) |
| `/api/memory/graph/neighbors/:id` | GET | Node neighbors (depth param) |

### Backend Services Used
- **MemoryStore** (`memory.store`): search, get, upsert, stats, appendToday, getRecentNotes
- **AssociationGraph** (`memory.graph`): nodes, edges, neighbors, stats

### Discovery Decisions
- Cytoscape.js selected for graph rendering (canvas-based, handles large graphs, rich interaction API)
- CDN-only frontend stack (no build step), consistent with entire web UI architecture
- Graph is read-only from UI (built by the bot); only memory files are editable
- Timeline uses "load more" pagination (not infinite scroll) for predictable behavior
