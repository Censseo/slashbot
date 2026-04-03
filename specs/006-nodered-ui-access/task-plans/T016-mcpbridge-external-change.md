# Task Plan: T016

## Task Description
Subscribe `McpBridgeService` to `flow:external-change` events — trigger tool re-scan on event; unregister tools for deleted flows, update for modified flows.
Phase: 4 | User Story: US2 | Parallel: No | Reuse Type: EXTEND

## Architecture Alignment
- Patterns applied: Event subscription pattern already in McpBridgeService `init()` (lines 67-93); stored unsubscribe handle pattern; reuses existing `handleFlowDeleted()`/`handleFlowUpdated()` methods
- Tech decisions followed: EventBus subscribe; TypeScript strict; `FlowChange` type routing
- Conventions: new `private unsubscribeExternalChange?: () => void` field; wired in `init()`, cleaned in `dispose()`
- Anti-patterns avoided: Does not do full `scanAndRegisterTools()` for targeted changes; uses per-flow handlers
- Status: Aligned

## Reuse Decision
Original: EXTEND McpBridgeService | Validation: VALID
For EXTEND: base `src/plugins/nodered/services/McpBridgeService.ts`; extension points are `init()` (line 67) for subscription and `dispose()` (line 95) for cleanup.

## Codebase Impact
- Files to create: none
- Files to modify:
  - `src/plugins/nodered/services/McpBridgeService.ts:51` — add `private unsubscribeExternalChange?: () => void;`
  - `src/plugins/nodered/services/McpBridgeService.ts:93` — add `flow:external-change` subscription in `init()`
  - `src/plugins/nodered/services/McpBridgeService.ts:104` — add cleanup in `dispose()`
- Dependencies: `FlowChange` type from `../types.js`

## Implementation Steps
1. Add field: `private unsubscribeExternalChange?: () => void;` around line 51
2. In `init()` after existing subscriptions (line 92), add:
   ```typescript
   this.unsubscribeExternalChange = this.events.subscribe('flow:external-change', (envelope: unknown) => {
     const e = envelope as Record<string, unknown> | undefined;
     const payload = (e?.payload ?? e) as { changes?: FlowChange[] } | undefined;
     const changes = payload?.changes ?? [];
     for (const change of changes) {
       if (change.changeType === 'deleted') {
         this.handleFlowDeleted(change.flowId);
       } else {
         void this.scanAndRegisterFlow(change.flowId);
       }
     }
   });
   ```
3. Add private helper:
   ```typescript
   private async scanAndRegisterFlow(flowId: string): Promise<void> {
     try {
       const flows = await this.flowManager.listFlows();
       const flow = flows.find(f => f.id === flowId);
       if (flow) {
         await this.handleFlowUpdated(flow);
       } else {
         this.handleFlowDeleted(flowId);
       }
     } catch (err) {
       this.logger?.warn?.(`Failed to re-scan flow ${flowId}:`, err);
     }
   }
   ```
4. In `dispose()` add: `this.unsubscribeExternalChange?.(); this.unsubscribeExternalChange = undefined;`
5. Ensure `FlowChange` import exists in the file (add `import type { FlowChange } from '../types.js'` if not present)

Gotchas:
- Envelope unwrapping pattern (`e?.payload ?? e`) must match existing handlers at lines 73-84
- `handleFlowUpdated` is async; use `void` prefix in the for-loop to match existing codebase pattern
- If Node-RED is down when event fires, `listFlows()` will throw — try/catch in `scanAndRegisterFlow` handles this

## Related Tasks
Depends on: T014, T015 | Blocks: — | Parallel with: —

## Estimated Complexity
Simple | 30min | Risk: Low (additive subscription; reuses existing handler methods)
