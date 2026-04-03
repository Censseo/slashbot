# Task Plan: T009

## Task Description
Unit test: `McpBridgeService.scanAndRegister()` — scans all flows via FlowManager, registers eligible ones via `context.registerTool()`.
Phase: Phase 3 | User Story: US1 | Parallel: Yes | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: TDD, mock-based testing
- Conventions: tests in `McpBridgeService.test.ts`
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: NEW_CONFIRMED

## Codebase Impact
- Files to modify: `tests/plugins/nodered/services/McpBridgeService.test.ts` — add `makeFlowManager()` helper, add `describe('scanAndRegister')` block

## Implementation Steps
1. Add `makeFlowManager()` helper:
   ```ts
   function makeFlowManager(flows: FlowInfo[] = []) {
     return { listFlows: vi.fn().mockResolvedValue(flows) };
   }
   ```
2. Add `describe('scanAndRegister')` test cases:
   - 3 flows (2 eligible, 1 not) → `context.registerTool` called twice
   - 0 flows → no `registerTool` calls
   - `FlowManager.listFlows()` throws → error logged via `ctx.logger.error`, no crash
   - Duplicate slugs (two flows with same label) → second skipped + `logger.warn` called

Gotchas:
- `scanAndRegister()` is async — all tests must `await` it
- Constructor signature: `new McpBridgeService(flowManager, eventBus, context)` — adjust if T011 differs
- FlowManager mock only needs `listFlows` method

## Related Tasks
Depends on: T005, T006 (helpers) | Blocks: T016 | Parallel with: T006, T007, T008

## Estimated Complexity
Moderate | ~35 min | Risk: Low
