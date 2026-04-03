# Task Plan: T015

## Task Description
Wire `FlowChangePoller` into plugin lifecycle — start poller when Node-RED starts (if credentials configured), stop on shutdown.

**Divergence**: Task description says "modify NodeRedManager.ts" but NodeRedManager has no FlowManager reference. Correct extension point is `index.ts` `setup()`, subscribing to `nodered:ready`/`nodered:stopped` events — same pattern as McpBridgeService.
Phase: 4 | User Story: US2 | Parallel: No | Reuse Type: EXTEND

## Architecture Alignment
- Patterns applied: Lifecycle event subscription pattern (McpBridgeService subscribes to `nodered:ready`/`nodered:stopped`); service wired in `index.ts` setup alongside other services
- Tech decisions followed: EventBus-driven lifecycle; no direct cross-service coupling
- Conventions: Service instantiation in `index.ts` `setup()` block alongside `manager`, `flowManager`, `mcpBridgeService`
- Anti-patterns avoided: Avoids adding FlowManager dependency to NodeRedManager; avoids shared mutable state
- Status: Divergent from task description (targets `index.ts` not `NodeRedManager.ts`) — architecturally justified

## Reuse Decision
Original: EXTEND NodeRedManager.ts | Validation: NEEDS_UPDATE — actual target is `index.ts`
For EXTEND: base `src/plugins/nodered/index.ts` setup() block (lines 58-101); add FlowChangePoller instantiation and lifecycle subscriptions.

## Codebase Impact
- Files to create: none
- Files to modify:
  - `src/plugins/nodered/index.ts:17` — add `import { FlowChangePoller } from './services/FlowChangePoller.js'`
  - `src/plugins/nodered/index.ts:62` — add `let flowChangePoller: FlowChangePoller` declaration
  - `src/plugins/nodered/index.ts:81` — instantiate `flowChangePoller = new FlowChangePoller(flowManager, events)`
  - `src/plugins/nodered/index.ts` — add event subscriptions for `nodered:ready` → `start()` and `nodered:stopped` → `stop()`
- Dependencies: `FlowChangePoller` from `./services/FlowChangePoller.js`

## Implementation Steps
1. Add import: `import { FlowChangePoller } from './services/FlowChangePoller.js';`
2. Add declaration: `let flowChangePoller: FlowChangePoller;` alongside other service vars
3. Instantiate after `mcpBridgeService` creation: `flowChangePoller = new FlowChangePoller(flowManager, events);`
4. Subscribe to lifecycle events:
   ```typescript
   events.subscribe('nodered:ready', () => { flowChangePoller.start(); });
   events.subscribe('nodered:stopped', () => { flowChangePoller.stop(); });
   ```
5. In plugin's destroy/teardown hook (if present), call `flowChangePoller.stop()`

Gotchas:
- `nodered:ready` may fire multiple times (restart cycles); `FlowChangePoller.start()` must guard against double-start
- Poller starts unconditionally — credentials check happens in `generateSettings()` which controls whether editor is even accessible
- Unsubscribe handles: if plugin needs cleanup, store the subscription return values

## Related Tasks
Depends on: T014 | Blocks: T016 | Parallel with: —

## Estimated Complexity
Simple | 15min | Risk: Low (purely additive wiring)
