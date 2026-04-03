# Task Plan: T011

## Task Description
Implement NodeRedPlugin class in `src/plugins/nodered/index.ts`: metadata (id: 'feature.nodered', category: 'feature', dependencies: []), init() creates NodeRedManager + binds to DI + calls manager.init() + auto-starts if enabled, destroy() delegates to manager, sidebar contribution with dynamic label via Object.defineProperty getter (NR: Running/Stopped/Starting/Failed/Disabled/Unavailable), getStatus() returns true only when running, prompt contribution (priority 160), empty action/tool contributions

Phase: User Story 1 - Automatic Node-RED Startup | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied:
  - Plugin Interface Pattern (standard Plugin implementation from `src/plugins/types.ts` lines 75-99)
  - Service Self-Registration in DI (HeartbeatPlugin pattern at `src/plugins/heartbeat/index.ts` lines 46-54)
  - Dynamic Sidebar Label via Object.defineProperty (novel pattern, documented in plan.md)
  - Contribution-Based Extension (commands, sidebar, prompt, actions, tools)
- Tech decisions followed: TypeScript strict, InversifyJS DI, sidebar order=25 (between Heartbeat=20 and Wallet=30)
- Conventions: file at `src/plugins/nodered/index.ts`, class name `NodeRedPlugin`, plugin ID `feature.nodered`
- Anti-patterns avoided: No feature logic in plugin class (delegates to NodeRedManager), no direct cross-plugin imports
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID
Base pattern: HeartbeatPlugin at `src/plugins/heartbeat/index.ts` (canonical plugin lifecycle)
New capability: Node-RED lifecycle management with dynamic sidebar labels

## Codebase Impact
- Files to create (NEW only): `src/plugins/nodered/index.ts` -- NodeRedPlugin class
- Files to modify: None at this step (T012 modifies loader.ts)
- Dependencies:
  - Plugin interfaces from `../types` (Plugin, PluginMetadata, PluginContext, PromptContribution, SidebarContribution, ActionContribution)
  - TYPES from `../../core/di/types`
  - NodeRedManager from `./services/NodeRedManager`
  - NODERED_PROMPT from `./prompt`
  - NodeRedState from `./types`

## Implementation Steps
1. Create `src/plugins/nodered/index.ts`
2. Import Plugin types from `../types` (Plugin, PluginMetadata, PluginContext, PromptContribution, SidebarContribution, ActionContribution)
3. Import TYPES from `../../core/di/types`
4. Import NodeRedManager from `./services/NodeRedManager`
5. Import NODERED_PROMPT from `./prompt`
6. Import NodeRedState from `./types`
7. Define NodeRedPlugin class implementing Plugin:
   - `readonly metadata: PluginMetadata` = { id: 'feature.nodered', name: 'Node-RED', version: '1.0.0', category: 'feature', description: 'Managed Node-RED runtime' }
   - `private context!: PluginContext`
   - `private manager!: NodeRedManager`
8. Implement `async init(context: PluginContext)`:
   - Store context
   - Create NodeRedManager with EventBus from DI
   - Self-register in DI: `context.container.bind(TYPES.NodeRedManager).toConstantValue(manager)` (with isBound guard)
   - Store manager reference
   - Call `manager.init()`
   - Auto-start if enabled: `if (manager.getConfig().enabled && manager.getState() !== 'unavailable') { await manager.start() }`
9. Implement `async destroy()`:
   - Delegate to `manager.destroy()`
10. Implement `getSidebarContributions()`:
    - Create contribution with id: 'nodered', order: 25
    - getStatus returns `manager.getState() === 'running'`
    - Use Object.defineProperty for dynamic label:
      ```
      labels: { disabled: 'NR: Disabled', unavailable: 'NR: Unavailable',
                stopped: 'NR: Stopped', starting: 'NR: Starting',
                running: 'NR: Running', failed: 'NR: Failed' }
      ```
11. Implement `getPromptContributions()`:
    - Return: `[{ id: 'feature.nodered.docs', title: 'Node-RED Process Management', priority: 160, content: NODERED_PROMPT }]`
12. Implement `getActionContributions()`: return `[]`
13. Implement `getToolContributions()`: return `[]`

Gotchas:
- Manager must be initialized BEFORE auto-start (init() then start())
- DI binding must check `isBound()` to avoid double-registration
- Dynamic label getter accesses `this.manager` -- ensure manager is initialized before sidebar rendering
- getStatus() returns boolean (true when running), not state enum
- Auto-start only if enabled AND state !== 'unavailable'
- Order 25 places sidebar between Heartbeat (20) and Wallet (30)

## Related Tasks
Depends on: T009 (NodeRedManager service), T010 (NODERED_PROMPT constant) | Blocks: T012 (plugin registration) | Parallel with: None

## Estimated Complexity
Moderate | 30min | Risk: Medium (dynamic sidebar label is novel pattern)
