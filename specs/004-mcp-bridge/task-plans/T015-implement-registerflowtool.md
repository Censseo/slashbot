# Task Plan: T015

## Task Description
Implement `registerFlowTool(flow, metadata)` — build `FlowToolDefinition`, create `ToolDefinition` with schema and placeholder execute handler (US2), call `context.registerTool()`, add to internal Map, reject duplicates with warning (FR-010).
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Contribution-Based Extension — uses `context.registerTool()` with full `ToolDefinition` shape
- Tech decisions followed: Tool shape from `contracts.ts` — `{ id, title, pluginId, description, parameters, execute }`
- Conventions: private method; tool ID from `slugifyLabel`; `NODERED_PLUGIN_ID` constant
- Anti-patterns avoided: No direct mutation of kernel registries
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID

## Codebase Impact
- Files to modify: `src/plugins/nodered/services/McpBridgeService.ts` — add `registerFlowTool` private method

## Implementation Steps
1. Add private method:
   ```ts
   private registerFlowTool(flow: FlowInfo): void {
     const toolId = this.slugifyLabel(flow.label);
     if (this.registeredTools.has(toolId)) {
       this.logger.warn('duplicate tool ID — skipping', { toolId, flowId: flow.id });
       return;
     }
     const endpointPath = flow.httpEndpoints[0]!;
     const endpointUrl = `http://127.0.0.1:${this.port}${endpointPath}`;
     const schema = this.buildSchema(flow.metadata.params);
     const toolDef: FlowToolDefinition = {
       flowId: flow.id, toolId, label: flow.label,
       description: flow.metadata.description || flow.label,
       endpointUrl, httpMethod: 'POST', params: flow.metadata.params ?? {},
     };
     this.context.registerTool({
       id: toolId, title: flow.label, pluginId: NODERED_PLUGIN_ID,
       description: flow.metadata.description || `Invoke Node-RED flow: ${flow.label}`,
       parameters: schema, timeoutMs: flow.metadata.timeout,
       execute: async () => ({ ok: false, error: { code: 'NOT_IMPLEMENTED', message: 'Flow invocation not yet implemented (US2)' } }),
     });
     this.registeredTools.set(toolId, toolDef);
     this.logger.info('registered MCP tool', { toolId, flowId: flow.id, label: flow.label });
   }
   ```

Gotchas:
- `flow.httpEndpoints[0]` assumes first endpoint is canonical — document this
- `endpointUrl` uses `127.0.0.1` (not `localhost`) to avoid IPv6 resolution issues
- Duplicate check is by `toolId` (slugified label), not `flowId` — two flows with same label collide (FR-010)
- Execute handler is a placeholder — US2 (T021) replaces it with actual HTTP invocation

## Related Tasks
Depends on: T013 (slugifyLabel), T014 (buildSchema), T011 (class + Map) | Blocks: T016 | Parallel with: none

## Estimated Complexity
Moderate | ~45 min | Risk: Low
