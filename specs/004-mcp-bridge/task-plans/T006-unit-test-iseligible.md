# Task Plan: T006

## Task Description
Unit test: `McpBridgeService.isEligible()` — flow with HTTP-in node returns true; flow without returns false; flow with `mcp:true` but no HTTP-in returns false with warning; flow with `mcp-<name>` label returns true.
Phase: Phase 3 | User Story: US1 | Parallel: Yes | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: TDD — tests written before implementation
- Tech decisions followed: Vitest, TypeScript strict
- Conventions: file at `tests/plugins/nodered/services/McpBridgeService.test.ts` (existing scaffold)
- Anti-patterns avoided: N/A
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: NEW_CONFIRMED
No existing tests for this method.

## Codebase Impact
- Files to create: none (use existing scaffold from T005)
- Files to modify: `tests/plugins/nodered/services/McpBridgeService.test.ts` — fix `makeEventBus()`, add `makeFlowInfo()` helper, add `describe('isEligible')` block
- Dependencies: `FlowInfo` from `src/plugins/nodered/flow-types.ts`, `McpBridgeService` (T011)

## Implementation Steps
1. **Fix `makeEventBus()`** — replace `.on`/`.emit` with correct EventBus API:
   ```ts
   function makeEventBus() {
     return { publish: vi.fn(), subscribe: vi.fn(() => vi.fn()) };
   }
   ```
2. **Add `makeFlowInfo()` helper** with sensible defaults:
   ```ts
   function makeFlowInfo(overrides: Partial<FlowInfo> = {}): FlowInfo {
     return {
       id: 'flow-1', label: 'My Flow', nodeCount: 3, httpEndpoints: [],
       metadata: { flowId: 'flow-1', creator: 'test', createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(), description: '', tags: [], mcp: false },
       ...overrides,
     };
   }
   ```
3. **Update `makeContext()`** to include `logger` mock:
   ```ts
   function makeContext() {
     return { registerTool: vi.fn(), unregisterTool: vi.fn(),
       logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
   }
   ```
4. **Add `describe('isEligible')` test cases** (tested indirectly via `scanAndRegister`):
   - flow with httpEndpoints + `mcp:true` → registered (eligible)
   - flow with httpEndpoints + `mcp-` prefixed label → registered (eligible)
   - flow without httpEndpoints → not registered
   - flow with `mcp:true` but no httpEndpoints → not registered + `logger.warn` called
   - flow with neither mcp flag nor mcp- label → not registered

Gotchas:
- `isEligible` is private — test via `scanAndRegister()` with mocked FlowManager
- EventBus uses `.subscribe()/.publish()`, NOT `.on()/.emit()`

## Related Tasks
Depends on: T005 (scaffold) | Blocks: T012 (implementation must satisfy tests) | Parallel with: T007, T008, T009

## Estimated Complexity
Simple | ~30 min | Risk: Low
