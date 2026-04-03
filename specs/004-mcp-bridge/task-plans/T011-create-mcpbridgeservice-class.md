# Task Plan: T011

## Task Description
Create `McpBridgeService` class in `src/plugins/nodered/services/McpBridgeService.ts` with constructor accepting `PluginRegistrationContext`, `EventBus`, and Node-RED port config. Define internal `Map<string, FlowToolDefinition>` for tracking. Implement `FlowToolDefinition` interface (runtime only).
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Library-First — standalone service class with constructor injection (same as `NodeRedManager`, `FlowManager`)
- Tech decisions followed: TypeScript strict, plain class (no InversifyJS decorators), factory-based plugin uses plain instantiation
- Conventions: file at `src/plugins/nodered/services/McpBridgeService.ts`, class name `McpBridgeService`
- Anti-patterns avoided: No feature logic in core; FlowToolDefinition is runtime-only (not in flow-types.ts)
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID
No existing McpBridgeService. Create from scratch following NodeRedManager pattern.

## Codebase Impact
- Files to create: `src/plugins/nodered/services/McpBridgeService.ts`
- Files to modify: none
- Dependencies:
  - `PluginRegistrationContext` from `src/core/kernel/contracts.ts`
  - `EventBus` from `src/core/kernel/event-bus.ts`
  - `FlowInfo`, `ParamDescriptor` from `../flow-types.js`
  - `FlowManager` from `./FlowManager.js`

## Implementation Steps
1. Create `src/plugins/nodered/services/McpBridgeService.ts`
2. Define `FlowToolDefinition` interface (exported for testing, runtime-only):
   ```ts
   export interface FlowToolDefinition {
     flowId: string; toolId: string; label: string; description: string;
     endpointUrl: string; httpMethod: string;
     params: Record<string, ParamDescriptor>;
   }
   ```
3. Define class with private fields:
   - `registeredTools: Map<string, FlowToolDefinition>`
   - `context: PluginRegistrationContext`
   - `events: EventBus`
   - `port: number`
   - `flowManager: FlowManager`
   - `logger` (from `context.logger`)
   - `unsubscribeReady?: () => void`
4. Constructor: `(context, events, port, flowManager)`
5. Stub `init(): void` and `dispose(): void` methods
6. Add `NODERED_PLUGIN_ID = 'slashbot.nodered'` constant

Gotchas:
- `context.logger` provides the StructuredLogger — no separate import needed
- Port is passed as number from `manager.getConfig().port` — may be default (1880) if called before `manager.init()`; consider lazy port resolution

## Related Tasks
Depends on: T004 (ParamDescriptor) | Blocks: T012, T013, T014, T015, T016 | Parallel with: none

## Estimated Complexity
Simple | ~30 min | Risk: Low
