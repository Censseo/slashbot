# Research: MCP Bridge

**Feature**: 004-mcp-bridge | **Date**: 2026-02-25

## Existing Codebase Analysis

### Reusable Components

| Component | Location | Reuse Decision | Notes |
|-----------|----------|----------------|-------|
| `Registry<T>` | `src/core/kernel/registries.ts` | EXTEND | Add `delete(id: string)` method; `upsert()` already exists |
| `ToolRegistry` | `src/core/kernel/registries.ts` | REUSE | Inherits `upsert()` from `Registry<T>` |
| `PluginRegistrationContext` | `src/core/kernel/contracts.ts` + `src/plugin-sdk/index.d.ts` | EXTEND | Add `unregisterTool(id: string)` |
| `createNodeRedPlugin()` | `src/plugins/nodered/index.ts` | EXTEND | Add McpBridgeService instantiation in `setup()` |
| `FlowManager` | `src/plugins/nodered/services/FlowManager.ts` | REUSE | Existing flow CRUD; emits events the bridge listens to |
| `FlowMetadata` | `src/plugins/nodered/flow-types.ts` | EXTEND | Add `params?: Record<string, ParamDescriptor>` |
| `FlowParser` | `src/plugins/nodered/services/FlowParser.ts` | REUSE | Extracts HTTP endpoints from `http in` nodes |
| `EventBus` | `src/core/kernel/event-bus.ts` | REUSE | Subscribe to `flow:created/updated/deleted`, `nodered:ready` |
| `fetchWithRetry` pattern | `FlowManager.ts` | REUSE | Same localhost HTTP pattern for invoking flows |
| `ToolDefinition` | `src/core/kernel/contracts.ts` | REUSE | Standard tool shape: id, description, parameters (Zod), execute |
| EventMap declaration merging | `src/plugins/nodered/index.ts` | REUSE | Already declares `flow:created`, `flow:updated`, `flow:deleted`, `nodered:ready` |

### Existing Patterns to Follow

| Pattern | Source | Application |
|---------|--------|-------------|
| Factory plugin function | `createNodeRedPlugin()` | McpBridgeService created inside existing factory, not a new plugin |
| Service registration | `context.registerService('nodered.manager', ...)` | Register bridge as `nodered.mcpBridge` |
| EventBus subscription | `context.getService<EventBus>('kernel.events')` | Same for bridge event subscriptions |
| Tool ID namespacing | `nodered.flow.create` (static), `nodered:<slug>` (dynamic) | Dynamic flow tools use colon separator |
| Zod parameter schemas | All existing tools use `z.object({...})` | Generate from `FlowMetadata.params` |
| Native fetch | `FlowManager.ts` `fetchWithRetry()` | Reuse for flow invocation HTTP calls |

### Potential Conflicts

| Concern | Details | Mitigation |
|---------|---------|------------|
| Tool ID collision | Dynamic `nodered:*` tools could theoretically collide with static `nodered.*` tools | Different separator (`:` vs `.`) prevents collision |
| `Registry<T>` is `private readonly` items Map | `delete()` needs access to private Map | Add `delete()` as a method on the class itself |
| No kernel wiring for `unregisterTool` | Kernel context builder in `kernel.ts` only wires `registerTool` | Add parallel wiring for `unregisterTool` → `tools.delete(id)` |

## Technical Decisions

### Decision 1: McpBridgeService Location

- **Decision**: New class `src/plugins/nodered/services/McpBridgeService.ts` inside the existing nodered plugin
- **Existing code considered**: `createNodeRedPlugin()` already captures `context` in closure
- **Reuse approach**: EXTEND — add service instantiation to existing plugin setup
- **Rationale**: Spec explicitly states this; follows Library-First principle (service testable independently)

### Decision 2: Tool Registration/Unregistration API

- **Decision**: Add `delete(id: string)` to `Registry<T>` and `unregisterTool(id: string)` to `PluginRegistrationContext`
- **Existing code considered**: `Registry<T>` has `register()`, `upsert()`, `get()`, `list()` but no `delete()`
- **Reuse approach**: EXTEND
- **Rationale**: Spec FR-003 requires `context.unregisterTool(id)`. Minimal change to core.

### Decision 3: Flow Eligibility Detection

- **Decision**: Check flows for: (a) HTTP-in node presence, (b) `mcp: true` in FlowMetadata, (c) `mcp-<name>` label pattern. All require HTTP endpoint for invocation.
- **Existing code considered**: `FlowParser` already extracts HTTP-in nodes; `FlowMetadata.mcp` boolean exists
- **Reuse approach**: REUSE FlowParser for endpoint extraction; EXTEND FlowMetadata with `params`
- **Rationale**: Spec FR-001 defines these criteria; FlowParser already does HTTP endpoint extraction

### Decision 4: Parameter Schema Generation

- **Decision**: Add `params?: Record<string, ParamDescriptor>` to `FlowMetadata`; generate Zod schemas from it at runtime
- **Existing code considered**: `FlowMetadata` has `mcp: boolean` but no params; `FlowMetadataInput` same
- **Reuse approach**: EXTEND
- **Rationale**: Spec FR-005. Fallback default: `z.object({ input: z.string().optional() })`

### Decision 5: HTTP Invocation

- **Decision**: Use native `fetch` with retry pattern from FlowManager to invoke flow endpoints
- **Existing code considered**: `fetchWithRetry` in FlowManager, native fetch elsewhere
- **Reuse approach**: REUSE pattern (extract shared utility or duplicate small helper)
- **Rationale**: Localhost calls, consistent with codebase patterns

### Decision 6: Reconciliation Strategy

- **Decision**: Full teardown + re-scan on `nodered:ready`; diff-based on `flow:updated` during steady-state
- **Existing code considered**: No existing reconciliation logic
- **Reuse approach**: NEW
- **Rationale**: Spec FR-008. Ensures clean state after Node-RED restart.

### Decision 7: Prompt Refresh

- **Decision**: Emit `prompt:redraw` event after tool registration/unregistration changes
- **Existing code considered**: EventBus already supports `prompt:redraw` (used by other plugins for prompt updates)
- **Reuse approach**: REUSE
- **Rationale**: Spec FR-009. Standard pattern for notifying prompt assembly of changes.
