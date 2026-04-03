# Task Plan: T014

## Task Description
Implement `FlowChangePoller` service in `src/plugins/nodered/services/FlowChangePoller.ts` — injectable service with `start()`, `stop()`, `getLastHash()`, `updateHash()`; polls every 15s via `FlowManager.getFlowsRevisionHash()`; compares with last known hash; emits `flow:external-change` on diff; computes `FlowChange[]` by comparing flow lists.
Phase: 4 | User Story: US2 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Timer interval pattern matching `NodeRedManager`'s `startHealthCheckTimer`/`clearHealthCheckTimer`; EventBus publish for typed events; `FlowChange`/`FlowChangeEvent` types from `types.ts`
- Tech decisions followed: TypeScript strict, Bun runtime, EventBus publish, plain class (no InversifyJS decorators — instantiated in `index.ts`)
- Conventions: file at `src/plugins/nodered/services/FlowChangePoller.ts`
- Anti-patterns avoided: No shared mutable state; uses interface (not concrete FlowManager) for testability; no cross-plugin imports
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID
For NEW: No existing poller. Closest analogue is NodeRedManager's health check timer pattern at `NodeRedManager.ts:71-74`.

## Codebase Impact
- Files to create: `src/plugins/nodered/services/FlowChangePoller.ts` — full service
- Files to modify:
  - `src/plugins/nodered/index.ts:22-35` — add `'flow:external-change'` to EventMap augmentation
  - `src/plugins/nodered/index.ts:17` — add import for `FlowChange` type
- Dependencies: `FlowChange`, `FlowChangeEvent` from `../types.js`; `FlowInfo` from flow types; `EventBus` publish interface

## Implementation Steps
1. Define minimal `IFlowPoller` interface in the file:
   ```typescript
   interface IFlowPoller {
     listFlows(): Promise<FlowInfo[]>;
     getFlowsRevisionHash(): Promise<string>;
     getLastKnownHash(): string | null;
     updateLastKnownHash(hash: string): void;
   }
   ```
2. Class fields: `private pollTimer: ReturnType<typeof setInterval> | null = null`; `private lastHash: string | null = null`; `private lastFlowSnapshot: Map<string, FlowInfo> = new Map()`; `private readonly POLL_INTERVAL_MS = 15_000`
3. Constructor: `constructor(private readonly flowManager: IFlowPoller, private readonly events: Pick<EventBus, 'publish'>)`
4. `start()`: guard double-start; set `lastHash` from `flowManager.getLastKnownHash()`; schedule `setInterval(() => void this.poll(), this.POLL_INTERVAL_MS)`
5. `stop()`: `clearInterval(this.pollTimer); this.pollTimer = null`
6. `getLastHash()`: returns `this.lastHash`
7. `updateHash(hash: string)`: sets `this.lastHash` (prevents false positives after bot CRUD)
8. `private async poll()`: wrapped in try/catch:
   - Call `getFlowsRevisionHash()`; on error: log warn, return
   - If `lastHash === null`: set baseline, seed `lastFlowSnapshot` from `listFlows()`, return (no event on first poll)
   - If hash unchanged: return
   - Call `listFlows()`, diff against `lastFlowSnapshot`:
     - New IDs → `created`; missing IDs → `deleted`; same ID with different nodeCount/label → `modified`
   - Build `FlowChangeEvent` payload, publish `'flow:external-change'`
   - Update `lastHash` and `lastFlowSnapshot`
9. Add `'flow:external-change'` to EventMap augmentation in `index.ts`

Gotchas:
- `listFlows()` called twice per detected change (once in hash, once for diff) — acceptable for correctness
- `lastFlowSnapshot` seeded lazily on first poll to avoid blocking `start()`
- First poll with `lastHash === null` sets baseline only, no event emitted

## Related Tasks
Depends on: T013 (tests define contract) | Blocks: T015, T016 | Parallel with: T013

## Estimated Complexity
Moderate | 1h | Risk: Medium (FlowChange diffing edge cases; double listFlows trade-off)
