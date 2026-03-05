# Task Plan: T010

## Task Description
Integration test: `nodered:ready` event triggers full scan and registration of eligible flows.
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: TDD, event-driven integration testing
- Conventions: tests in `McpBridgeService.test.ts`
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: NEW_CONFIRMED

## Codebase Impact
- Files to modify: `tests/plugins/nodered/services/McpBridgeService.test.ts` — add `makeFunctionalEventBus()` helper, add `describe('integration: nodered:ready')` block

## Implementation Steps
1. Add `makeFunctionalEventBus()` — a mock that actually dispatches to subscribers:
   ```ts
   function makeFunctionalEventBus() {
     const subscribers = new Map<string, Array<(e: any) => void>>();
     return {
       subscribe: vi.fn((type: string, handler: (e: any) => void) => {
         const list = subscribers.get(type) ?? [];
         list.push(handler);
         subscribers.set(type, list);
         return vi.fn();
       }),
       publish: vi.fn((type: string, payload: Record<string, unknown>) => {
         const envelope = { type, payload, at: new Date().toISOString() };
         for (const h of subscribers.get(type) ?? []) h(envelope);
       }),
     };
   }
   ```
2. Add `describe('integration: nodered:ready')` test cases:
   - Publish `nodered:ready` with `{ port: 1880 }` → `registerTool` called for eligible flows
   - Publish `nodered:ready` with no eligible flows → no `registerTool` calls
3. Each test: create service, call `init()`, trigger event, flush microtasks:
   ```ts
   await new Promise(r => setTimeout(r, 0));
   // or use vi.waitFor(() => expect(...), { timeout: 500 });
   ```

Gotchas:
- EventEnvelope format: `{ type, payload, at }` — `at` is ISO string
- `scanAndRegister()` is async — event handler calls `void this.scanAndRegister()`, needs microtask flush
- If flush is unreliable, use `vi.waitFor()` as fallback
- `subscribe` returns `() => void` unsubscriber

## Related Tasks
Depends on: T005, T006, T009 (all helpers must exist) | Blocks: T011 | Parallel with: none

## Estimated Complexity
Moderate | ~45 min | Risk: Medium (async event handler flush pattern)
