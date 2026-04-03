# Tasks: Admin Dashboard

**Input**: Design documents from `/specs/010-admin-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Test tasks included for backend handler only (constitution requires TDD for services).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No new project setup needed — extending existing webui plugin and frontend.

- [x] T001 [REUSE] Verify existing backend endpoints work: GET /api/plugins, GET /api/logs, RPC webui.systemInfo — run slashbot with gateway and test manually or via curl

**Checkpoint**: Existing API endpoints confirmed functional

---

## Phase 2: Foundational (Backend Extension)

**Purpose**: Add the one new backend endpoint and extend SSE client — MUST complete before frontend work

- [x] T002 [NEW] Create status indicators handler in `src/plugins/webui/handlers/status-indicators.ts` — GET /api/status-indicators returning serialized StatusIndicatorRegistry data (id, label, kind, status)
- [x] T003 [P] [NEW] Create status indicators handler test in `tests/plugins/webui/handlers/status-indicators.test.ts` — test returns indicator list, handles empty registry, requires auth
- [x] T004 [EXTEND] Register GET /api/status-indicators route in `src/plugins/webui/index.ts` — add `context.registerHttpRoute()` call following existing pattern for /api/plugins
- [x] T004b [EXTEND] Add memory usage (heapUsed, heapTotal) to `webui.systemInfo` RPC response in `src/plugins/webui/index.ts` — use `process.memoryUsage()` to provide data for the health panel

**Checkpoint**: All 4 backend API endpoints available (plugins, logs, systemInfo, status-indicators)

---

## Phase 3: User Story 1 - Plugin Status Overview (Priority: P1) 🎯 MVP

**Goal**: Display all loaded plugins in a table with status badges and summary counts

**Independent Test**: Load dashboard page → plugin table shows all plugins with name, version, status badges (green/red/gray/yellow)

### Implementation for User Story 1

- [x] T005 [US1] [NEW] Create dashboard Alpine.js component in `frontend/public/js/dashboard.js` — factory function `dashboard()` with state: plugins[], health, indicators[], logs[], logFilter, isLogConnected, isUserScrolledUp, error; init() loads plugins via GET /api/plugins; component receives shared `currentPage` state from a parent Alpine.js store or root component for navigation integration (Phase 6)
- [x] T006 [US1] [EXTEND] Add `connectLogStream()` helper to `frontend/public/js/sse-client.js` — uses EventSource for GET /api/logs with auto-reconnect; callbacks: onLogEntry(entry), onError(), on401()
- [x] T007 [US1] [EXTEND] Update `frontend/public/index.html` — add dashboard container div with plugin table markup (PenguinUI table component), wire `x-data="dashboard()"`, add `<script src="js/dashboard.js">` import
- [x] T008 [P] [US1] [EXTEND] Add dashboard styles to `frontend/public/css/app.css` — status badge colors (green/loaded, red/failed, gray/disabled, yellow/skipped), log level colors, plugin table layout

**Checkpoint**: Plugin table renders with accurate status badges and summary counts

---

## Phase 4: User Story 2 - Live Log Viewer (Priority: P1)

**Goal**: Stream real-time log entries with level filtering, auto-scroll, and 1000-entry DOM cap

**Independent Test**: Open dashboard → log entries stream in real time → filter by level → auto-scroll pauses on scroll up → "scroll to bottom" indicator works

### Implementation for User Story 2

- [x] T009 [US2] [EXTEND] Add log viewer section to `frontend/public/index.html` — scrollable log container, level filter buttons (all/error/warn/info/debug), scroll-to-bottom indicator
- [x] T010 [US2] [EXTEND] Add log streaming logic to `frontend/public/js/dashboard.js` — connect to /api/logs via `connectLogStream()`, append entries to logs[] array, cap at 1000 entries (shift oldest), client-side level filtering via computed/getter
- [x] T011 [US2] [EXTEND] Add auto-scroll behavior to `frontend/public/js/dashboard.js` — detect user scroll-up (pause auto-scroll), show "scroll to bottom" indicator, resume on click or scroll to bottom
- [x] T012 [P] [US2] [EXTEND] Add log entry rendering to `frontend/public/css/app.css` — color-coded level indicators (red/error, orange/warn, blue/info, gray/debug), timestamp formatting, structured fields compact display

**Checkpoint**: Live logs stream with filtering and auto-scroll behavior

---

## Phase 5: User Story 3 - System Health Overview (Priority: P2)

**Goal**: Display system metrics (uptime, memory, plugin counts, connector statuses) with auto-refresh

**Independent Test**: Open dashboard → health panel shows uptime, memory, plugin counts → connector statuses show connected/disconnected → metrics refresh every 30s

### Implementation for User Story 3

- [x] T013 [US3] [EXTEND] Add health panel section to `frontend/public/index.html` — health cards for uptime, memory, plugin counts; status indicators for connectors/services
- [x] T014 [US3] [EXTEND] Add health data fetching to `frontend/public/js/dashboard.js` — RPC call to webui.systemInfo, GET /api/status-indicators; format uptime as "Xd Xh Xm"; setInterval 30s refresh; stale data indicator on failure
- [x] T015 [P] [US3] [EXTEND] Add health panel styles to `frontend/public/css/app.css` — health card layout, connector status indicators (green/connected, red/disconnected, yellow/busy)

**Checkpoint**: Health panel shows live metrics with auto-refresh

---

## Phase 6: User Story 4 - Dashboard Navigation (Priority: P2)

**Goal**: Tab navigation between chat and dashboard views within the SPA, preserving state

**Independent Test**: Click Dashboard tab → dashboard loads → click Chat tab → chat conversation preserved → current tab highlighted

### Implementation for User Story 4

- [x] T016 [US4] [EXTEND] Add tab navigation to `frontend/public/index.html` — nav bar with Chat/Dashboard tabs, wrap chat in conditional `x-show`, wrap dashboard in conditional `x-show`, shared Alpine.js state for currentPage
- [x] T017 [US4] [EXTEND] Add navigation logic to `frontend/public/js/dashboard.js` — connect/disconnect log SSE on tab switch (connect when dashboard visible, disconnect when hidden); expose `switchTo(page)` method
- [x] T018 [US4] [EXTEND] Update `frontend/public/js/chat.js` — make chat component aware of shared navigation state; preserve state when hidden (no destruction)
- [x] T019 [P] [US4] [EXTEND] Add navigation styles to `frontend/public/css/app.css` — tab bar styling, active tab indicator, transition between views

**Checkpoint**: Navigation works between chat and dashboard; both views preserve state

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, accessibility, and final integration

- [x] T020 [EXTEND] Add error handling to `frontend/public/js/dashboard.js` — handle 401 (redirect to token prompt), API failures (show error message with retry), SSE disconnection (show reconnecting indicator)
- [x] T021 [P] [EXTEND] Add accessibility attributes to `frontend/public/index.html` — ARIA landmarks (nav, main), aria-live for log entries and status updates, proper table semantics, text labels on status badges
- [x] T022 [P] [EXTEND] Add keyboard navigation to `frontend/public/js/dashboard.js` — Tab between nav items/filter buttons, Enter/Space to activate, focus management on tab switch
- [x] T023 Verify full integration — start slashbot with gateway, test all 4 user stories end-to-end, verify no regressions in chat UI

---
---

## Phase 8: Review Corrections (from review-2026-03-09)

**Source**: `reviews/review-2026-03-09.md` | **Branch**: `010-admin-dashboard`

### Quick Wins

- [x] T024 [REVIEW] ~~Remove unused `HealthStatus` import~~ — FALSE POSITIVE: `HealthStatus` is used on line 32 for `getService<() => HealthStatus>`
- [x] T025 [REVIEW] Fix duplicate `loadPlugins()` call — removed from `init()` in `frontend/public/js/dashboard.js`, rely on `onShow()` only
- [x] T026 [REVIEW] Add `_active` guard in `onShow()`/`onHide()` to prevent double execution when `x-effect` fires on mount

### Spec Compliance Fixes

- [x] T027 [REVIEW] [FR-011] Add field collapsing in `formatFields()` — shows first 3 fields inline, collapses rest as "(+N more)"
- [x] T028 [REVIEW] [FR-016] Add "Reconnecting..." text indicator next to SSE connection dot in log viewer header


## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — verification only
- **Phase 2 (Foundational)**: After Phase 1 — adds backend endpoint
- **Phase 3 (US1 - Plugins)**: After Phase 2 — first frontend component
- **Phase 4 (US2 - Logs)**: After Phase 3 — extends dashboard.js
- **Phase 5 (US3 - Health)**: After Phase 3 — can run parallel with Phase 4
- **Phase 6 (US4 - Navigation)**: After Phase 3 — modifies index.html layout (best after US1-US3 content exists)
- **Phase 7 (Polish)**: After all user stories

### User Story Dependencies

- **US1 (Plugins)**: After Foundational — creates base dashboard component; all other stories depend on this
- **US2 (Logs)**: After US1 — extends dashboard.js with log streaming
- **US3 (Health)**: After US1 — extends dashboard.js with health fetching; can run parallel with US2
- **US4 (Navigation)**: After US1 — modifies index.html structure; best done after US2/US3 content is in place

### Parallel Opportunities

- T003 (test) can run parallel with T002 (handler) — TDD approach
- T008, T012, T015, T019 (CSS tasks) can each run parallel with their phase's JS tasks
- Phase 4 (US2) and Phase 5 (US3) can run in parallel after Phase 3
- T021 and T022 (accessibility) can run in parallel

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# After T005 (dashboard.js created):
Task T007: "Update index.html with dashboard container"
Task T008: "Add dashboard styles to app.css"  # [P] — different file
```

## Parallel Example: Phase 4 + Phase 5

```bash
# After Phase 3 complete, these can run in parallel:
Phase 4 (US2 - Logs): T009, T010, T011, T012
Phase 5 (US3 - Health): T013, T014, T015
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Verify endpoints
2. Complete Phase 2: Add status-indicators endpoint
3. Complete Phase 3: Plugin table with status badges
4. **STOP and VALIDATE**: Dashboard shows plugins correctly
5. Proceed to US2 (logs) and US3 (health)

### Incremental Delivery

1. Phase 2 → Backend ready
2. Phase 3 (US1) → Plugin table visible (MVP!)
3. Phase 4 (US2) → Live logs working
4. Phase 5 (US3) → Health metrics visible
5. Phase 6 (US4) → Navigation between chat and dashboard
6. Phase 7 → Polish, accessibility, error handling

---

## Idea Technical Traceability

**Source Idea**: [ideas/005-web-ui/features/03-admin-dashboard.md](../../ideas/005-web-ui/features/03-admin-dashboard.md)

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| PenguinUI table for plugin list | T007 | Mapped |
| Status badges (green/red/gray) | T007, T008 | Mapped |
| SSE log stream from /api/logs | T006, T010 | Mapped |
| Auto-scroll log viewer | T011 | Mapped |
| Level filtering | T009, T010 | Mapped |
| System health (uptime, memory) | T014 | Mapped |
| Connector status display | T002, T014 | Mapped |
| Dashboard + chat navigation | T016, T017, T018 | Mapped |
| Read-only for MVP | All | Mapped (no action tasks) |

### Divergences from Idea

| Idea Specified | Task Implements | Justification |
|----------------|-----------------|---------------|
| "Status badges: green/red/gray" (3 states) | 4 badges: green/red/gray/yellow (loaded/failed/disabled/skipped) | Actual PluginDiagnostic has 4 statuses; skipped deserves distinct visual |

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 1 | T001 |
| EXTEND | 19 | T004, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023 |
| NEW | 3 | T002, T003, T005 |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| GET /api/plugins | REUSE | T001 | Existing endpoint returns PluginDiagnostic[] |
| GET /api/logs | REUSE | T001 | Existing SSE log streaming |
| webui.systemInfo RPC | REUSE | T001 | Existing system info method |
| StatusIndicatorRegistry | REUSE (via new handler) | T002 | Registry exists; need HTTP handler to expose it |
| status-indicators handler | NEW | T002 | No existing endpoint for this data |
| status-indicators test | NEW | T003 | New handler needs tests |
| dashboard.js | NEW | T005 | No existing dashboard component |
| sse-client.js | EXTEND | T006 | Add EventSource-based log stream helper |
| index.html | EXTEND | T007, T009, T013, T016 | Add dashboard sections and navigation |
| app.css | EXTEND | T008, T012, T015, T019 | Add dashboard-specific styles |
| webui/index.ts | EXTEND | T004 | Register new route |
| chat.js | EXTEND | T018 | Navigation awareness |

**Reuse ratio**: 87% REUSE+EXTEND, 13% NEW — excellent code reuse.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently testable
- Commit after each phase
- Stop at any checkpoint to validate
