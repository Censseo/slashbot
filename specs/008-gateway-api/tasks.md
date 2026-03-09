# Tasks: Gateway API Extensions

**Input**: Design documents from `/specs/008-gateway-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Included per constitution TDD requirement.

**Organization**: Tasks grouped by user story (P1 → P2 → P3) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 for user story phases
- **Reuse markers**: [REUSE], [EXTEND], [NEW] per research.md decisions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Plugin skeleton, shared types, and SSE utilities

- [X] T001 [NEW] Create plugin type definitions in src/plugins/webui/types.ts (ChatRequest, StreamEvent, SystemInfo interfaces + Zod schemas)
- [X] T002 [P] [NEW] Create SSE helper utilities in src/plugins/webui/sse.ts (writeEvent, SSE headers, keepalive)
- [X] T003 [P] [NEW] Create webui plugin skeleton in src/plugins/webui/index.ts (createWebuiPlugin factory, empty setup)

**Checkpoint**: Foundation files exist, types compile, SSE helpers are unit-testable

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Gateway extension for static file fallback — BLOCKS User Story 4

**⚠️ CRITICAL**: Static file serving (US4) requires this gateway change. Other stories (US1–US3, US5) can proceed without it.

- [X] T004 [EXTEND] Extend gateway handleHttp() in src/core/gateway/server.ts to support static file fallback after route matching (auth-exempt for non-API paths)

**Checkpoint**: Gateway supports fallback to static file handler for unmatched non-API paths

---

## Phase 3: User Story 1 — Streaming Chat via HTTP (Priority: P1) 🎯 MVP

**Goal**: Web client sends a message, receives SSE stream with text deltas and tool call events

**Independent Test**: POST /api/chat with message payload → verify SSE stream with text-delta, tool-call-start, tool-call-result, done events

### Tests for User Story 1

- [X] T005 [P] [US1] Write tests for chat handler in tests/plugins/webui/chat.test.ts (request validation, SSE event format, session creation/reuse, disconnect cleanup, auth rejection)

### Implementation for User Story 1

- [X] T006 [US1] [NEW] Implement chat streaming handler in src/plugins/webui/handlers/chat.ts (Zod validation, session create/reuse via SessionManager, invoke runAgentLoop with AgentLoopCallbacks → SSE events, AbortController for client disconnect cleanup [FR-008], CORS headers [FR-009])
- [X] T007 [US1] [REUSE] Register POST /api/chat route in src/plugins/webui/index.ts via registerHttpRoute()

**Checkpoint**: Chat streaming works end-to-end — text deltas, tool calls, done event, error handling, session management

---

## Phase 4: User Story 2 — Plugin Status Query (Priority: P2)

**Goal**: Web client queries loaded plugins with name, status, and error info

**Independent Test**: GET /api/plugins → verify JSON array with pluginId, status, reason fields

### Tests for User Story 2

- [X] T008 [P] [US2] Write tests for plugins handler in tests/plugins/webui/plugins.test.ts (response format, error status display, auth rejection)

### Implementation for User Story 2

- [X] T009 [US2] [NEW] Implement plugins status handler in src/plugins/webui/handlers/plugins.ts (query PluginDiagnostic from kernel, map to PluginStatusEntry[], return JSON)
- [X] T010 [US2] [REUSE] Register GET /api/plugins route in src/plugins/webui/index.ts via registerHttpRoute()

**Checkpoint**: Plugin status endpoint returns accurate data for all loaded plugins

---

## Phase 5: User Story 3 — Live Log Streaming (Priority: P2)

**Goal**: Web client connects to SSE endpoint and receives real-time log entries

**Independent Test**: GET /api/logs → verify SSE stream emits log entries matching KernelLogger output

### Tests for User Story 3

- [X] T011 [P] [US3] Write tests for logs handler in tests/plugins/webui/logs.test.ts (SSE format, log delivery order, disconnect cleanup, auth rejection)

### Implementation for User Story 3

- [X] T012 [US3] [NEW] Implement log streaming handler in src/plugins/webui/handlers/logs.ts (SSE headers, KernelLogger.subscribe() → write events, cleanup on disconnect)
- [X] T013 [US3] [REUSE] Register GET /api/logs route in src/plugins/webui/index.ts via registerHttpRoute()

**Checkpoint**: Log streaming delivers real-time entries with proper cleanup on disconnect

---

## Phase 6: User Story 4 — Static Frontend Asset Serving (Priority: P3)

**Goal**: Gateway serves frontend static files with SPA fallback, no auth required

**Independent Test**: GET /index.html → verify file served with correct MIME type; GET /nonexistent-route → verify SPA fallback to index.html

### Tests for User Story 4

- [X] T014 [P] [US4] Write tests for static file handler in tests/plugins/webui/static.test.ts (file serving, MIME types, SPA fallback, path traversal prevention, missing directory handling)

### Implementation for User Story 4

- [X] T015 [US4] [NEW] Implement static file service in src/plugins/webui/handlers/static.ts (resolve paths within assets dir, MIME type detection, SPA fallback to index.html, path traversal guard)
- [X] T016 [US4] Wire static file service into gateway fallback in src/plugins/webui/index.ts (register service via registerService() for gateway to call)

**Checkpoint**: Static files served correctly, SPA fallback works, path traversal blocked

---

## Phase 7: User Story 5 — Admin RPC Methods (Priority: P3)

**Goal**: Web client queries system info (uptime, version, plugin count, connector count) via RPC

**Independent Test**: POST /rpc with method webui.systemInfo → verify JSON response with expected fields

### Implementation for User Story 5

- [X] T017 [US5] [NEW] Implement systemInfo RPC method handler in src/plugins/webui/index.ts (gather uptime, version, plugin count, connector count, command count, tool count)
- [X] T018 [US5] [REUSE] Register webui.systemInfo via registerGatewayMethod() in src/plugins/webui/index.ts

**Checkpoint**: RPC method returns accurate system information

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: CORS, SSE utility tests, final wiring, validation

- [X] T019 [P] [NEW] Add CORS headers to API responses in src/plugins/webui/index.ts (same-origin default, configurable)
- [X] T020 [P] Write SSE helper unit tests in tests/plugins/webui/sse.test.ts
- [X] T021 [REUSE] Register webui plugin in src/plugins/index.ts plugin loader array so it loads on startup
- [X] T022 Run quickstart.md validation (manual: curl chat, plugins, logs, RPC endpoints)

---

## Phase 9: Review Corrections (from review 2026-03-09, branch 008-gateway-api)

**Purpose**: Address code review findings — bugs, spec drift, missing tests, dead code

### Spec Deviations
- [X] T023 [DRIFT] FR-009: Removed dead CORS_HEADERS/setCorsHeaders from sse.ts (never wired, will redesign when needed)
- [X] T024 [DRIFT] FR-011: Documented session Map as intentional divergence from SessionManager in chat.ts

### Code Quality
- [X] T025 [HIGH] Fixed route matching bug in src/core/gateway/server.ts — strip query string before route comparison
- [X] T026 [HIGH] Added session eviction to chat.ts — caps Map at 500 entries
- [X] T027 [HIGH] Added null-check guards on getService() calls in chat.ts with descriptive errors
- [X] T028 [MEDIUM] Replaced sync fs calls with async stat in src/plugins/webui/handlers/static.ts
- [X] T029 [LOW] Added 64KB request body size limit to chat handler

### Missing Tests
- [X] T030 [HIGH] Add handler-level integration tests for chat handler (SSE streaming, session reuse, disconnect/abort, error events) with mocked LLM adapter
- [X] T031 [MEDIUM] Add handler-level tests for plugins, logs, and static handlers with mocked services

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks only US4 (static files)
- **Phase 3 (US1 Chat)**: Depends on Phase 1 only
- **Phase 4 (US2 Plugins)**: Depends on Phase 1 only
- **Phase 5 (US3 Logs)**: Depends on Phase 1 only
- **Phase 6 (US4 Static)**: Depends on Phase 1 + Phase 2 (gateway extension)
- **Phase 7 (US5 RPC)**: Depends on Phase 1 only
- **Phase 8 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1 Chat)**: Independent after Phase 1
- **US2 (P2 Plugins)**: Independent after Phase 1
- **US3 (P2 Logs)**: Independent after Phase 1
- **US4 (P3 Static)**: Requires Phase 2 gateway extension
- **US5 (P3 RPC)**: Independent after Phase 1

### Parallel Opportunities

After Phase 1 completes:
- US1, US2, US3, US5 can all proceed in parallel (different handler files)
- US4 must wait for Phase 2 but can then run in parallel with others
- Within each story: tests [P] can be written before implementation

---

## Parallel Example: After Phase 1

```bash
# All these can run simultaneously (different files, no dependencies):
Task T005: "Write chat handler tests in tests/plugins/webui/chat.test.ts"
Task T008: "Write plugins handler tests in tests/plugins/webui/plugins.test.ts"
Task T011: "Write logs handler tests in tests/plugins/webui/logs.test.ts"
Task T014: "Write static handler tests in tests/plugins/webui/static.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 3: US1 Chat Streaming (T005–T007)
3. **STOP and VALIDATE**: Test chat endpoint independently
4. Deploy if ready — chat is functional

### Incremental Delivery

1. Phase 1 → Foundation ready
2. Phase 3 (US1 Chat) → MVP! Core value delivered
3. Phase 4 + 5 (US2 + US3) → Admin monitoring added
4. Phase 2 + 6 (US4 Static) → Self-contained frontend serving
5. Phase 7 (US5 RPC) → Rich admin queries
6. Phase 8 (Polish) → Production-ready

---

## Idea Technical Traceability

**Source Idea**: [ideas/005-web-ui/features/01-gateway-api.md](../../ideas/005-web-ui/features/01-gateway-api.md)

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| Implement as slashbot plugin via HttpRouteRegistry | T003, T007, T010, T013 | Mapped |
| POST /api/chat — SSE streaming chat | T005, T006, T007 | Mapped |
| GET /api/plugins — plugin status | T008, T009, T010 | Mapped |
| GET /api/logs — SSE log streaming | T011, T012, T013 | Mapped |
| Register gateway RPC methods (admin queries) | T017, T018 | Mapped |
| Static file serving middleware | T014, T015, T016 | Mapped |
| Structured streaming (text-delta, tool-call-start, tool-call-result, done) | T001 (types), T006 (implementation) | Mapped |
| Reuse existing bearer token auth | T006, T009, T012 (handler-level), T004 (gateway-level exemption) | Mapped |
| Leverage Vercel AI SDK toDataStream() | T006 | Divergent (see below) |

### Divergences from Idea

| Idea Specified | Task Implements | Justification |
|----------------|-----------------|---------------|
| Vercel AI SDK `toDataStream()` for SSE | AgentLoopCallbacks → custom SSE events (T006) | Callbacks give direct access to tool call lifecycle events without coupling frontend to Vercel's data stream protocol. Documented in plan.md §Source Idea Alignment. |

---

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 6 | T007, T010, T013, T016, T018, T021 |
| EXTEND | 1 | T004 |
| NEW | 9 | T001, T002, T003, T005, T006, T008, T009, T011, T012, T014, T015, T017, T019, T020 |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| HttpRouteRegistry | REUSE | T007, T010, T013 | Register routes via existing API |
| GatewayMethodRegistry | REUSE | T018 | Register RPC method via existing API |
| AgentLoopCallbacks | REUSE | T006 | Map existing callbacks to SSE events |
| KernelLogger.subscribe() | REUSE | T012 | Tap existing log subscription |
| PluginDiagnostic | REUSE | T009 | Use existing diagnostic data |
| SessionManager | REUSE | T006 | Create/reuse sessions via existing API |
| Gateway handleHttp() | EXTEND | T004 | Add static file fallback path |
| Chat handler | NEW | T006 | No existing SSE chat handler |
| Static file service | NEW | T015 | No existing static file serving |
| SSE utilities | NEW | T002 | No existing SSE helpers |
| Plugin types | NEW | T001 | Feature-specific types |

**Reuse ratio**: 7 reuse/extend vs 9+ new — acceptable given this is a new plugin with new endpoints. All NEW items are justified: no existing SSE, chat streaming, or static file components exist in the codebase.
