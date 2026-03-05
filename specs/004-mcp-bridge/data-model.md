# Data Model: MCP Bridge

**Feature**: 004-mcp-bridge | **Date**: 2026-02-25

## Entities

### ParamDescriptor (NEW)

Describes a single tool parameter extracted from flow metadata.

```typescript
// Location: src/plugins/nodered/flow-types.ts
interface ParamDescriptor {
  type: 'string' | 'number' | 'boolean';
  description?: string;
  required?: boolean;
}
```

- **Status**: NEW
- **Fields**: `type` (required), `description` (optional), `required` (optional, defaults to false)
- **Validation**: `type` must be one of the three allowed values
- **Used by**: McpBridgeService to generate Zod schemas for tool definitions

### FlowMetadata (EXTENDED)

```typescript
// Location: src/plugins/nodered/flow-types.ts
interface FlowMetadata {
  flowId: string;        // EXISTING
  creator: string;       // EXISTING
  createdAt: string;     // EXISTING
  updatedAt: string;     // EXISTING
  description: string;   // EXISTING
  tags: string[];        // EXISTING
  mcp: boolean;          // EXISTING
  params?: Record<string, ParamDescriptor>;  // NEW — optional, absent treated as {}
}
```

- **Status**: EXTENDED (add `params` field)
- **Migration**: None needed — field is optional; absent value treated as `{}` triggering fallback schema
- **Persisted in**: `~/.slashbot/nodered/flow-metadata.json` (existing file)

### FlowMetadataInput (EXTENDED)

```typescript
// Location: src/plugins/nodered/flow-types.ts
interface FlowMetadataInput {
  creator: string;       // EXISTING
  description: string;   // EXISTING
  tags: string[];        // EXISTING
  mcp: boolean;          // EXISTING
  params?: Record<string, ParamDescriptor>;  // NEW
}
```

- **Status**: EXTENDED (add `params` field)

### FlowToolDefinition (NEW — runtime only, not persisted)

Internal representation used by McpBridgeService to track registered flow tools.

```typescript
// Location: src/plugins/nodered/services/McpBridgeService.ts (internal)
interface FlowToolDefinition {
  flowId: string;
  toolId: string;              // e.g., "nodered:check-sol-price"
  label: string;               // Flow label
  description: string;         // From flow metadata or auto-generated
  endpointUrl: string;         // Full URL: http://localhost:{port}/{path}
  httpMethod: string;          // GET, POST, etc. from HTTP-in node
  params: Record<string, ParamDescriptor>;  // From FlowMetadata or empty
}
```

- **Status**: NEW (runtime only)
- **State**: In-memory Map keyed by `flowId` inside McpBridgeService
- **Lifecycle**: Rebuilt on each `nodered:ready`; updated on flow events during steady-state

### ToolDefinition (EXISTING — reused)

```typescript
// Location: src/core/kernel/contracts.ts (no changes)
interface ToolDefinition<TArgs extends JsonValue = JsonValue> {
  id: string;
  title?: string;
  description: string;
  pluginId: string;
  execute: (args: TArgs, context: ToolCallContext) => Promise<ToolResult>;
  timeoutMs?: number;
  requiresApproval?: boolean;
  parameters?: ZodTypeAny;
}
```

- **Status**: EXISTING — no changes needed
- **Used by**: McpBridgeService generates these from FlowToolDefinition and registers via `context.registerTool()`

## Relationships

```text
FlowMetadata (extended with params)
  └── params: Record<string, ParamDescriptor>
        └── used by McpBridgeService to generate...
              └── ToolDefinition.parameters (Zod schema)

FlowToolDefinition (runtime tracking)
  ├── flowId → links to FlowMetadata.flowId
  ├── toolId → links to ToolDefinition.id in ToolRegistry
  └── endpointUrl → derived from flow's HTTP-in node
```

## State Transitions

### McpBridgeService Internal State

The bridge maintains a `Map<string, FlowToolDefinition>` (flowId → tool info):

| Trigger | Action | State Change |
|---------|--------|-------------|
| `nodered:ready` | Teardown all `nodered:*` tools, re-scan all flows | Map cleared, then rebuilt |
| `flow:created` | Check eligibility, register if eligible | Entry added to Map |
| `flow:updated` | Re-check eligibility; register/update/unregister as needed | Entry added, updated, or removed |
| `flow:deleted` | Unregister tool if was registered | Entry removed from Map |
| `nodered:stopped` | Unregister all `nodered:*` tools | Map cleared |
