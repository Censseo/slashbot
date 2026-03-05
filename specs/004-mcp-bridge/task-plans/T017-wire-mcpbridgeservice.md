# Task Plan: T017

## Task Description
Wire `McpBridgeService` into `createNodeRedPlugin()` in `src/plugins/nodered/index.ts` — instantiate in `setup()`, call `init()`, register as service `nodered.mcpBridge`.
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: EXTEND

## Architecture Alignment
- Patterns applied: Factory plugin wiring — closure variable alongside `manager` and `flowManager`; `context.registerService()` pattern
- Tech decisions followed: Service ID `'nodered.mcpBridge'`, `pluginId = PLUGIN_ID`
- Conventions: import with `.js` extension; closure variable `mcpBridgeService`
- Anti-patterns avoided: No init-time I/O; `init()` only subscribes to events
- Status: Aligned

## Reuse Decision
Original: EXTEND | Validation: VALID
Extends existing `createNodeRedPlugin()` with McpBridgeService instantiation.

## Codebase Impact
- Files to modify:
  - `src/plugins/nodered/index.ts` — add import, closure variable, instantiation in `setup()`, service registration, `dispose()` in shutdown hook

## Implementation Steps
1. Add import: `import { McpBridgeService } from './services/McpBridgeService.js';`
2. Add closure variable after `let flowManager`: `let mcpBridgeService: McpBridgeService;`
3. In `setup()`, after flowManager instantiation:
   ```ts
   const port = manager.getConfig().port;
   mcpBridgeService = new McpBridgeService(context, events, port, flowManager);
   mcpBridgeService.init();
   ```
4. Register service:
   ```ts
   context.registerService({
     id: 'nodered.mcpBridge', pluginId: PLUGIN_ID,
     description: 'Auto-registers MCP-flagged flows as AI tools',
     implementation: mcpBridgeService,
   });
   ```
5. Add `mcpBridgeService.dispose()` in shutdown hook before `manager.destroy()`

Gotchas:
- `manager.getConfig().port` returns default (1880) before `manager.init()` runs in startup hook — if custom port configured, McpBridgeService will have wrong port at construction. Mitigate with lazy port resolution or accept default for US1.
- `dispose()` before `manager.destroy()` to avoid race conditions with in-flight scans
- Import uses `.js` extension for ESM compatibility

## Related Tasks
Depends on: T016 (McpBridgeService fully implemented) | Blocks: none (completes US1) | Parallel with: none

## Estimated Complexity
Simple | ~25 min | Risk: Low
