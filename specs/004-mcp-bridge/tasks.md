# Tasks: MCP Bridge

**Input**: Design documents from `/specs/004-mcp-bridge/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — constitution requires TDD (Test-First).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] [Reuse?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US4)
- **[Reuse]**: REUSE / EXTEND / REFACTOR / NEW per research.md

---

## Phase 1: Setup

**Purpose**: No new project setup needed — extends existing codebase.

*(No tasks — project structure exists, dependencies already installed.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core extensions that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [EXTEND] Add `delete(id: string)` method to `Registry<T>` in `src/core/kernel/registries.ts` — removes item from internal Map; add JSDoc per FR-012
- [X] T002 [P] [EXTEND] Add `unregisterTool(id: string)` to `PluginRegistrationContext` interface in `src/plugin-sdk/index.d.ts` and contract type in `src/core/kernel/contracts.ts`; add JSDoc per FR-012
- [X] T003 [EXTEND] Wire `unregisterTool` in `createPluginRegistrationContext()` in `src/core/kernel/kernel.ts` — delegate to `tools.delete(id)` (depends on T001, T002)
- [X] T004 [P] [EXTEND] Add `ParamDescriptor` type and `params?: Record<string, ParamDescriptor>` to `FlowMetadata` and `FlowMetadataInput` in `src/plugins/nodered/flow-types.ts`
- [X] T005 [P] [NEW] Create test file `tests/plugins/nodered/services/McpBridgeService.test.ts` with test scaffolding and imports

**Checkpoint**: Core extensions ready — `Registry.delete()`, `context.unregisterTool()`, `FlowMetadata.params` all available.

---

## Phase 3: User Story 1 — Auto-discovery of Deployed Flows (Priority: P1) 🎯 MVP

**Goal**: When a flow with an HTTP endpoint is deployed, it is automatically registered as a tool within 10 seconds.

**Independent Test**: Deploy a flow with an HTTP endpoint and verify it appears as an available tool.

### Tests for User Story 1

> **Write tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] [NEW] Unit test: `McpBridgeService.isEligible()` — flow with HTTP-in node returns true; flow without HTTP-in returns false; flow with `mcp: true` but no HTTP-in returns false with warning; flow with `mcp-<name>` label returns true [Plan](task-plans/T006-unit-test-iseligible.md)
- [X] T007 [P] [US1] [NEW] Unit test: `McpBridgeService.slugifyLabel()` — lowercase, replace non-alphanumeric with hyphens, collapse consecutive, trim, max 64 chars, prefix `nodered:` [Plan](task-plans/T007-unit-test-slugifylabel.md)
- [X] T008 [P] [US1] [NEW] Unit test: `McpBridgeService.buildSchema()` — generates Zod schema from `FlowMetadata.params`; uses fallback `z.object({ input: z.string().optional() })` when params absent [Plan](task-plans/T008-unit-test-buildschema.md)
- [X] T009 [P] [US1] [NEW] Unit test: `McpBridgeService.scanAndRegister()` — scans all flows via FlowManager, registers eligible ones via `context.registerTool()` [Plan](task-plans/T009-unit-test-scanandregister.md)
- [X] T010 [US1] [NEW] Integration test: `nodered:ready` event triggers full scan and registration of eligible flows [Plan](task-plans/T010-integration-test-nodered-ready.md)

### Implementation for User Story 1

- [X] T011 [US1] [NEW] Create `McpBridgeService` class in `src/plugins/nodered/services/McpBridgeService.ts` with constructor accepting `PluginRegistrationContext`, `EventBus`, and Node-RED port config. Define internal `Map<string, FlowToolDefinition>` for tracking. Implement `FlowToolDefinition` interface (runtime only). [Plan](task-plans/T011-create-mcpbridgeservice-class.md)
- [X] T012 [US1] [NEW] Implement `isEligible(flow)` method — check for HTTP-in node (via FlowParser), `mcp: true` metadata, or `mcp-<name>` label pattern; require HTTP endpoint in all cases; log warning for `mcp: true` without HTTP-in [Plan](task-plans/T012-implement-iseligible.md)
- [X] T013 [US1] [NEW] Implement `slugifyLabel(label)` — lowercase, replace non-alphanumeric (except hyphens) with hyphens, collapse consecutive, trim, max 64 chars; return `nodered:<slug>`; warn if truncated (FR-004) [Plan](task-plans/T013-implement-slugifylabel.md)
- [X] T014 [US1] [NEW] Implement `buildSchema(params)` — convert `Record<string, ParamDescriptor>` to Zod schema; map `type` to `z.string()`/`z.number()`/`z.coerce.boolean()`; apply `.optional()` for non-required; fallback default schema (FR-005) [Plan](task-plans/T014-implement-buildschema.md)
- [X] T015 [US1] [NEW] Implement `registerFlowTool(flow, metadata)` — build `FlowToolDefinition`, create `ToolDefinition` with schema and execute handler (placeholder for US2), call `context.registerTool()`, add to internal Map, reject duplicates with warning (FR-010) [Plan](task-plans/T015-implement-registerflowtool.md)
- [X] T016 [US1] [REUSE] Implement `scanAndRegister()` — get all flows via FlowManager, check eligibility for each, register eligible ones; handle `nodered:ready` event subscription [Plan](task-plans/T016-implement-scanandregister.md)
- [X] T017 [US1] [EXTEND] Wire `McpBridgeService` into `createNodeRedPlugin()` in `src/plugins/nodered/index.ts` — instantiate in `setup()`, call `init()`, register as service `nodered.mcpBridge` [Plan](task-plans/T017-wire-mcpbridgeservice.md)

**Checkpoint**: Flows with HTTP endpoints are auto-discovered and registered as tools on startup and deploy events.

---

## Phase 4: User Story 2 — Bot Invokes a Flow-Based Tool (Priority: P1)

**Goal**: The bot can invoke any registered flow tool, passing parameters and receiving structured results.

**Independent Test**: Register a flow tool and invoke it, verifying correct HTTP request and structured response.

### Tests for User Story 2

- [X] T018 [P] [US2] [NEW] Unit test: `execute()` handler — sends HTTP request to correct endpoint URL with correct method; passes validated params as query (GET) or body (POST); returns structured result
- [X] T019 [P] [US2] [NEW] Unit test: error handling — HTTP 4xx/5xx returns structured error; timeout after 30s returns timeout error; unparseable response returns raw text fallback
- [X] T020 [P] [US2] [NEW] Unit test: custom timeout — `FlowMetadata.timeout` overrides default 30s

### Implementation for User Story 2

- [X] T021 [US2] [REUSE] Implement `invokeFlow(flowToolDef, args)` in `McpBridgeService` — build URL from `endpointUrl`, use native `fetch` with method from `httpMethod`; pass args as query params (GET) or JSON body (POST/PUT/etc.); respect 30s default timeout or `FlowMetadata.timeout` (FR-006, FR-007)
- [X] T022 [US2] [NEW] Implement response handling — parse JSON response as `ToolResult.output`; on HTTP error return structured error with status code; on timeout return timeout error; on unparseable response return raw text fallback (FR-007)
- [X] T023 [US2] Update `registerFlowTool()` execute handler (T015) to call `invokeFlow()` with validated args

**Checkpoint**: Bot can invoke flow-based tools and receive structured results including error cases.

---

## Phase 5: User Story 3 — Dynamic Tool Updates on Flow Changes (Priority: P2)

**Goal**: When flows are modified or deleted, the tool registry updates in real time.

**Independent Test**: Modify a registered flow's endpoint, verify tool updates; delete a flow, verify tool removed.

### Tests for User Story 3

- [X] T024 [P] [US3] [NEW] Unit test: `flow:updated` — flow endpoint changes → tool definition updated; flow becomes ineligible → tool removed; ineligible flow becomes eligible → tool added
- [X] T025 [P] [US3] [NEW] Unit test: `flow:deleted` — registered flow deleted → tool unregistered and removed from Map
- [X] T026 [US3] [NEW] Integration test: `nodered:ready` triggers full teardown + re-scan (FR-008)

### Implementation for User Story 3

- [X] T027 [US3] [NEW] Implement `handleFlowUpdated(flow)` — diff-based: compare current FlowToolDefinition with new flow state; if changed (endpoint, method, params, label) → upsert tool; if no longer eligible → unregister; if newly eligible → register (FR-008)
- [X] T028 [US3] [NEW] Implement `handleFlowDeleted(flowId)` — look up in internal Map; if present, call `context.unregisterTool(toolId)`, remove from Map
- [X] T029 [US3] [NEW] Implement `teardownAll()` — iterate internal Map, call `context.unregisterTool()` for each, clear Map. Wire to `nodered:ready` for full teardown + re-scan (FR-008)
- [X] T030 [US3] Subscribe to `flow:created`, `flow:updated`, `flow:deleted` events in `McpBridgeService.init()` — route to appropriate handlers

**Checkpoint**: Tool registry stays in sync with flow changes, including Node-RED restarts.

---

## Phase 6: User Story 4 — System Prompt Refresh on Tool Changes (Priority: P2)

**Goal**: Prompt refreshes after tool registration/unregistration so the bot sees current tools.

**Independent Test**: Add a flow tool, verify `prompt:redraw` event emitted.

### Tests for User Story 4

- [X] T031 [US4] [NEW] Unit test: `prompt:redraw` emitted after `registerFlowTool()`, `unregisterTool()`, and `teardownAll()` + `scanAndRegister()` cycle

### Implementation for User Story 4

- [X] T032 [US4] [REUSE] Emit `prompt:redraw` event via EventBus after each tool registration, unregistration, and after `scanAndRegister()` completes (FR-009) — add calls in `registerFlowTool()`, `handleFlowDeleted()`, `teardownAll()`, and `scanAndRegister()`

**Checkpoint**: Bot's system prompt always reflects current available tools.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] Error handling: ensure `McpBridgeService` initialization failure logs warning and does not crash the application (per error scenarios table)
- [X] T034 [P] Verify all JSDoc comments on `Registry.delete()` and `PluginRegistrationContext.unregisterTool()` per FR-012
- [X] T035 Run full test suite (`bun run test`) and verify all tests pass
- [X] T036 Run quickstart.md validation — manually verify the documented flow works end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: N/A — no tasks
- **Phase 2 (Foundational)**: No dependencies — can start immediately; BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 3 (needs registered tools to invoke)
- **Phase 5 (US3)**: Depends on Phase 3 (needs registration logic to update/remove)
- **Phase 6 (US4)**: Depends on Phase 3 (needs registration hooks to emit events)
- **Phase 7 (Polish)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories
- **US2 (P1)**: After US1 — needs registered tools to invoke
- **US3 (P2)**: After US1 — needs registration logic to diff/update
- **US4 (P2)**: After US1 — needs registration hooks; can parallel with US2/US3

### Parallel Opportunities

```text
# Phase 2 — all foundational tasks can run in parallel:
T001, T002, T004, T005 (T003 depends on T001+T002)

# Phase 3 — all tests can run in parallel:
T006, T007, T008, T009

# Phase 4+5+6 — US2, US3, US4 tests can run in parallel after US1:
T018, T019, T020, T024, T025, T031

# US3 and US4 implementation can run in parallel:
T027-T030 || T032
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 2: Foundational (core extensions)
2. Complete Phase 3: US1 (auto-discovery)
3. Complete Phase 4: US2 (invocation)
4. **STOP and VALIDATE**: Deploy a flow, verify it's discovered and invocable
5. Then Phase 5 (US3) + Phase 6 (US4) for dynamic updates

### Summary

| Phase | Tasks | Parallel |
|-------|-------|----------|
| Foundational | 5 | 4 parallel, 1 sequential |
| US1: Auto-discovery | 12 | 4 test parallel, then sequential impl |
| US2: Invocation | 6 | 3 test parallel, then sequential impl |
| US3: Dynamic updates | 7 | 2 test parallel, then sequential impl |
| US4: Prompt refresh | 2 | sequential |
| Polish | 4 | 2 parallel, 2 sequential |
| **Total** | **36** | |

---

## Phase 8: Review & Polish

> **Source**: Post-implementation review on branch `004-mcp-bridge`, 2026-02-25.
> All prior tasks are complete. These tasks address spec deviations, code quality issues, and test gaps found during review.

### Spec Deviations

- [X] T037 [DRIFT] [US2] **FR-005**: `buildSchema()` fallback for flows with no declared params returns `z.object({})` — spec requires `z.object({ input: z.string().optional() })`. Fix in `McpBridgeService.ts` and update T008 test assertion accordingly.
- [X] T038 [DRIFT] [US1/US2] **FR-006**: `invokeFlow()` hardcodes `httpMethod = 'POST'`. Spec requires reading the HTTP method from the HTTP-in node's `method` field (default GET). Requires two changes: (1) extend `FlowInfo.httpEndpoints` from `string[]` to `{ path: string; method: string }[]` in `flow-types.ts` and propagate through `FlowManager`; (2) update `McpBridgeService.registerFlowTool()` to read `flow.httpEndpoints[0].method ?? 'GET'`. Update T018/T021 tests.
- [X] T039 [PARTIAL] [US3] **FR-008**: Change-detection in `handleFlowUpdated()` does not compare HTTP method. Blocked by T038 — add `existing.httpMethod !== newHttpMethod` to the `changed` predicate after T038 lands.

### Code Quality — High Priority

- [X] T040 [HIGH] Fix SSRF risk: validate `endpointPath` before URL construction in `registerFlowTool()`. Guard: reject paths containing `://`, `@`, or `..`. `src/plugins/nodered/services/McpBridgeService.ts:279`
- [X] T041 [HIGH] Fix port not propagated: `new McpBridgeService(...)` in `src/plugins/nodered/index.ts:79` uses hardcoded default `1880` instead of `manager.getConfig().port`. Pass the port from manager config at construction time.

### Code Quality — Quick Wins

- [X] T042 [MEDIUM] Remove `async` keyword from `teardownAll()` and `handleFlowDeleted()` — both contain no `await`. `McpBridgeService.ts:129,137`
- [X] T043 [MEDIUM] Remove redundant `clearTimeout(timer)` from `catch` block in `invokeFlow()` — `finally` block already handles it unconditionally. `McpBridgeService.ts:367`
- [X] T044 [MEDIUM] Replace `envelope: any` with `unknown` + narrowing in all four event handler callbacks. `McpBridgeService.ts:72`
- [X] T045 [LOW] Fix init race: move `mcpBridgeService.init()` to be `await`ed inside the startup hook (before `manager.start()`), not fire-and-forget in `setup()`. `src/plugins/nodered/index.ts:80`

### Test Gaps

- [X] T046 [MEDIUM] Fix T009 test: currently only asserts `typeof tool.execute === 'function'`. Add a call to `execute({})` with mocked `fetch` and assert the HTTP request URL and method. `tests/plugins/nodered/services/McpBridgeService.test.ts:437`
- [X] T047 [MEDIUM] Add test for `flow:created` event → tool registration. The subscription exists (T030) but no dedicated test covers the created path independently from the updated path. Add to `McpBridgeService.test.ts`.

---

## Idea Technical Traceability

**Source Idea**: [ideas/002-nodered-plugin/idea.md](../../ideas/002-nodered-plugin/idea.md)
**Source Feature**: [ideas/002-nodered-plugin/features/03-mcp-bridge.md](../../ideas/002-nodered-plugin/features/03-mcp-bridge.md)

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| Listen to `flow:created`, `flow:updated`, `flow:deleted` events | T030 | Mapped |
| `GET /flow/:id` to analyze flow | T012, T016 (via FlowParser) | Mapped |
| `POST/GET http://localhost:1880/<endpoint>` to invoke flows | T021 | Mapped |
| Convention: `http in` node + `mcp: true` + `mcp-<name>` label | T012 | Mapped |
| Tool name: slugified label, prefixed `nodered:` | T013 | Mapped |
| Zod schema from params; fallback `z.object({ input: z.string().optional() })` | T014 | Mapped |
| Register in ToolRegistry via `context.registerTool()` | T015 | Mapped |
| Emit `prompt:redraw` after registration | T032 | Mapped |
| Scan existing flows on `nodered:ready` | T016, T029 | Mapped |
| No separate MCP server; direct ToolRegistry mapping | T015 (registers directly) | Mapped |
| No streaming; full response as ToolResult | T022 | Mapped |
| `unregisterTool` on `PluginRegistrationContext` | T002, T003 | Mapped |
| `Registry<T>.delete()` | T001 | Mapped |
| `FlowMetadata.params` as `Record<string, ParamDescriptor>` | T004 | Mapped |
| Bridge in `src/plugins/nodered/services/McpBridgeService.ts` | T011 | Mapped |
| `nodered:` for dynamic, `nodered.` for static | T013 (prefix convention) | Mapped |
| Execution order: events → analyze → extract → schema → register → prompt:redraw | T030 → T012 → T014 → T015 → T032 | Order preserved |

### Divergences from Idea

None. All technical requirements from the idea and feature documents are fully aligned with plan.md and mapped to tasks.

---

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 3 | T016, T021, T032 |
| EXTEND | 5 | T001, T002, T003, T004, T017 |
| NEW | 24 | T005–T015, T018–T020, T022–T031, T033 |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| Registry<T> | EXTEND | T001 | Add `delete()` — existing class, minimal addition |
| PluginRegistrationContext | EXTEND | T002, T003 | Add `unregisterTool()` — mirrors existing `registerTool` |
| FlowMetadata | EXTEND | T004 | Add `params` field — extends existing type |
| createNodeRedPlugin | EXTEND | T017 | Wire McpBridgeService — extends existing factory |
| FlowParser | REUSE | T012, T016 | Existing HTTP endpoint extraction |
| fetchWithRetry pattern | REUSE | T021 | Existing localhost HTTP pattern |
| EventBus (prompt:redraw) | REUSE | T032 | Existing event for prompt refresh |
| McpBridgeService | NEW | T011 | Core new service — no existing equivalent |
| McpBridgeService tests | NEW | T005–T010, T018–T020, T024–T026, T031 | New test coverage |
| Flow handlers | NEW | T022, T027–T030, T033 | New logic — no existing reconciliation/invocation |

**NEW ratio**: 28/36 (78%) — high because McpBridgeService is entirely new functionality. The 5 EXTEND and 3 REUSE tasks cover all touchpoints with existing code. All NEW tasks are justified: the bridge service, its handlers, and its tests have no existing equivalent in the codebase.
