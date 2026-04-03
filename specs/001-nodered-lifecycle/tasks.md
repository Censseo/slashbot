# Tasks: Node-RED Lifecycle Management

**Input**: Design documents from `/specs/001-nodered-lifecycle/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD approach — tests are written FIRST and must FAIL before implementation (per constitution TDD principle and plan.md Phase 2 task planning approach).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- **Reuse markers**: [REUSE], [EXTEND], [REFACTOR], [NEW] per research.md decisions
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root (existing slashbot monolith)
- Tests co-located with source (`*.test.ts` alongside source files)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create plugin directory structure and extend DI registry

- [X] T001 Create `src/plugins/nodered/` directory with `services/` subdirectory
- [X] T002 [P] [EXTEND] Add `NodeRedManager: Symbol.for('NodeRedManager')` to `src/core/di/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Standalone building blocks that all user stories depend on — types, ring buffer, settings generator

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] [NEW] Define type definitions (NodeRedState, NodeRedConfig, NodeRedStatus, NodeRedRuntimeState) in `src/plugins/nodered/types.ts`
- [X] T004 [P] [NEW] Write unit tests for RingBuffer (capacity, wrapping, tail, clear, size) in `src/plugins/nodered/services/RingBuffer.test.ts`
- [X] T005 [NEW] Implement RingBuffer class (fixed-size circular buffer, 200-line default capacity) in `src/plugins/nodered/services/RingBuffer.ts` (depends on T004 — tests must fail first)
- [X] T006 [P] [NEW] Write unit tests for settings.js generator (config-to-JS mapping, all required fields: uiPort, userDir, flowFile, httpAdminRoot, httpNodeRoot, functionGlobalContext, logging, editorTheme) in `src/plugins/nodered/services/settings.test.ts`
- [X] T007 [NEW] Implement settings.js generator function in `src/plugins/nodered/services/settings.ts` (depends on T003, T006 — tests must fail first)

**Checkpoint**: Foundation ready — RingBuffer and settings generator tested and working, types defined, DI token registered

---

## Phase 3: User Story 1 - Automatic Node-RED Startup (Priority: P1) MVP

**Goal**: When slashbot starts, Node-RED automatically launches as a managed child process, becomes reachable, and shows status in sidebar

**Independent Test**: Start slashbot and verify Node-RED becomes reachable on configured port; sidebar displays "NR: Running"

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [US1] Write unit tests for NodeRedManager core in `src/plugins/nodered/services/NodeRedManager.test.ts`: state machine transitions (disabled→stopped→starting→running, disabled→unavailable), init() with config loading and defaults, start() with spawn and readiness polling, health check timer setup, stale process adoption (FR-018 port probe), Node.js availability check (FR-013), log capture to RingBuffer and file, getState(), getStatus() [Plan](task-plans/T008-write-unit-tests-for-noderedmanager-core.md)

### Implementation for User Story 1

- [X] T009 [US1] [NEW] Implement NodeRedManager service in `src/plugins/nodered/services/NodeRedManager.ts`: 6-state machine with valid/invalid transitions, init() (load config with defaults, check Node.js via `which node`, determine initial state, probe port for stale process adoption), start() (generate settings.js, spawn `node red.js -s settings.js` via Bun.spawn, readiness poll every 500ms, start health check timer at configured interval), stdout/stderr capture to RingBuffer + log file (`~/.slashbot/logs/nodered.log`), getState(), getStatus(), emit lifecycle events via EventBus, emit `prompt:redraw` on state changes (depends on T003, T005, T007, T008) [Plan](task-plans/T009-implement-noderedmanager-service.md)
- [X] T010 [P] [US1] [NEW] Create NODERED_PROMPT constant in `src/plugins/nodered/prompt.ts` (LLM context: Node-RED managed process, available commands, do not use bash for lifecycle) [Plan](task-plans/T010-create-nodered-prompt-constant.md)
- [X] T011 [US1] [NEW] Implement NodeRedPlugin class in `src/plugins/nodered/index.ts`: metadata (id: 'feature.nodered', category: 'feature', dependencies: []), init() creates NodeRedManager + binds to DI + calls manager.init() + auto-starts if enabled, destroy() delegates to manager, sidebar contribution with dynamic label via Object.defineProperty getter (NR: Running/Stopped/Starting/Failed/Disabled/Unavailable), getStatus() returns true only when running, prompt contribution (priority 160), empty action/tool contributions (depends on T009, T010) [Plan](task-plans/T011-implement-noderedplugin-class.md)
- [X] T012 [US1] [EXTEND] Register NodeRedPlugin in `src/plugins/loader.ts`: add import and instantiation in loadBuiltinPlugins() (depends on T011) [Plan](task-plans/T012-register-noderedplugin-in-loader.md)

**Checkpoint**: Node-RED starts automatically with slashbot, health probes detect readiness, sidebar shows dynamic state label, stale processes are adopted

---

## Phase 4: User Story 2 - Automatic Crash Recovery (Priority: P1)

**Goal**: When Node-RED crashes unexpectedly, the system detects the failure and auto-restarts with exponential backoff (up to 3 retries)

**Independent Test**: Kill the Node-RED process and observe auto-restart; after 3 failed restarts, verify transition to Failed state

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [US2] Write unit tests for crash recovery in `src/plugins/nodered/services/NodeRedManager.test.ts`: crash detection via process exit handler, auto-restart triggered on unexpected exit (not intentional stop), exponential backoff delays between retries, restart counter incrementing, successful restart resets counter and emits `nodered:ready`, all retries exhausted transitions to failed state and emits `nodered:failed`, intentionalStop flag suppresses auto-restart, health monitoring pauses in stopped state

### Implementation for User Story 2

- [X] T014 [US2] Implement crash detection and auto-restart in `src/plugins/nodered/services/NodeRedManager.ts`: monitor `process.exited` promise for unexpected exits, on crash emit `nodered:error` + increment restart count, if restartCount < maxRestartAttempts then restart with exponential backoff (1s, 2s, 4s), if restartCount >= maxRestartAttempts then transition to failed + emit `nodered:failed`, skip auto-restart when intentionalStop is true, reset restartCount on successful start (depends on T009, T013)

**Checkpoint**: Crash recovery works end-to-end: kill process → detect → auto-restart → success OR exhaust retries → failed state

---

## Phase 5: User Story 3 - Manual Lifecycle Commands (Priority: P2)

**Goal**: Administrator can start, stop, restart, and check status of Node-RED using `/nodered` slash commands

**Independent Test**: Run each slash command and verify expected state change and response message

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [US3] Write unit tests for command handler in `src/plugins/nodered/commands.test.ts`: parse subcommands (start, stop, restart, status), delegate to NodeRedManager methods, format status output (state, PID, port, uptime, restart count, recent logs), idempotent behavior (start when running returns info, stop when stopped returns info), unknown subcommand shows usage, alias `/nr` support

### Implementation for User Story 3

- [X] T016 [US3] [NEW] Implement `/nodered` command handler in `src/plugins/nodered/commands.ts`: register command with name 'nodered' and alias 'nr', parse subcommands from args, `/nodered start` calls manager.start(), `/nodered stop` calls manager.stop(), `/nodered restart` calls manager.restart(), `/nodered status` calls manager.getStatus(20) and formats output table (state, PID, port, uptime, restarts, recent log lines), resolve NodeRedManager from DI container via TYPES.NodeRedManager (depends on T009, T015)

**Checkpoint**: All lifecycle commands work: start, stop, restart, status with correct output formatting and idempotent behavior

---

## Phase 6: User Story 4 - Graceful Shutdown with Slashbot (Priority: P2)

**Goal**: When slashbot shuts down, Node-RED is gracefully stopped (SIGTERM → timeout → SIGKILL) before slashbot exits

**Independent Test**: Shut down slashbot and verify Node-RED process terminates cleanly within timeout

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T017 [US4] Write unit tests for graceful shutdown in `src/plugins/nodered/services/NodeRedManager.test.ts`: stop() sends SIGTERM to child process, stop() waits up to shutdownTimeout (default 10s) for clean exit, stop() sends SIGKILL if process doesn't exit within timeout, destroy() stops Node-RED + clears all timers (health check, readiness poll), destroy() handles already-stopped and failed states gracefully, plugin destroy() delegates to manager.destroy()

### Implementation for User Story 4

- [X] T018 [US4] Implement graceful shutdown in `src/plugins/nodered/services/NodeRedManager.ts`: stop() sends SIGTERM via process.kill(), wait for `process.exited` with configurable timeout (shutdownTimeout), if timeout expires send SIGKILL and log forced termination, set intentionalStop=true to suppress auto-restart, clear health check timer and readiness poll timer, transition to stopped state, emit `nodered:stopped`, destroy() calls stop() if running + clears all timers + nullifies process references (depends on T009, T017)

**Checkpoint**: Graceful shutdown works: slashbot exit → Node-RED SIGTERM → clean exit (or timeout → SIGKILL)

---

## Phase 7: User Story 5 - Node-RED Configuration (Priority: P3)

**Goal**: Administrator can configure Node-RED settings (port, userDir, intervals) via persistent config file with sensible defaults

**Independent Test**: Modify configuration file, restart Node-RED, verify new settings take effect

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T019 [US5] Write unit tests for config management in `src/plugins/nodered/services/NodeRedManager.test.ts`: loadConfig creates default config if no file exists, loadConfig merges existing config with defaults, saveConfig writes to `~/.slashbot/nodered.json`, saveConfig validates malformed JSON falls back to defaults, config file created with mode 0600, custom port applied on restart

### Implementation for User Story 5

- [X] T020 [US5] Implement config management in `src/plugins/nodered/services/NodeRedManager.ts`: loadConfig() reads `~/.slashbot/nodered.json` with JSON parse error handling (fallback to defaults + log warning), saveConfig() merges partial config and writes with mode 0600, default config values (enabled: true, port: 1880, userDir: ~/.slashbot/nodered, healthCheckInterval: 30, shutdownTimeout: 10, maxRestartAttempts: 3, localhostOnly: true), create userDir on first startup if not exists (FR-012) (depends on T003, T019)
- [X] T021 [US5] Add `/nodered config` subcommand to `src/plugins/nodered/commands.ts`: `/nodered config` displays current config as formatted table, `/nodered config <key> <value>` updates a config value (port, healthCheckInterval, shutdownTimeout, maxRestartAttempts) via manager.saveConfig(), display confirmation message noting restart may be required (depends on T016, T020)

**Checkpoint**: Configuration persists, defaults work, config command enables runtime updates

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration testing, validation, and cleanup

- [X] T022 [P] Write integration test for full lifecycle (spawn Node-RED + health probe + stop) in `src/plugins/nodered/index.test.ts` (requires Node.js + Node-RED installed)
- [X] T023 Run quickstart.md validation: verify all test commands work (`bun run test -- --testPathPattern=nodered`)
- [X] T024 [P] Verify test coverage meets 70% minimum threshold (per constitution Quality Standards)

---

## Phase 9: Review Corrections (Post-Implementation Review 2026-02-14)

**Source**: Code review on branch `001-nodered-lifecycle` (2026-02-14)
**Report**: [reviews/review-2026-02-14.md](reviews/review-2026-02-14.md)

**CRITICAL**: These corrections address spec deviations, fake implementations, and bugs discovered during review. They MUST be completed before merging to master.

### Spec Deviations

- [X] T025 [DRIFT] Fix `performHealthCheck()` no-op in `src/plugins/nodered/services/NodeRedManager.ts:334-344` — health check failures are silently swallowed. Add consecutive failure counter; after N consecutive failures (e.g., 3), trigger auto-restart flow (FR-004, FR-005). Update tests in `NodeRedManager.test.ts` to cover health check failure -> restart path.
- [X] T026 [DRIFT] Add `port` to `nodered:ready` event payload in `src/plugins/nodered/services/NodeRedManager.ts:155,288` — data-model.md specifies `{ port: number }` but implementation emits `{}`. Update both emission sites and corresponding test assertions.
- [X] T027 [DRIFT] Fix Node.js unavailable event type in `src/plugins/nodered/services/NodeRedManager.ts:133` — emits `nodered:error` but spec error table indicates `nodered:failed` for this fatal condition. Emit `nodered:failed` when Node.js is not found.

### Code Quality

- [X] T028 [BUG] Fix state machine bypass in `src/plugins/nodered/services/NodeRedManager.ts` — `handleProcessExit()` (lines 415, 433, 441) and `stop()` (line 497) directly mutate `runtimeState.state` instead of using `setState()`. Refactor to use `setState()` for all state transitions. May require adjusting VALID_TRANSITIONS to allow transitions from `starting` -> `stopped` (for stop during starting).
- [X] T029 [BUG] Remove erroneous `restartCount++` in `restart()` method (`src/plugins/nodered/services/NodeRedManager.ts:508`) — manual `/nodered restart` should NOT increment the crash recovery counter. restartCount should only increment on crash-detected auto-restarts.
- [X] T030 [SECURITY] Escape `config.userDir` in settings.js generator (`src/plugins/nodered/services/settings.ts:38`) — single quotes in userDir path would break generated JavaScript. Escape with `.replace(/'/g, "\\\\'")`. Add test case for paths with single quotes.

### Performance

- [X] T031 [P] Replace `fs.appendFileSync` with async buffered writes in `src/plugins/nodered/services/NodeRedManager.ts:400` — synchronous I/O in the log capture stream handler blocks the event loop under high log volume. Use `Bun.write` with append mode or async fs.appendFile.
- [X] T032 [P] Create single `TextDecoder` instance in `attachLogHandlers()` (`src/plugins/nodered/services/NodeRedManager.ts:370`) — currently creates a new `TextDecoder` per write chunk. Move to class field or closure variable.

### Dead Code Cleanup

- [X] T033 [P] [DEAD] Remove unused type exports from `src/plugins/nodered/types.ts` — `RingBuffer` interface (lines 124-139) is never imported (the class from `RingBuffer.ts` is used instead); `NodeRedSettingsJS` interface (lines 146-180) is never imported anywhere. Remove both.

### Type Safety

- [X] T034 [P] Remove `as any` casts on event emissions in `src/plugins/nodered/services/NodeRedManager.ts` — 7 occurrences of `as any` when calling `this.eventBus.emit()`. Define proper event types or use typed overloads to eliminate casts.

**Checkpoint**: All review corrections complete — spec deviations fixed, state machine consistent, security hardened, dead code removed

---

## Phase 10: User Feedback Changes (2026-02-15)

**Source**: User feedback — plugin must auto-install Node-RED instead of requiring manual installation

- [X] T035 [FEEDBACK] [US1] Add `ensureNodeRedInstalled()` to `NodeRedManager.ts` — auto-installs Node-RED via `npm install node-red` in userDir if `red.js` not found during `init()`. Added `stopped -> failed` transition for install failures. Updated spec.md (FR-019, Assumptions, Error Scenarios). Added 4 new tests in `NodeRedManager.test.ts`.

**Checkpoint**: Auto-install complete — Node-RED installs automatically on first startup

---

### Impact on Pending Tasks

All original tasks (T001-T024) are completed. Review tasks (T025-T034) are new corrections that don't affect completed tasks but MUST be resolved before merge.

| Review Task | Affects | Impact |
|-------------|---------|--------|
| T025 (health check) | T009 (NodeRedManager core) | Extends health check logic, adds tests |
| T026 (event payload) | T009, T013 | Updates event emissions and test assertions |
| T027 (event type) | T009 | Changes one event type in init() |
| T028 (state machine) | T009, T014, T018 | Refactors state transitions across crash/stop/exit handlers |
| T029 (restart counter) | T014 | Simple line removal in restart() |
| T030 (path escape) | T007 | Adds escaping to settings generator + test |
| T031 (async log) | T009 | Refactors log capture to async |
| T032 (TextDecoder) | T009 | Minor optimization in stream handler |
| T033 (dead code) | T003 | Removes unused exports from types.ts |
| T034 (type safety) | T009 | Removes `as any` casts |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (directory), T002 (DI token) from Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational completion — the core MVP
- **US2 (Phase 4)**: Depends on US1 (T009 NodeRedManager core)
- **US3 (Phase 5)**: Depends on US1 (T009 NodeRedManager core)
- **US4 (Phase 6)**: Depends on US1 (T009 NodeRedManager core)
- **US5 (Phase 7)**: Depends on US1 (T009 NodeRedManager core)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Depends on US1 core (NodeRedManager with start/health) — extends same file
- **US3 (P2)**: Depends on US1 core (NodeRedManager) — new file (commands.ts)
- **US4 (P2)**: Depends on US1 core (NodeRedManager with basic stop) — extends same file
- **US5 (P3)**: Depends on US1 core (NodeRedManager with config loading) — extends same file + commands.ts

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Types/models before services
- Services before plugin wiring
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel (different files)
- **Phase 2**: T003, T004, and T006 can all run in parallel (different files, no dependencies)
- **Phase 3**: T010 (prompt.ts) can run in parallel with T009 (NodeRedManager) — different files
- **Phase 4-5**: US3 (commands.ts — new file) can start in parallel with US2 (extends NodeRedManager) once US1 is complete
- **Phase 6-7**: US4 and US5 can start after US1, but both extend NodeRedManager so sequential within that file

---

## Parallel Example: Foundational Phase

```bash
# Launch all independent foundational tasks together:
Task: "Define type definitions in src/plugins/nodered/types.ts"       # T003
Task: "Write RingBuffer tests in services/RingBuffer.test.ts"         # T004
Task: "Write settings generator tests in services/settings.test.ts"   # T006
```

## Parallel Example: User Story 1

```bash
# After T009 (NodeRedManager) is complete:
Task: "Create NODERED_PROMPT in src/plugins/nodered/prompt.ts"        # T010
Task: "Implement NodeRedPlugin in src/plugins/nodered/index.ts"       # T011
# T010 and T011 are independent (different files), but T011 depends on T010 for prompt import
# So T010 should complete before T011
```

## Parallel Example: After US1 Complete

```bash
# US2 and US3 can start in parallel (different files):
Task: "Write crash recovery tests in NodeRedManager.test.ts"          # T013
Task: "Write command handler tests in commands.test.ts"               # T015
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T007)
3. Complete Phase 3: User Story 1 (T008-T012)
4. **STOP and VALIDATE**: Node-RED starts with slashbot, health probes work, sidebar shows state
5. This delivers a working Node-RED instance managed by slashbot

### Incremental Delivery

1. Setup + Foundational (T001-T007) -> Building blocks ready
2. US1: Automatic Startup (T008-T012) -> MVP! Node-RED auto-starts
3. US2: Crash Recovery (T013-T014) -> Resilient operation
4. US3: Manual Commands (T015-T016) -> Admin control
5. US4: Graceful Shutdown (T017-T018) -> Clean lifecycle
6. US5: Configuration (T019-T021) -> Customizable
7. Polish (T022-T024) -> Integration tested and validated

### Suggested MVP Scope

**User Story 1 only** (Phases 1-3, tasks T001-T012): delivers a running Node-RED instance managed by slashbot with health monitoring and sidebar status. This is the foundation all other stories build on.

---

## Idea Technical Traceability

**Source Idea**: [ideas/002-nodered-plugin/idea.md](../../ideas/002-nodered-plugin/idea.md)
**Source Feature**: [ideas/002-nodered-plugin/features/01-nodered-lifecycle.md](../../ideas/002-nodered-plugin/features/01-nodered-lifecycle.md)

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| Use `child_process.spawn` (via Bun) to launch Node-RED | T009 (Bun.spawn) | Mapped |
| Launch: `node node_modules/node-red/red.js -s settings.js` | T009 (spawn args) | Mapped |
| Port configurable (default 1880) | T003 (types), T020 (config) | Mapped |
| Config stored in `~/.slashbot/nodered.json` | T020 (config load/save) | Mapped |
| Health check via `fetch('http://localhost:{port}/')` | T009 (health probe) | Mapped |
| Health check interval configurable (default 30s) | T003 (types), T009 (timer) | Mapped |
| Set `NODE_PATH` for Node-RED modules | T009 (spawn env) | Mapped |
| Register in DI as `TYPES.NodeRedManager` | T002 (DI token), T011 (binding) | Mapped |
| Emit events: `nodered:ready`, `nodered:stopped`, `nodered:error`, `nodered:failed` | T009, T014, T018 | Mapped |
| Node-RED runs as Node.js child, not Bun | T009 (spawn `node` binary) | Mapped |
| `settings.js` configures httpAdminRoot, httpNodeRoot, userDir, flowFile, functionGlobalContext | T007 (settings generator) | Mapped |
| Node-RED installed in `~/.slashbot/nodered/node_modules/node-red` | T009 (spawn cwd/paths) | Mapped |
| Follow BashPlugin (ProcessManager) pattern | T009 (SIGTERM->SIGKILL reused), T018 (escalation) | Mapped |
| Follow HeartbeatService pattern for health checks | T009 (timer-based polling) | Mapped |
| Follow ConfigManager pattern for config | T020 (plugin-specific config file) | Mapped |
| Startup sequence: init -> spawn -> wait for ready | T009 (init), T009 (start), T009 (readiness poll) | Order preserved |
| Shutdown sequence: graceful stop Node-RED | T018 (SIGTERM->timeout->SIGKILL) | Mapped |
| Commands: `/nodered start\|stop\|restart\|status` | T016 (command handler) | Mapped |
| Sidebar TUI indicator | T011 (dynamic sidebar label) | Mapped |
| `which node` to check Node.js availability | T009 (init Node.js check) | Mapped |

### Divergences from Idea

| Idea Specified | Task Implements | Justification |
|----------------|-----------------|---------------|
| Config at `~/.slashbot/config/nodered.json` | Config at `~/.slashbot/nodered.json` | Follows HeartbeatService plugin convention where feature plugins store config directly in HOME_SLASHBOT_DIR, not in `config/` subdirectory. Documented in plan.md. |

---

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 6 | T009 (EventBus, ConfigManager pattern, display), T011 (SidebarContribution API, Plugin scaffold), T016 (CommandRegistry) |
| EXTEND | 2 | T002 (TYPES registry), T012 (loader.ts) |
| NEW | 7 | T003 (types), T005 (RingBuffer), T007 (settings.ts), T009 (NodeRedManager), T010 (prompt), T011 (plugin index), T016 (commands) |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| EventBus | REUSE | T009 | Emit `nodered:*` events + `prompt:redraw` via existing typed/untyped API |
| ConfigManager pattern | REUSE | T009, T020 | Plugin-specific config file at `~/.slashbot/nodered.json` following HeartbeatService |
| SidebarContribution API | REUSE | T011 | Dynamic label via Object.defineProperty getter, boolean getStatus() |
| Plugin scaffold | REUSE | T011 | Standard Plugin interface (init, destroy, contributions) |
| CommandRegistry | REUSE | T016 | Register `/nodered` with subcommands, following HeartbeatPlugin command pattern |
| display service | REUSE | T016 | Tool indicators and status output for command responses |
| TYPES registry | EXTEND | T002 | Add 1 symbol: `TYPES.NodeRedManager` |
| loader.ts | EXTEND | T012 | Add 1 import + 1 instantiation for NodeRedPlugin |
| NodeRedManager | NEW | T009 | ProcessManager uses detached processes; Node-RED needs managed child with exit monitoring (justified in research.md Decision 1) |
| RingBuffer | NEW | T005 | Fixed-size circular buffer for in-memory log capture; no existing utility (research.md Decision 5) |
| settings.ts | NEW | T007 | settings.js generation from config; no existing pattern (research.md Decision 4) |
| NodeRedPlugin index | NEW | T011 | New plugin following established scaffold pattern |
| types.ts | NEW | T003 | Feature-specific types (NodeRedState, NodeRedConfig, etc.) |
| commands.ts | NEW | T016 | Feature-specific command handler |
| prompt.ts | NEW | T010 | Feature-specific LLM prompt contribution |

**Reuse Health**: 6 REUSE + 2 EXTEND vs 7 NEW = 53% reuse rate. All NEW components are justified — NodeRedManager requires different spawn semantics (research.md Decision 1), RingBuffer/settings.ts are novel utilities, and types/commands/prompt/plugin-index are standard per-feature files.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Reuse markers ([REUSE], [EXTEND], [NEW]) trace back to research.md decisions
- Each user story is independently completable and testable
- TDD: write tests first, verify they fail, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
