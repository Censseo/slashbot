# Tasks: Memory Dashboard

**Input**: Design documents from `/specs/012-memory-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tools.md
**Testing approach**: Per constitution §Test-First, each handler implementation task (T005-T010) should include unit tests written before implementation (Red-Green-Refactor). Frontend tasks should include manual verification. Tests are not separate tasks but are part of each implementation task.

## Format: `[ID] [P?] [Story?] [Reuse?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US5)
- **[Reuse]**: REUSE / EXTEND / NEW per research.md decisions
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization — create file skeletons and add CDN dependency

- [X] T001 [EXTEND] Add Cytoscape.js CDN script tag to `frontend/public/index.html` (before Alpine.js, after marked/DOMPurify)
- [X] T002 [P] [EXTEND] Add Memory navigation button and page container div to `frontend/public/index.html` — add `currentPage === 'memory'` button in nav bar, add `<div x-show="currentPage === 'memory'" x-data="memory()" x-effect="...">` page container following existing dashboard pattern
- [X] T003 [P] [NEW] Create `frontend/public/js/memory.js` skeleton — Alpine.js component function `memory()` returning state object with sub-tab management (activeTab: 'graph'), onShow/onHide lifecycle, stats/search/graph/explorer/timeline state placeholders, and auth token pattern from dashboard.js
- [X] T004A [P] [EXTEND] Add `<script src="js/memory.js"></script>` tag to `frontend/public/index.html` (before Alpine.js defer script, after dashboard.js) — required for Alpine.js to initialize the memory() component

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, schemas, and route registration that ALL user stories depend on

- [X] T004 [EXTEND] Add memory-related Zod schemas and TypeScript interfaces to `src/plugins/webui/types.ts` — add SearchQuerySchema, FileContentSchema, QuickNoteSchema, TimelineQuerySchema, NeighborQuerySchema, and all response interfaces (CombinedStats, MemoryFileNode, MemoryFileContent, GraphData, UnifiedSearchResult, TimelineDay, etc.) per data-model.md
- [X] T005 [NEW] Create `src/plugins/webui/handlers/memory-stats.ts` — handler factory `createMemoryStatsHandler(context)` that resolves `memory.store` (required) and `memory.graph` (optional, null if absent), returns combined stats response per contracts/tools.md
- [X] T006 [P] [NEW] Create `src/plugins/webui/handlers/memory-search.ts` — handler factory `createMemorySearchHandler(context)` that resolves `memory.store` and optional `memory.graph`, performs BM25 search on memory + label substring match on graph nodes, returns grouped results per contracts/tools.md
- [X] T007 [P] [NEW] Create `src/plugins/webui/handlers/memory-files.ts` — handler factory `createMemoryFilesHandler(context)` that resolves workspace root for memory directory path, implements: GET (list tree via readdir), GET /:path (read file), PUT /:path (replace file content), DELETE /:path (unlink) with path traversal validation per contracts/tools.md
- [X] T008 [P] [NEW] Create `src/plugins/webui/handlers/memory-notes.ts` — handler factory `createMemoryNotesHandler(context)` that resolves `memory.store`, implements POST to call appendToday() per contracts/tools.md
- [X] T009 [P] [NEW] Create `src/plugins/webui/handlers/memory-timeline.ts` — handler factory `createMemoryTimelineHandler(context)` that resolves `memory.store` and workspace root, parses daily note files into TimelineDay[] grouped by day per contracts/tools.md
- [X] T010 [P] [NEW] Create `src/plugins/webui/handlers/memory-graph.ts` — handler factory `createMemoryGraphHandler(context)` that resolves optional `memory.graph`, implements: GET /api/memory/graph (full graph data), GET /api/memory/graph/neighbors/:id (neighbor query) with 503 when service unavailable per contracts/tools.md
- [X] T011 [EXTEND] Register all 10 memory API routes in `src/plugins/webui/index.ts` — import all 6 handler factories, call each, register via `context.registerHttpRoute()` with correct method/path/description following existing pattern (after existing route registrations)

**Checkpoint**: All API endpoints respond and frontend skeleton renders. User story implementation can begin.

---

## Phase 3: User Story 1 - Explore the Knowledge Graph (Priority: P1)

**Goal**: Interactive force-directed graph visualization with node type filtering, hover highlighting, click inspection, and graceful degradation when graph service is unavailable.

**Independent Test**: Load Memory page, click Graph tab, verify graph renders with colored nodes, hover highlights neighbors, click shows detail panel, filters work, zoom/pan/drag functional.

### Implementation for User Story 1

- [X] T012 [US1] [NEW] Implement graph data loading in `frontend/public/js/memory.js` — add `loadGraphData()` method that fetches GET /api/memory/graph, transforms response to Cytoscape elements format (nodes with type-based classes, edges with rel/weight data), stores in `this.graphData`, handles 503/error with graceful degradation message
- [X] T013 [US1] [NEW] Implement Cytoscape.js graph initialization in `frontend/public/js/memory.js` — add `initGraph()` method that creates Cytoscape instance on graph container div, applies force-directed layout (cose or cola), defines node styles with distinct colors AND shapes per node type (concept=circle/blue, tool=diamond/green, decision=triangle/orange, person=pentagon/purple, project=square/teal, domain=hexagon/red), defines edge styles with weight-based thickness/opacity and relationship labels
- [X] T014 [US1] [NEW] Implement graph interaction handlers in `frontend/public/js/memory.js` — add hover handler (highlight node + depth-1 neighbors, dim others), click handler (populate detail panel with node label/type/metadata/created/connected edges), tap-on-background (clear selection), drag (reposition node), zoom/pan (default Cytoscape behavior)
- [X] T015 [US1] [NEW] Implement graph filter controls in `frontend/public/js/memory.js` — add `graphNodeTypeFilters` and `graphRelTypeFilters` state arrays, `toggleNodeTypeFilter(type)` / `toggleRelTypeFilter(rel)` methods that show/hide Cytoscape elements by class, render filter UI as checkbox/toggle buttons above graph
- [X] T016 [US1] [NEW] Implement Graph tab HTML in `frontend/public/index.html` (inside memory page div) — add graph container div (full width/height for Cytoscape), node detail sidebar/popover panel (shown on click), filter controls bar, "Graph data not available" fallback message (shown when `graphError` is true), `prefers-reduced-motion` check to disable layout animation
- [X] T017 [US1] [NEW] Implement graph accessibility in `frontend/public/js/memory.js` — add keyboard navigation for graph nodes (arrow keys cycle through nodes, Enter selects, Escape deselects), ARIA labels on graph container, screen-reader-only node list alternative (hidden table of nodes with connections)

**Checkpoint**: Graph tab fully functional — renders graph, hover/click/filter/zoom/pan work, degrades gracefully without graph service.

---

## Phase 4: User Story 2 - Search Across All Memory (Priority: P1)

**Goal**: Unified search bar querying both memory store and graph from a single input, with grouped results and navigation to relevant view/tab on click.

**Independent Test**: Type a query in search bar, verify results appear grouped by source (Memory/Graph), click memory result navigates to Explorer with file open, click graph result navigates to Graph with node focused.

### Implementation for User Story 2

- [X] T018 [US2] [NEW] Implement search state and data loading in `frontend/public/js/memory.js` — add `searchQuery`, `searchResults`, `isSearching` state, `performSearch()` method that fetches GET /api/memory/search?q=...&limit=20, `debouncedSearch()` with 300ms debounce, clear results on empty input
- [X] T019 [US2] [NEW] Implement search result navigation in `frontend/public/js/memory.js` — add `navigateToMemoryResult(path)` that sets activeTab='explorer', opens the file in explorer, `navigateToGraphResult(nodeId)` that sets activeTab='graph', centers and highlights the node in Cytoscape (using `cy.getElementById().select()` + `cy.animate({ center, zoom })`)
- [X] T020 [US2] [NEW] Implement search UI in `frontend/public/index.html` (inside memory page top bar) — add search input with debounced `@input`, search results dropdown/panel with two sections ("Memory Files" showing path/text/score, "Graph Nodes" showing label/type/edges), click handlers calling navigation methods, "No results found" empty state, loading indicator, ARIA live region for result count announcement
- [X] T021 [US2] Integrate search with Graph and Explorer tabs in `frontend/public/js/memory.js` — ensure `navigateToMemoryResult` triggers explorer file load, `navigateToGraphResult` triggers graph node focus/highlight, handle case where graph data not loaded yet (load on demand)

**Checkpoint**: Search bar works from any tab — finds memory files and graph nodes, navigates correctly to the matching view.

---

## Phase 5: User Story 3 - Browse and Edit Memory Files (Priority: P2)

**Goal**: File tree browser for memory directory with markdown rendering, inline editing (file replace), deletion with confirmation, and quick note creation.

**Independent Test**: Open Explorer tab, verify file tree renders, click file shows markdown content, edit and save works, delete with confirmation works, add note appends to today's file.

### Implementation for User Story 3

- [X] T022 [US3] [NEW] Implement file tree loading and state in `frontend/public/js/memory.js` — add `fileTree`, `selectedFile`, `fileContent`, `isEditing`, `editContent` state, `loadFileTree()` method fetching GET /api/memory/files, `loadFileContent(path)` fetching GET /api/memory/files/:path
- [X] T023 [US3] [NEW] Implement file editing and deletion in `frontend/public/js/memory.js` — add `startEdit()` (copies content to editContent), `saveEdit()` (PUT /api/memory/files/:path with editContent, preserve content on failure), `cancelEdit()`, `deleteFile(path)` (DELETE with confirmation prompt, refresh tree on success), `addNote(text)` (POST /api/memory/notes, refresh tree)
- [X] T024 [US3] [NEW] Implement Explorer tab HTML in `frontend/public/index.html` (inside memory page div) — add two-panel layout: left panel with file tree using `role="tree"` and `role="treeitem"` ARIA roles, expandable folders with arrow key navigation; right panel with markdown-rendered content (using marked + DOMPurify), Edit/Delete action buttons, text editor area (shown when isEditing), Save/Cancel buttons, success/error toast
- [X] T025 [US3] [NEW] Implement Quick Note form in `frontend/public/index.html` (inside Explorer tab) — add "Add Note" button that reveals a text input + submit form, calls `addNote()`, clears on success, shows error on failure, empty state message when no files exist

**Checkpoint**: Explorer tab fully functional — file tree, markdown viewer, edit/save, delete, quick note all work.

---

## Phase 6: User Story 4 - Review Recent Activity on Timeline (Priority: P2)

**Goal**: Chronological view of daily notes grouped by day with expand/collapse and "load more" pagination.

**Independent Test**: Open Timeline tab, verify entries grouped by day (newest first), click entry expands full content, "Load more" fetches older entries.

### Implementation for User Story 4

- [X] T026 [US4] [NEW] Implement timeline state and data loading in `frontend/public/js/memory.js` — add `timelineDays`, `timelineLoading`, `timelineHasMore` state, `loadTimeline(days, offset)` method fetching GET /api/memory/timeline?days=7&offset=0, `loadMoreTimeline()` that increments offset and appends results
- [X] T027 [US4] [NEW] Implement Timeline tab HTML in `frontend/public/index.html` (inside memory page div) — add day-grouped timeline layout with date headers, entry cards showing timestamp/tags/preview, click-to-expand with full markdown content (marked + DOMPurify), "Load more" button at bottom, empty state message, loading indicator

**Checkpoint**: Timeline tab fully functional — displays daily notes grouped by day, expand/collapse works, pagination loads older entries.

---

## Phase 7: User Story 5 - Monitor Memory Statistics (Priority: P3)

**Goal**: Always-visible stats bar showing graph metrics, memory metrics, node type distribution, and recent activity indicator.

**Independent Test**: Load Memory page, verify stats bar shows node/edge/file/chunk counts and last indexed timestamp, stats refresh on tab switch, graph stats show "N/A" when graph service unavailable.

### Implementation for User Story 5

- [X] T028 [US5] [NEW] Implement stats loading and refresh in `frontend/public/js/memory.js` — add `stats`, `statsLoading`, `statsError` state, `loadStats()` method fetching GET /api/memory/stats, integrate into `onShow()` lifecycle + tab switch handler + 30s polling interval, clear interval in `onHide()`
- [X] T029 [US5] [NEW] Implement stats bar HTML in `frontend/public/index.html` (inside memory page top bar, above tabs) — add stats row showing: graph nodes (or "N/A"), graph edges (or "N/A"), memory files, chunks, last indexed, node type distribution badges, recent activity sparkline/indicator (7-day entry counts), ARIA live region for stats updates
- [X] T030 [US5] Wire stats refresh to tab switching in `frontend/public/js/memory.js` — ensure `loadStats()` is called on each sub-tab switch (graph/explorer/timeline) and on initial page show, handle partial stats (graph null) gracefully

**Checkpoint**: Stats bar displays all metrics, refreshes correctly, handles graph service absence.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, error handling, keyboard navigation, and final integration

- [X] T031 [P] Implement keyboard navigation for sub-tabs in `frontend/public/js/memory.js` — Tab key cycles between Graph/Explorer/Timeline tabs, Enter/Space activates, focus management on tab switch
- [X] T032 [P] Implement comprehensive error handling in `frontend/public/js/memory.js` — unified `_handleUnauthorized()` for 401 responses (navigate to chat + token prompt), network error display with retry buttons, partial failure handling (one source errors in search), "Last updated" indicator for stale stats
- [X] T033 [P] Implement `prefers-reduced-motion` support in `frontend/public/js/memory.js` — check `window.matchMedia('(prefers-reduced-motion: reduce)')`, disable Cytoscape layout animation, disable hover transitions, use instant layout positioning
- [X] T034 [P] Implement tab state preservation in `frontend/public/js/memory.js` — save and restore Cytoscape viewport (zoom/pan) when switching away from Graph tab, preserve selectedFile and scroll position in Explorer, preserve scroll position and expanded entries in Timeline (per FR-004)
- [X] T035 Review and validate all 10 API endpoints against contracts/tools.md — verify request/response shapes match, error codes match, path parameter handling correct

**Checkpoint**: All user stories functional, accessible, error-handled. Feature complete.

---

## Phase 9: Review Corrections (2026-03-17)

**Source**: Code review `reviews/review-2026-03-17.md` | **Branch**: `012-memory-dashboard`

### Security

- [X] T036 [CRITICAL] Fix double `decodeURIComponent` in `memory-files.ts:validatePath` — removed duplicate decode to prevent path traversal bypass (S-1)

### Code Quality

- [X] T037 Extract `AssociationGraphLike` interface to `src/plugins/webui/types.ts` — removed duplicate definitions from 3 handler files (C-1)
- [X] T038 Extract `readBody` utility to `src/plugins/webui/handlers/utils.ts` — removed duplicate from memory-files.ts and memory-notes.ts (C-2)
- [X] T039 Use `path.dirname()` instead of `lastIndexOf('/')` in memory-files.ts handleWrite (M-1)
- [X] T040 Remove unused `_savedExplorerScroll`/`_savedTimelineScroll` vars from memory.js (DC-1)
- [X] T041 Use `|` delimiter for Cytoscape edge IDs to prevent collision with hyphenated node IDs (C-5)
- [X] T042 Remove redundant `loadStats()` from `switchTab()` — already polled via 30s interval (C-6)

### Safety

- [X] T043 Add depth limit (5 levels) and symlink skip to `buildTree()` in memory-files.ts (P-2)
- [X] T044 Increase timeline scan multiplier from 3x to 30x to prevent silent truncation (F-2)

**Checkpoint**: All review corrections applied.

---

## Phase 10: Validation Corrections (Added 2026-03-17)

**Source**: QA validation report `validation/report-2026-03-17.md` | **Branch**: `012-memory-dashboard`

### Bug Fixes

- [X] T045 [CRITICAL] [US2] Fix search result path prefix — strip `memory/` prefix from MemoryStore search paths in `src/plugins/webui/handlers/memory-search.ts` so search→explorer navigation works (BUG-001)
- [X] T046 [MEDIUM] [US5] Re-add `loadStats()` call to `switchTab()` in `frontend/public/js/memory.js` — FR-043 requires stats refresh on tab switch, not just 30s polling (BUG-003, reverts T042)
- [X] T047 [LOW] [US3] Strip `memory/` prefix from `store.appendToday()` result path in `src/plugins/webui/handlers/memory-notes.ts` for consistency with file tree paths (BUG-002)

**Checkpoint**: All validation bugs fixed. Re-run `/specforge.qa` to verify.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001-T003)
- **Phase 3 (US1 Graph)**: Depends on Phase 2 — specifically T004 (types), T010 (graph handler), T011 (route registration)
- **Phase 4 (US2 Search)**: Depends on Phase 2 — specifically T004 (types), T006 (search handler), T011 (routes). Benefits from US1 graph being loaded but works independently.
- **Phase 5 (US3 Explorer)**: Depends on Phase 2 — specifically T004 (types), T007 (files handler), T008 (notes handler), T011 (routes)
- **Phase 6 (US4 Timeline)**: Depends on Phase 2 — specifically T004 (types), T009 (timeline handler), T011 (routes)
- **Phase 7 (US5 Stats)**: Depends on Phase 2 — specifically T004 (types), T005 (stats handler), T011 (routes)
- **Phase 8 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Graph)**: Independent after Phase 2. No dependency on other stories.
- **US2 (Search)**: Independent after Phase 2. Navigation to graph/explorer tabs benefits from US1/US3 being implemented but search itself works standalone.
- **US3 (Explorer)**: Independent after Phase 2. No dependency on other stories.
- **US4 (Timeline)**: Independent after Phase 2. No dependency on other stories.
- **US5 (Stats)**: Independent after Phase 2. No dependency on other stories.

### Parallel Opportunities

```text
Phase 2 (after T004):
  T005, T006, T007, T008, T009, T010 — all handler factories in separate files [P]

After Phase 2:
  US1, US2, US3, US4, US5 — all independent, can run in parallel

Phase 8:
  T031, T032, T033, T034 — all in parallel [P]
```

---

## Implementation Strategy

### MVP First (Graph + Search)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T011)
3. Complete Phase 3: US1 Graph (T012-T017) — core differentiator
4. Complete Phase 4: US2 Search (T018-T021) — primary discovery
5. **STOP and VALIDATE**: Graph renders, search works, navigation between views functional
6. Continue with US3-US5 incrementally

---

## Idea Technical Traceability

**Source Idea**: [ideas/005-web-ui/features/06-graph-visualization.md](../../ideas/005-web-ui/features/06-graph-visualization.md)

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| Cytoscape.js (CDN) for graph rendering | T001, T013 | Mapped |
| Alpine.js 3.x reactive UI | T003, all frontend tasks | Mapped |
| Tailwind CSS styling | T002, all HTML tasks | Mapped |
| marked for markdown rendering | T024, T027 (already loaded) | Mapped |
| Force-directed graph with node type colors | T013, T016 | Mapped |
| Node hover neighbor highlight (depth 1) | T014 | Mapped |
| Node click detail panel | T014, T016 | Mapped |
| Node type and relationship type filters | T015, T016 | Mapped |
| Zoom, pan, drag nodes | T014 (default Cytoscape) | Mapped |
| File tree of memory directory | T022, T024 | Mapped |
| Inline edit via upsert → direct file write | T023 (PUT endpoint) | Mapped (divergence documented) |
| Delete individual entries | T023, T024 | Mapped |
| Quick note form → appendToday | T023, T025 | Mapped |
| Timeline chronological view | T026, T027 | Mapped |
| "Load more" pagination | T026 | Mapped |
| Stats bar: node/edge/file/chunk counts | T028, T029 | Mapped |
| Activity indicator (7-day) | T028, T029 | Mapped |
| Unified search (BM25 + graph) | T018, T020 | Mapped |
| Search debounced (300ms) | T018 | Mapped |
| Stats refresh on tab switch / 30s polling | T028, T030 | Mapped |
| Graceful degradation when graph unavailable | T005, T012, T029 | Mapped |
| GET /api/memory/stats | T005 | Mapped |
| GET /api/memory/search | T006 | Mapped |
| GET /api/memory/files | T007 | Mapped |
| GET/PUT/DELETE /api/memory/files/:path | T007 | Mapped |
| POST /api/memory/notes | T008 | Mapped |
| GET /api/memory/timeline | T009 | Mapped |
| GET /api/memory/graph | T010 | Mapped |
| GET /api/memory/graph/neighbors/:id | T010 | Mapped |

### Divergences from Idea

| Idea Specified | Task Implements | Justification |
|----------------|-----------------|---------------|
| Memory file editing via `memory.upsert` | Direct file write (PUT replaces content) | MemoryStore.upsert() is append-only; editing requires full file replace. Documented in Clarifications §Session 2026-03-17 and Research §Decision 1. |

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 2 | (MemoryStore, AssociationGraph services wired in handlers) |
| EXTEND | 4 | T001, T002, T004, T011 |
| NEW | 29 | T003, T005-T010, T012-T035 |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| index.html (nav + page div) | EXTEND | T001, T002 | Add Memory tab to existing SPA |
| types.ts (Zod schemas) | EXTEND | T004 | Add memory-specific schemas to existing file |
| webui/index.ts (routes) | EXTEND | T011 | Register 10 new routes in existing plugin setup |
| MemoryStore service | REUSE | T005, T006, T008, T009 | Wire existing service via `context.getService('memory.store')` |
| AssociationGraph service | REUSE | T005, T006, T010 | Wire optional service via `context.getService('memory.graph')` |
| memory-stats.ts | NEW | T005 | No existing stats endpoint — Research §Decision 1 |
| memory-search.ts | NEW | T006 | No existing unified search endpoint — Research §Decision 4 |
| memory-files.ts | NEW | T007 | No existing file CRUD endpoints — Research §Decision 2 |
| memory-notes.ts | NEW | T008 | No existing quick note endpoint |
| memory-timeline.ts | NEW | T009 | No existing timeline endpoint |
| memory-graph.ts | NEW | T010 | No existing graph data endpoint |
| memory.js (frontend) | NEW | T003, T012-T030 | No existing memory dashboard UI |

**Reuse ratio**: 6 REUSE/EXTEND vs 29 NEW. NEW > 50% because this is an entirely new dashboard page with new API endpoints. Existing services (MemoryStore, AssociationGraph) are reused as data sources. All NEW tasks follow existing patterns from the codebase (handler factories, Alpine.js components).
