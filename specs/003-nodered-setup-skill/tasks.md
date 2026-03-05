# Tasks: Node-RED Setup Skill

**Input**: Design documents from `/specs/003-nodered-setup-skill/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — plan.md WP9 and constitution TDD check both require tests.

**Organization**: Tasks grouped by user story. US1/US2/US3 are all P1; US4 is P2.

## Format: `[ID] [P?] [Story?] [Reuse?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3, US4
- **[Reuse]**: REUSE, EXTEND, REFACTOR, NEW

---

## Phase 1: Setup

**Purpose**: Prepare bundled skills directory and skill loader path

- [X] T001 [REFACTOR] Update `resolveBundledSkillsDir()` in `src/plugins/skills/index.ts` to resolve from `src/plugins/skills/bundled/` instead of `<repo-root>/skills/`
- [X] T002 [P] [NEW] Create directory `src/plugins/skills/bundled/nodered-setup/` and empty SKILL.md placeholder

**Checkpoint**: Bundled skills directory exists and skill loader resolves it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: State machine and type changes that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [EXTEND] Add `'setup-needed'` to `NodeRedState` union type in `src/plugins/nodered/types.ts`
- [X] T004 [EXTEND] Add `setup-needed` transitions to `VALID_TRANSITIONS` in `src/plugins/nodered/services/NodeRedManager.ts`
- [X] T005 [P] [EXTEND] Add `'setup-needed': 'NR: Setup Needed'` to `STATE_LABELS` in `src/plugins/nodered/index.ts`
- [X] T006 [P] [EXTEND] Add `'nodered:setup-needed': Record<string, never>` to EventMap type declarations
- [X] T007 [REFACTOR] Move `generateSettings()` call from `start()` to `setup()` in plugin index or NodeRedManager, ensuring `~/.slashbot/nodered/` directory is created (FR-014, FR-015)

**Checkpoint**: State machine accepts `setup-needed`, sidebar label displays it, settings.js generated eagerly.

---

## Phase 3: User Story 1 — Bot Detects Missing Node-RED and Sets It Up (Priority: P1) MVP

**Goal**: Plugin detects Node-RED is unavailable and autonomously triggers setup via skill.

**Independent Test**: Start slashbot with no Node-RED installed; verify plugin transitions to `setup-needed`, context provider returns skill instruction, and automation job fires.

### Tests for User Story 1

- [X] T008 [P] [US1] Unit test: `NodeRedManager` transitions to `setup-needed` when Node.js present but Node-RED not installed, in `tests/nodered-manager.test.ts` [Plan](task-plans/T008-unit-test-setup-needed-transition.md)
- [X] T008b [P] [US1] Unit test: `NodeRedManager` probes port on startup and adopts existing instance (FR-011), and plugin init completes without blocking when Node-RED is unavailable (FR-016), in `tests/nodered-manager.test.ts` [Plan](task-plans/T008b-unit-test-port-probe-nonblocking.md)
- [X] T009 [P] [US1] Unit test: context provider returns skill invocation message when state is `setup-needed`, in `tests/nodered-context.test.ts` [Plan](task-plans/T009-unit-test-context-provider-setup-needed.md)

### Implementation for User Story 1

- [X] T010 [US1] [REFACTOR] Modify `NodeRedManager.init()` to detect missing Node-RED and call `setState('setup-needed')` instead of `ensureNodeRedInstalled()` in `src/plugins/nodered/services/NodeRedManager.ts` [Plan](task-plans/T010-refactor-init-setup-needed.md)
- [X] T011 [US1] [REFACTOR] Remove `ensureNodeRedInstalled()` method from `src/plugins/nodered/services/NodeRedManager.ts` [Plan](task-plans/T011-remove-ensure-nodered-installed.md)
- [X] T012 [US1] [EXTEND] Enrich `nodered.context` provider in `src/plugins/nodered/index.ts` to return skill invocation instruction when state is `setup-needed` [Plan](task-plans/T012-enrich-context-provider.md)
- [X] T013 [US1] [REUSE] Add one-shot automation job via `AutomationService.addOnceJob()` in `src/plugins/nodered/index.ts` with null guard for soft dependency (FR-003) [Plan](task-plans/T013-automation-once-job.md)
- [X] T014 [US1] [EXTEND] Update `src/plugins/nodered/prompt.ts` to include skill invocation guidance for `setup-needed` state [Plan](task-plans/T014-prompt-setup-needed-guidance.md)

**Checkpoint**: On startup without Node-RED, plugin enters `setup-needed`, context provider instructs bot, automation job fires.

---

## Phase 4: User Story 2 — Bot Manages Node-RED Lifecycle via Skill (Priority: P1)

**Goal**: Bot can start, stop, restart Node-RED via skill instructions; crash recovery triggers skill autonomously.

**Independent Test**: With Node-RED installed, ask bot to stop/start/restart; simulate crash and verify autonomous restart.

### Tests for User Story 2

- [X] T015 [P] [US2] Unit test: PID file read/write/removal logic in `tests/unit/plugins/nodered/NodeRedManager.test.ts`

### Implementation for User Story 2

- [X] T016 [US2] [EXTEND] Add PID file read logic to `NodeRedManager` for stale process adoption and skill-started processes in `src/plugins/nodered/services/NodeRedManager.ts`
- [X] T017 [US2] [EXTEND] Update crash detection in `NodeRedManager` to trigger one-shot automation job for skill-based restart (up to 3 retries with exponential backoff) in `src/plugins/nodered/index.ts`

**Checkpoint**: PID file tracking works; crash recovery triggers skill restart via automation job.

---

## Phase 5: User Story 3 — Plugin Detects Node-RED Availability via Heartbeat (Priority: P1)

**Goal**: Heartbeat monitoring detects state changes and emits appropriate events.

**Independent Test**: Start/stop Node-RED externally; verify plugin detects changes and emits events.

### Notes

Heartbeat monitoring already exists from feature 001. This story validates it works correctly with the new `setup-needed` state and skill-based recovery. Most changes are covered by US1/US2 tasks. This phase captures any remaining heartbeat-specific work.

- [X] T018 [US3] [EXTEND] Ensure heartbeat loop correctly transitions from `setup-needed` to `running` when Node-RED becomes available (skill completed) in `src/plugins/nodered/services/NodeRedManager.ts`
- [X] T019 [P] [US3] Unit test: heartbeat transitions from `setup-needed` → `running` when Node-RED starts responding, in `tests/unit/plugins/nodered/NodeRedManager.test.ts`

**Checkpoint**: Heartbeat correctly detects Node-RED appearing after skill setup and emits `nodered:ready`.

---

## Phase 6: User Story 4 — Skill Provides Installation Instructions (Priority: P2)

**Goal**: SKILL.md contains complete, platform-aware instructions for the bot.

**Independent Test**: Bot executes skill on a clean system; Node-RED is installed and started.

- [X] T020 [US4] [NEW] Write full SKILL.md with frontmatter and instruction sections (detect, install, start, stop, restart, verify, troubleshoot) in `src/plugins/skills/bundled/nodered-setup/SKILL.md`
- [X] T021 [P] [US4] Unit test: skill frontmatter parsing and discovery from bundled path in `tests/unit/plugins/skills/`

**Checkpoint**: Skill is discoverable via `/skill list`, frontmatter parsed correctly, instructions complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T022 Verify all existing nodered tests still pass after refactoring (`bun run test -- --grep "nodered"`). NOTE: Remove or update tests for deleted `ensureNodeRedInstalled()` method.
- [X] T023 [P] Run quickstart.md validation — start slashbot with no Node-RED and confirm end-to-end flow. Include verifying user invocation via `/skill run nodered-setup` (FR-013).
- [X] T024 [P] Verify FR-012: grep plugin TypeScript code for npm/npx/bun references (must be zero)
- [X] T025 [P] Update architecture-registry.md with new patterns: "Skill-Delegated Lifecycle" and "Dual Signal (Context + Automation)" (per plan.md Registry Updates)

---

## Review Corrections (2026-02-19, branch: 003-nodered-setup-skill)

> Source: [review-2026-02-19.md](reviews/review-2026-02-19.md)

### Stale Tests (Critical — blocks CI)

- [X] T026 [CRITICAL] Fix 53 failing legacy tests in `src/plugins/nodered/services/NodeRedManager.test.ts`: remove tests for deleted `ensureNodeRedInstalled()` method, update state transition tests to account for `setup-needed` state, fix start/stop/restart tests that expect old spawn behavior. This file has 106 tests total — 53 pass, 53 fail.

### Code Quality

- [X] T027 [HIGH] Simplify redundant `response.ok && response.status === 200` checks to `response.ok` in `src/plugins/nodered/services/NodeRedManager.ts` (lines 190, 319, 452)
- [X] T028 [MEDIUM] Verify `/nr` alias referenced in `src/plugins/nodered/prompt.ts:18` is actually registered. If not, remove the line or register the alias.

### Impact on Pending Tasks

| Task | Impact | Amendment |
|------|--------|-----------|
| T023 (quickstart validation) | Blocked by T026 — cannot validate end-to-end if legacy tests fail in CI | Add dependency: T023 depends on T026 |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 for skill path)
- **Phase 3 (US1)**: Depends on Phase 2 (state machine, settings)
- **Phase 4 (US2)**: Depends on Phase 2; can run in parallel with US1
- **Phase 5 (US3)**: Depends on Phase 2; can run in parallel with US1/US2
- **Phase 6 (US4)**: Depends on Phase 1 (T002 for SKILL.md path); can run in parallel with US1-3
- **Phase 7 (Polish)**: Depends on all previous phases

### Within-Story Order

```
T001 → T002 (setup)
T003 → T004 (state type before transitions)
T005, T006 parallel with T004
T007 after T003
T010 → T011 → T012 → T013 → T014 (US1 sequential)
T016 → T017 (US2 sequential)
T020 after T002 (needs directory)
```

### Parallel Opportunities

```bash
# Phase 2 parallel group:
T005 | T006  (different files, both extend after T003)

# US1 tests (before implementation):
T008 | T009

# Cross-story parallel (after Phase 2):
US1 (T010-T014) | US2 (T016-T017) | US3 (T018) | US4 (T020)

# Polish parallel:
T023 | T024
```

---

## Implementation Strategy

### MVP First (US1 + US4)

1. Phase 1: Setup (T001-T002)
2. Phase 2: Foundational (T003-T007)
3. Phase 3: US1 — Detection + signaling (T008-T014)
4. Phase 6: US4 — SKILL.md (T020-T021)
5. **STOP AND VALIDATE**: Bot detects missing Node-RED and installs it
6. Phase 4: US2 — Lifecycle management (T015-T017)
7. Phase 5: US3 — Heartbeat validation (T018-T019)
8. Phase 7: Polish (T022-T024)

---

## Idea Technical Traceability

**Source Idea**: `ideas/002-nodered-plugin/idea.md`

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| Node-RED as child process of slashbot | T020 (skill start instructions) | Mapped |
| Health check via HTTP GET | T018, T019 (heartbeat validation) | Mapped |
| Auto-restart on crash | T017 (crash → automation job) | Mapped |
| Node.js required on host | T020 (frontmatter `requires.bins: [node]`) | Mapped |
| settings.js for custom config | T007 (eager generation) | Mapped |
| Events: ready, stopped, error, failed | T003, T006 (extend with setup-needed) | Mapped |
| Port 1880 default, configurable | T020 (skill references settings.js port) | Mapped |
| Graceful shutdown SIGTERM→SIGKILL | T020 (skill stop instructions) | Mapped |
| `npm install -g node-red` or `npx node-red` | T020 (local install with npm/bun detection) | Mapped (divergent) |

### Divergences from Idea

| Idea Specified | Task Implements | Justification |
|----------------|-----------------|---------------|
| `npm install -g node-red` or `npx node-red` (global install) | Local install in `~/.slashbot/nodered/` with npm/bun detection (T020) | Spec FR-004/FR-012 require npm-independence; local install is more portable and contained. Documented in plan.md. |

---

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 1 | T013 |
| EXTEND | 10 | T003, T004, T005, T006, T012, T014, T016, T017, T018, T019 (test) |
| REFACTOR | 4 | T001, T007, T010, T011 |
| NEW | 2 | T002, T020 |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| `resolveBundledSkillsDir()` | REFACTOR | T001 | Path change from `<repo>/skills/` to `src/plugins/skills/bundled/` per FR-001 |
| `NodeRedState` union | EXTEND | T003 | Add `setup-needed` as 7th value |
| `VALID_TRANSITIONS` | EXTEND | T004 | Add transitions for new state |
| `STATE_LABELS` | EXTEND | T005 | Add sidebar label |
| EventMap | EXTEND | T006 | Add `nodered:setup-needed` event |
| `generateSettings()` | REFACTOR | T007 | Move call timing from `start()` to `setup()` |
| `NodeRedManager.init()` | REFACTOR | T010 | Replace `ensureNodeRedInstalled()` with `setup-needed` transition |
| `ensureNodeRedInstalled()` | REFACTOR | T011 | Remove entirely |
| Context provider | EXTEND | T012 | Enrich with skill invocation instruction |
| `AutomationService.addOnceJob()` | REUSE | T013 | Wire existing API for one-shot job |
| `prompt.ts` | EXTEND | T014 | Add skill guidance |
| `NodeRedManager` PID logic | EXTEND | T016 | Add PID file read for skill-started processes |
| Crash detection | EXTEND | T017 | Add automation job trigger |
| Heartbeat loop | EXTEND | T018 | Handle `setup-needed` → `running` transition |
| SKILL.md | NEW | T020 | No existing skill; justified by entire feature scope |
| Bundled dir | NEW | T002 | Directory didn't exist; required by FR-001 |

**Reuse health**: NEW = 2/17 (12%) — good code reuse. Most work extends or refactors existing components.
