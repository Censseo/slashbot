# Tasks: Slashbot Runner Module

**Input**: Design documents from `/specs/013-slashbot-runner-module/`
**Prerequisites**: spec.md ✅, plan.md ✅, research.md ✅, data-model.md ✅, contracts/runner-types.ts ✅

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and build tooling for the runner module

- [X] T001 Create `src/runner/` directory structure: `types.ts`, `registry.ts`, `runner.ts`, `index.ts` (empty stub files)
- [X] T002 Create `tests/runner/` directory with placeholder test files: `types.test.ts`, `registry.test.ts`, `runner.test.ts`
- [X] T003 [P] Add `runner:build` script to `package.json`: `bun build src/runner/index.ts --target=node --outfile=dist/runner.cjs --format=cjs`
- [X] T004 [P] Create `dist/` in `.gitignore` if not already present

**Checkpoint**: Directory structure in place; build script registered.

---

## Phase 2: Foundational — Type Definitions (Blocking Prerequisites)

**Purpose**: Define all shared types that every other phase depends on. MUST complete before any implementation phase.

**⚠️ CRITICAL**: No implementation can begin until the type definitions are stable and Zod schema passes validation tests.

### Tests for Phase 2 (TDD — write FIRST, verify they FAIL)

- [X] T005 [P] [Types] Write tests in `tests/runner/types.test.ts`:
  - Zod schema rejects missing required fields (`stepType`, `prompt`, `model`, `workspacePath`, `credentials`)
  - Zod schema accepts valid `StepPayload` with all required fields
  - Zod schema accepts optional `metadata` field
  - Type narrowing works correctly for each `RunnerEvent` discriminant

### Implementation for Phase 2

- [X] T006 [Types] Implement `src/runner/types.ts` following `contracts/runner-types.ts`:
  - `StepPayload` interface + `StepPayloadSchema` (Zod v4)
  - `OutputChunkEvent`, `AskUserEvent`, `StepCompleteEvent`, `ErrorEvent` interfaces
  - `RunnerEvent` discriminated union type
  - `RunnerPlugin` interface
  - `IPluginRegistry` interface
  - `ISlashbotRunner` interface
  - Error code constants: `RUNNER_ERRORS = { NO_PLUGIN: 'NO_PLUGIN', INVALID_PAYLOAD: 'INVALID_PAYLOAD', PLUGIN_ERROR: 'PLUGIN_ERROR', INIT_ERROR: 'INIT_ERROR' }`

**Checkpoint**: `bun run test tests/runner/types.test.ts` passes. Types are exported and importable.

---

## Phase 3: User Story 2 — Plugin Registry

**Goal**: Implement `PluginRegistry` with step-type routing — enables Feature 02 (claude-code plugin) to register itself.

**Independent Test**: Register two stub plugins under different step types; verify routing, default fallback, and unknown-type behavior.

### Tests for Phase 3 (TDD — write FIRST, verify they FAIL)

- [X] T007 [P] [US2] Write tests in `tests/runner/registry.test.ts`:
  - `register(stepType, plugin)` → `getPlugin(stepType)` returns the plugin
  - `register` with duplicate step type overwrites (last-write-wins)
  - `getPlugin` for unknown type with no default returns `undefined`
  - `registerDefault(plugin)` → `getPlugin` for unknown type returns the default plugin
  - `registerDefault` called twice overwrites the previous default
  - `getPlugin` exact match takes precedence over default

### Implementation for Phase 3

- [X] T008 [US2] Implement `src/runner/registry.ts`:
  - `PluginRegistry` class implementing `IPluginRegistry`
  - `private plugins: Map<string, RunnerPlugin>`
  - `private defaultPlugin: RunnerPlugin | undefined`
  - `register(stepType, plugin): void`
  - `registerDefault(plugin): void`
  - `getPlugin(stepType): RunnerPlugin | undefined` — exact match first, default fallback, undefined if neither

**Checkpoint**: `bun run test tests/runner/registry.test.ts` passes. All 6 scenarios verified.

---

## Phase 4: User Story 1 — SlashbotRunner Core

**Goal**: Implement `SlashbotRunner.executeStep()` — the main entry point: validation, routing, error isolation, concurrency safety.

**Independent Test**: Create runner with stub plugin; call `executeStep` and assert events flow correctly including error scenarios.

### Tests for Phase 4 (TDD — write FIRST, verify they FAIL)

- [X] T009 [P] [US1] Write tests in `tests/runner/runner.test.ts`:
  - Success path: stub plugin yields `output_chunk` + `step_complete` → both events received in order
  - Error from plugin: plugin throws → `error` event with `code: 'PLUGIN_ERROR'` received; no throw to caller
  - No plugin for step type: `error` event with `code: 'NO_PLUGIN'` and message containing step type
  - Default plugin fallback: `error` event NOT emitted when default plugin handles unknown type
  - Invalid payload (missing `prompt`): `error` event with `code: 'INVALID_PAYLOAD'` immediately
  - Concurrency: 10 simultaneous `executeStep` calls with separate step types produce isolated event streams (no cross-contamination)
  - `ask_user` event: plugin yields `ask_user` → event flows through iterator without modification

### Implementation for Phase 4

- [X] T010 [US1] Implement `src/runner/runner.ts`:
  - `SlashbotRunner` class implementing `ISlashbotRunner`
  - Constructor accepts optional `PluginRegistry` (creates own if not provided)
  - `readonly registry: PluginRegistry`
  - `async *executeStep(payload: StepPayload): AsyncGenerator<RunnerEvent>`:
    1. Parse payload with `StepPayloadSchema.safeParse()`; on failure yield `ErrorEvent(INVALID_PAYLOAD)` and return
    2. Look up plugin via `registry.getPlugin(payload.stepType)`; if undefined yield `ErrorEvent(NO_PLUGIN)` and return
    3. Wrap `yield* plugin.execute(payload)` in try/catch; on catch yield `ErrorEvent(PLUGIN_ERROR)`
  - Each call creates a new async generator context — no shared mutable state
- [X] T011 [US1] Implement `src/runner/index.ts` exports:
  - Named exports: `SlashbotRunner`, `PluginRegistry`, `StepPayloadSchema`
  - Type exports: `StepPayload`, `RunnerEvent`, `OutputChunkEvent`, `AskUserEvent`, `StepCompleteEvent`, `ErrorEvent`, `RunnerPlugin`, `IPluginRegistry`, `ISlashbotRunner`, `RUNNER_ERRORS`

**Checkpoint**: `bun run test tests/runner/runner.test.ts` passes. All 7 scenarios verified including concurrency test.

---

## Phase 5: User Story 3 — Runtime Compatibility (Build Target)

**Goal**: Validate that the compiled CJS bundle is importable and functional in Node.js 20.

**Independent Test**: A minimal Node.js 20 script imports the bundle, registers a stub plugin, calls `executeStep`, and asserts correct output.

### Tests for Phase 5 (TDD)

- [X] T012 [US3] Create `tests/runner/node-compat.test.ts` (or integration script `tests/runner/node-compat.mjs`):
  - Verify `dist/runner.cjs` exists after build (can be skipped in watch mode)
  - Verify `require('../../dist/runner.cjs')` resolves `SlashbotRunner` and `PluginRegistry`
  - Verify executing `executeStep` with stub plugin in Node.js ≥ 18 environment yields expected events
  - Note: If Bun test runner runs in Node.js-compat mode, this test may run natively; otherwise add to `package.json` as a separate `test:node-compat` script

### Implementation for Phase 5

- [X] T013 [US3] Verify `bun build src/runner/index.ts --target=node --outfile=dist/runner.cjs --format=cjs` produces a valid bundle:
  - No `Bun.*` namespace references in output
  - No unresolved dynamic imports
  - Bundle size documented in plan.md (informational)
- [X] T014 [US3] [P] If Node.js-specific incompatibilities are found during T013, apply shim/replace strategies (e.g., replace any `Bun.file` usages with `fs.readFileSync` equivalents in runner module scope)
- [X] T015 [US3] Update `package.json` scripts:
  - `"runner:build": "bun build src/runner/index.ts --target=node --outfile=dist/runner.cjs --format=cjs"`
  - `"runner:test:compat": "node tests/runner/node-compat.mjs"` (if applicable)

**Checkpoint**: `npm run runner:build` succeeds. Node.js compat test passes. US3 acceptance scenarios SC-003 verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure test coverage, type exports, and build validation are complete.

- [X] T016 [P] Run `bun run test tests/runner/` — all tests pass; coverage ≥ 70% for `src/runner/`
- [X] T017 [P] Run `tsc --noEmit` — no TypeScript errors in `src/runner/`
- [X] T018 Verify `RUNNER_ERRORS` codes match exactly what error events emit in T006/T010
- [X] T019 [P] Add JSDoc comments to all public exports in `src/runner/index.ts` (plugin contract documentation per constitution)
- [X] T020 Verify credential values do not appear in any error message strings (review T010 error paths)

**Checkpoint**: All tests pass. TypeScript clean. Ready for Feature 02 integration.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Types)**: Depends on Phase 1 — BLOCKS all implementation phases
- **Phase 3 (Registry)**: Depends on Phase 2 (types) — can start after T006
- **Phase 4 (Runner Core)**: Depends on Phase 2 + Phase 3 — can start after T008
- **Phase 5 (Build Target)**: Depends on Phase 4 — can start after T011
- **Phase 6 (Polish)**: Depends on all previous phases

### Parallel Opportunities

- T003 and T004 (Phase 1) can run in parallel
- T005 and T007 (test writing) can run in parallel after Phase 1
- T009 (runner tests) can be drafted in parallel with T007/T008
- T013 and T014 are sequential (T014 only if T013 finds issues)
- T016, T017, T018, T019, T020 (Phase 6) can run in parallel

### Within Each Phase (TDD ordering)

Test tasks MUST be written and verified FAILING before implementation tasks in the same phase.

---

## Implementation Strategy

### MVP First (User Stories 1+2, Phase 1–4)

1. Phase 1: Setup
2. Phase 2: Types (CRITICAL)
3. Phase 3: Registry (US2)
4. Phase 4: Runner Core (US1)
5. **STOP and VALIDATE**: Run all tests; verify 10-concurrent-call isolation

### Full Delivery (Phase 5–6)

6. Phase 5: Build target + Node.js compat (US3)
7. Phase 6: Polish

The MVP (Phases 1–4) delivers the complete API contract that Feature 02 (claude-code plugin) needs to implement against. Phase 5 is required before Feature 03 (streaming bridge) can be integrated into agent-service.

---

## Notes

- [P] tasks = different files, no dependencies within phase
- Tests MUST be written and confirmed FAILING before implementation
- `credentials` field in `StepPayload` must never appear in test assertions as a literal string (use `{ CLAUDE_API_KEY: 'test-key' }` format)
- The `dist/` directory is gitignored; Node.js compat test may require a pre-build step in CI
- Feature 02 will import from `src/runner/index.ts` directly (dev) or from `dist/runner.cjs` (production); this feature's implementation must support both

---

## Phase 7: Review Corrections

<!-- Added from review-2026-04-03 (branch: 013-slashbot-runner-module) -->

**Source**: [reviews/review-2026-04-03.md](reviews/review-2026-04-03.md) | Health: 92/100 | Compliance: 100%

### Code Quality

- [X] T021 Fix SOLID DIP in `src/runner/runner.ts`: change constructor param `registry?: PluginRegistry` to `registry?: IPluginRegistry` and property type to `IPluginRegistry`. Internal `new PluginRegistry()` default creation is fine. Update test that constructs `new SlashbotRunner(registry)` to pass an `IPluginRegistry`-typed variable.
- [X] T022 Align `metadata` Zod schema in `src/runner/types.ts` line 21: `z.record(z.unknown()).optional()` → `z.record(z.string(), z.unknown()).optional()` (matches data-model spec form; functionally identical in Zod v3 but explicitly documents the string key constraint)
- [X] T023 Add JSDoc to `executeStep` in `src/runner/runner.ts` noting that plugins MUST yield a terminal `step_complete` or `error` event; callers are responsible for their own timeout if a plugin may hang.

### Test / CI

- [X] T024 [P] Add Node.js compat integration to CI: document in `package.json` that `runner:test:compat` requires a prior `runner:build`. Optionally add a Vitest test in `tests/runner/node-compat.test.ts` that shells out `node tests/runner/node-compat.mjs` to make it part of the standard test suite.
