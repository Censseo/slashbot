# Tasks: Node-RED UI Access

**Input**: Design documents from `/specs/006-nodered-ui-access/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec.md and plan.md specify TDD approach (Red-Green-Refactor).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: No new project initialization needed — this feature extends the existing nodered plugin. This phase covers type and config groundwork.

- [X] T001 [EXTEND] Add `editorUsername` and `editorPasswordHash` optional fields to `NodeRedConfig` in `src/plugins/nodered/types.ts`
- [X] T002 [EXTEND] Add `FlowChangeEvent`, `FlowChange`, and `EditorState` types to `src/plugins/nodered/types.ts`
- [X] T003 [EXTEND] Add `flow:external-change` to `NodeRedEvent` union type in `src/plugins/nodered/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [EXTEND] Extend `generateSettings()` in `src/plugins/nodered/services/settings.ts` to conditionally emit `adminAuth` block and `httpAdminRoot: '/'` when both `editorUsername` and `editorPasswordHash` are set; emit `httpAdminRoot: false` otherwise
- [X] T005 Write test for `generateSettings()` adminAuth logic in `src/plugins/nodered/services/settings.test.ts` — test both configured and unconfigured credential states
- [X] T006 [EXTEND] Add `editor.username` and `editor.password` config subkeys to `/nodered config` command handler in `src/plugins/nodered/index.ts` — password hashed via `Bun.password.hash(pass, "bcrypt")` before storage
- [X] T007 Write test for `/nodered config editor.username` and `/nodered config editor.password` handlers in `src/plugins/nodered/index.test.ts`
- [X] T008 [EXTEND] Add `getEditorUrl()` helper method to `NodeRedManager` in `src/plugins/nodered/services/NodeRedManager.ts` — returns URL string or null based on EditorState
- [X] T009 [EXTEND] Add `getFlowsRevisionHash()` method to `FlowManager` in `src/plugins/nodered/services/FlowManager.ts` — SHA-256 hash of sorted flow IDs + node counts; add `updateLastKnownHash()` called after FlowManager CRUD operations

**Checkpoint**: Foundation ready — types, settings generation, credential config, and hash infrastructure in place

---

## Phase 3: User Story 1 — Access the Node-RED Editor (Priority: P1) 🎯 MVP

**Goal**: Administrator can run `/nodered ui`, get the editor URL, open it in a browser, and authenticate with configured credentials.

**Independent Test**: Run `/nodered ui` with credentials configured and Node-RED running → URL displayed. Open URL → editor loads with login prompt. Enter credentials → editor accessible.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US1] Write test for `/nodered ui` command in `src/plugins/nodered/index.test.ts` — three states: credentials not configured, Node-RED not running, success (running + configured)

### Implementation for User Story 1

- [X] T011 [US1] [NEW] Implement `/nodered ui` subcommand in `src/plugins/nodered/index.ts` — uses `getEditorUrl()` and EditorState logic; displays URL, "not running" message, or credential setup instructions per contract
- [X] T012 [US1] [REUSE] Enrich context provider in `src/plugins/nodered/index.ts` to include editor URL when EditorState is `available` (FR-012) — exclude `editorPasswordHash` and `editorUsername` from LLM context; add test in `index.test.ts` verifying URL included when available and sensitive fields excluded

**Checkpoint**: User Story 1 fully functional — `/nodered ui` works, editor accessible with auth, URL in TUI context

---

## Phase 4: User Story 2 — Modify a Bot-Created Flow in the Editor (Priority: P2)

**Goal**: Administrator modifies a bot-created flow in the editor, deploys it, and the system detects the change within 30s and updates the MCP tool.

**Independent Test**: Create a flow via bot, modify it in the editor, deploy — verify `flow:external-change` event emitted within 30s and McpBridge re-scans.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US2] Write unit tests for `FlowChangePoller` in `src/plugins/nodered/services/FlowChangePoller.test.ts` — test: poll detects hash change → emits event; poll with same hash → no event; bot CRUD updates hash → poller skips; poller start/stop lifecycle; API failure → graceful retry [Plan](task-plans/T013-flowchangepoller-unit-tests.md)

### Implementation for User Story 2

- [X] T014 [US2] [NEW] Implement `FlowChangePoller` service in `src/plugins/nodered/services/FlowChangePoller.ts` — injectable service with `start()`, `stop()`, `getLastHash()`, `updateHash()`; polls every 15s via `FlowManager.getFlowsRevisionHash()`; compares with last known hash; emits `flow:external-change` on diff; computes `FlowChange[]` (created/modified/deleted) by comparing flow lists [Plan](task-plans/T014-flowchangepoller-service.md)
- [X] T015 [US2] [EXTEND] Wire `FlowChangePoller` into `NodeRedManager` lifecycle in `src/plugins/nodered/services/NodeRedManager.ts` — start poller when Node-RED starts (if credentials configured), stop on shutdown [Plan](task-plans/T015-wire-poller-lifecycle.md)
- [X] T016 [US2] [EXTEND] Subscribe `McpBridgeService` to `flow:external-change` events in `src/plugins/nodered/services/McpBridgeService.ts` — trigger tool re-scan on event; unregister tools for deleted flows, update for modified flows [Plan](task-plans/T016-mcpbridge-external-change.md)

**Checkpoint**: User Story 2 functional — editor changes detected within 30s, MCP tools updated automatically

---

## Phase 5: User Story 3 — Create a Complex Flow in the Editor (Priority: P3)

**Goal**: Administrator creates a new flow in the editor following `mcp-` naming convention; it is automatically exposed as a bot tool.

**Independent Test**: Create flow named `mcp-complex-pipeline` in editor, deploy → verify it appears as MCP tool. Create flow without `mcp-` prefix → verify it does NOT appear as tool.

### Implementation for User Story 3

- [X] T017 [US3] [REUSE] Verify that `FlowChangePoller` + `McpBridgeService` already handle new flow creation detection — the `flow:external-change` event with `changeType: 'created'` should trigger McpBridge to check naming conventions and register new tools. Add integration-level test in `src/plugins/nodered/services/FlowChangePoller.test.ts` confirming new `mcp-` prefixed flows are registered and non-prefixed flows are ignored.

**Checkpoint**: All user stories functional — new editor-created flows with `mcp-` prefix auto-exposed as tools

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, security hardening, cleanup

- [X] T018 [P] Handle edge case: partial credential configuration (username set but no password, or vice versa) — `generateSettings()` should treat as unconfigured; `/nodered ui` should display specific missing field in message
- [X] T019 [P] Handle edge case: malformed `editorPasswordHash` in config — `generateSettings()` validates bcrypt hash format (`$2b$` or `$2a$`); disables editor with warning log if invalid
- [X] T020 [P] Handle edge case: administrator deletes a bot-relied flow in editor — verify `McpBridgeService` unregisters tool and emits user notification per error scenarios table
- [X] T021 Run `quickstart.md` validation — execute setup steps manually and verify all commands work as documented

---

## Phase 7: Review Corrections (006-nodered-ui-access, 2026-03-05)

**Source**: Post-implementation code review on branch `006-nodered-ui-access`

### Test Fixes

- [X] T022 [CRITICAL] Fix 13 failing tests in `src/plugins/nodered/services/FlowChangePoller.test.ts` — `vi.advanceTimersByTimeAsync()` is not available in Bun+Vitest; replace with a compatible timer advancement pattern (e.g., `vi.advanceTimersByTime(N)` + `await vi.runAllTimersAsync()` or flush microtasks manually)

### Security Hardening

- [X] T023 [HIGH] Add alphanumeric input validation for `editor.username` in `/nodered config` handler (`src/plugins/nodered/index.ts:396-403`) — spec requires non-empty alphanumeric; reject values not matching `/^[a-zA-Z0-9_-]+$/`; add test in `index.test.ts`
- [X] T024 [MEDIUM] Strip newlines and control characters in `generateSettings()` username escaping (`src/plugins/nodered/services/settings.ts:47`) — current escaping handles `\` and `'` but not `\n`, `\r`, or other non-printable characters that could break generated JS

### Code Quality

- [X] T025 [MEDIUM] Replace `any` type on `FlowManager.nodeRedManager` (`src/plugins/nodered/services/FlowManager.ts:110`) with a minimal typed interface (e.g., `{ getState(): NodeRedState; getConfig(): NodeRedConfig }`)

### Impact on Pending Tasks

No pending tasks are affected — all previous tasks (T001–T021) are completed. Review corrections are standalone fixes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (types must exist)
- **Phase 3 (US1)**: Depends on Phase 2 (settings generation, config commands, editor URL helper)
- **Phase 4 (US2)**: Depends on Phase 2 (FlowManager hash method); can run in parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 4 (FlowChangePoller + McpBridge integration)
- **Phase 6 (Polish)**: Depends on Phases 3–5

### Within Each Phase

- Tests MUST be written and FAIL before implementation (TDD)
- Types/models before services
- Services before command handlers
- Core implementation before integration

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 all modify `types.ts` — execute sequentially (same file)
- **Phase 2**: T004+T005 (settings) and T006+T007 (config commands) and T008 (manager) and T009 (FlowManager) can run in parallel (different files)
- **Phase 3 + Phase 4**: US1 and US2 can run in parallel after Phase 2 (different files, independent concerns)
- **Phase 6**: T018, T019, T020 can run in parallel (different concerns)

---

## Parallel Example: Phase 2 (Foundational)

```
# Stream A: Settings generation
T004: Extend generateSettings() in settings.ts
T005: Test generateSettings() in settings.test.ts

# Stream B: Config commands (parallel with Stream A)
T006: Add editor.username/password to /nodered config in index.ts
T007: Test config commands in index.test.ts

# Stream C: Helpers (parallel with A & B)
T008: Add getEditorUrl() to NodeRedManager.ts
T009: Add getFlowsRevisionHash() to FlowManager.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Types
2. Complete Phase 2: Foundational (settings, config, helpers)
3. Complete Phase 3: User Story 1 (`/nodered ui` + editor auth)
4. **STOP and VALIDATE**: Test editor access end-to-end
5. Deploy if ready

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Editor accessible → MVP
3. Phase 4 (US2) → Flow change detection → Supervision enabled
4. Phase 5 (US3) → New flow creation → Full feature
5. Phase 6 → Polish → Production ready

---

## Idea Technical Traceability

**Source Idea**: `ideas/002-nodered-plugin/features/05-nodered-ui-access.md`

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| Enable editor via `httpAdminRoot: '/'` in settings.js | T004 | Mapped |
| Configure `adminAuth` with bcrypt-hashed credentials | T004, T006 | Mapped |
| `/nodered ui` command to display editor URL | T010, T011 | Mapped |
| Polling `GET /flows` for change detection (MVP) | T013, T014 | Mapped |
| Bind address `127.0.0.1` default | Existing `localhostOnly: true` — no task needed | Mapped (existing) |
| Add editor URL to TUI sidebar | T012 | Mapped |
| No custom UI — native Node-RED editor | N/A (no task needed — nothing to build) | Mapped |
| No remote access (HTTPS, tunnel) | N/A (intentionally excluded) | Mapped |
| No multi-user | Single admin in adminAuth (T004) | Mapped |
| Execution order: httpAdminRoot first, then adminAuth | T004 handles both in single `generateSettings()` call | Order preserved |

### Divergences from Idea

| Idea Specified | Task Implements | Justification |
|----------------|-----------------|---------------|
| "Add editor URL to TUI sidebar" | Context provider enrichment (T012) | research.md Decision 3: sidebar hook has no rendering support; context provider is the established pattern |

---

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 3 | T012 (context provider), T017 (FlowChangePoller+McpBridge for US3), status indicator (no task — unchanged) |
| EXTEND | 6 | T001–T003 (types), T004 (settings), T006 (config), T008 (NodeRedManager), T009 (FlowManager), T015 (lifecycle), T016 (McpBridge) |
| NEW | 2 | T011 (/nodered ui command), T014 (FlowChangePoller service) |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| NodeRedConfig type | EXTEND | T001 | Add credential fields to existing type |
| generateSettings() | EXTEND | T004 | Add conditional adminAuth block |
| /nodered config | EXTEND | T006 | Add editor.username/password subkeys |
| FlowManager | EXTEND | T009 | Add revision hash method |
| NodeRedManager | EXTEND | T008, T015 | Add editor URL helper, wire poller lifecycle |
| McpBridgeService | EXTEND | T016 | Subscribe to external change events |
| Status indicator | REUSE | — | No changes needed |
| Event system | REUSE | T003 | Extend existing union type |
| Context provider | REUSE | T012 | Use existing pattern for editor URL |
| FlowChangePoller | NEW | T014 | No existing polling service; justified in research.md Decision 2 |
| /nodered ui command | NEW | T011 | New command — no existing equivalent |

**Reuse health**: 3 REUSE + 6 EXTEND + 2 NEW = 82% reuse ratio. NEW tasks are justified and minimal.
