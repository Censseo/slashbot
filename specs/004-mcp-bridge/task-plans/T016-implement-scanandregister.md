# Task Plan: T016

## Task Description
Implement `scanAndRegister()` — get all flows via FlowManager, check eligibility for each, register eligible ones; handle `nodered:ready` event subscription.
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: REUSE

## Architecture Alignment
- Patterns applied: Typed Event Bus — `events.subscribe('nodered:ready', handler)` returns unsubscriber; FlowManager called as injected dependency
- Tech decisions followed: EventBus `.subscribe()`/`.publish()` API; `EventEnvelope<T>` with `.payload`
- Conventions: public `init()` sets up subscriptions; `scanAndRegister()` public for testability; `dispose()` cleans up
- Anti-patterns avoided: No blocking in `init()`; no raw `async` in subscription callback (use `void`)
- Status: Aligned

## Reuse Decision
Original: REUSE | Validation: VALID (NEEDS_UPDATE — FlowParser doesn't exist, use FlowManager.listFlows() directly)
Reuses: EventBus subscription pattern from NodeRedManager; FlowManager.listFlows() for flow retrieval.

## Codebase Impact
- Files to modify: `src/plugins/nodered/services/McpBridgeService.ts` — implement `init()`, `scanAndRegister()`, `dispose()`

## Implementation Steps
1. Implement `init()`:
   ```ts
   public init(): void {
     this.unsubscribeReady = this.events.subscribe('nodered:ready', () => {
       void this.scanAndRegister();
     });
   }
   ```
2. Implement `scanAndRegister()`:
   ```ts
   public async scanAndRegister(): Promise<void> {
     let flows: FlowInfo[];
     try { flows = await this.flowManager.listFlows(); }
     catch (err) { this.logger.error('failed to list flows during scan', { error: String(err) }); return; }
     let registered = 0;
     for (const flow of flows) {
       if (this.isEligible(flow)) { this.registerFlowTool(flow); registered++; }
     }
     this.logger.info('scan complete', { total: flows.length, registered });
   }
   ```
3. Implement `dispose()`:
   ```ts
   public dispose(): void { this.unsubscribeReady?.(); this.unsubscribeReady = undefined; }
   ```

Gotchas:
- `nodered:ready` fires once per Node-RED startup; on restart, re-scan will hit duplicate guard (acceptable for US1; US3 adds teardown)
- Subscription callback uses `void` to avoid unhandled rejection propagation
- `FlowManager.listFlows()` throws if Node-RED not available — guarded with try/catch

## Related Tasks
Depends on: T011, T012, T015 | Blocks: T017 | Parallel with: none

## Estimated Complexity
Moderate | ~40 min | Risk: Medium (EventBus subscribe type signature)
