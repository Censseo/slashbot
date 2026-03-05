# Task Plan: T013

## Task Description
Write unit tests for FlowChangePoller in `src/plugins/nodered/services/FlowChangePoller.test.ts` — test: poll detects hash change → emits event; poll with same hash → no event; bot CRUD updates hash → poller skips; poller start/stop lifecycle; API failure → graceful retry.
Phase: 4 | User Story: US2 | Parallel: Yes | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Vitest with `vi.useFakeTimers()` (same as NodeRedManager.test.ts); hand-rolled mockEventBus `{ publish: vi.fn(), subscribe: vi.fn(() => vi.fn()) }`; TDD — tests written before implementation
- Tech decisions followed: Vitest, TypeScript strict, Bun runtime stubs
- Conventions: file at `src/plugins/nodered/services/FlowChangePoller.test.ts`, colocated with implementation
- Anti-patterns avoided: No unconsumed `mockResolvedValueOnce` queue leaking between tests (use `vi.resetAllMocks()` in beforeEach); no direct cross-plugin imports
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID
For NEW: No existing poller test file. Pattern follows `NodeRedManager.test.ts` for timer-based testing and `McpBridgeService` test for event bus mocking.

## Codebase Impact
- Files to create: `src/plugins/nodered/services/FlowChangePoller.test.ts` — full Vitest test suite
- Files to modify: none
- Dependencies: imports `FlowChangePoller` from `./FlowChangePoller.js`; mocks `IFlowManager` and EventBus inline

## Implementation Steps
1. Import `{ describe, it, expect, vi, beforeEach, afterEach }` from `'vitest'` and `FlowChangePoller` from `'./FlowChangePoller.js'`
2. Define `mockFlowManager` with `listFlows: vi.fn()`, `getFlowsRevisionHash: vi.fn()`, `getLastKnownHash: vi.fn()`, `updateLastKnownHash: vi.fn()`
3. Define `mockEvents = { publish: vi.fn(), subscribe: vi.fn(() => vi.fn()) }`
4. In `beforeEach`: call `vi.useFakeTimers()`, `vi.resetAllMocks()`, instantiate poller
5. In `afterEach`: call `vi.useRealTimers()`
6. Test "poll detects hash change → emits event": set `getFlowsRevisionHash` to resolve `'def'` after initial `'abc'`; advance timers by 15000ms; assert `mockEvents.publish` called with `'flow:external-change'` and payload containing `previousHash`/`currentHash`
7. Test "poll with same hash → no event": `getFlowsRevisionHash` always resolves `'abc'`; advance 15s; assert no `flow:external-change` publish
8. Test "bot CRUD updates hash → poller skips": call `poller.updateHash('xyz')` before advancing; `getFlowsRevisionHash` returns `'xyz'`; assert no event
9. Test "start/stop lifecycle": call `start()` then `stop()`; advance 30s; assert `getFlowsRevisionHash` not called after stop
10. Test "API failure → graceful retry": `getFlowsRevisionHash` rejects first call, then resolves; assert no crash, poller retries next interval
11. Test `FlowChange[]` computation: mock `listFlows` returning different sets; assert `changes` array contains correct `created`/`modified`/`deleted` entries

Gotchas:
- `vi.useFakeTimers()` must be called before instantiating the poller
- Initial hash baseline: first poll sets baseline without emitting event (null → first hash = skip)
- `FlowChange[]` requires comparing two `FlowInfo[]` snapshots via `listFlows` mock

## Related Tasks
Depends on: — (TDD: tests first) | Blocks: T014 (defines contract) | Parallel with: T014

## Estimated Complexity
Moderate | 1h | Risk: Medium (interface defined ahead of implementation; minor adjustments likely)
