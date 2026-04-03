# Feature Specification: MCP Bridge

**Feature Branch**: `004-mcp-bridge`
**Created**: 2026-02-24
**Status**: Draft
**Source**: [Feature 03](../../ideas/002-nodered-plugin/features/03-mcp-bridge.md)
**Parent Idea**: [idea.md](../../ideas/002-nodered-plugin/idea.md)

## Clarifications

### Session 2026-02-25 (continued)

- Q: How to unregister tools when `Registry<T>` has no `delete()` method? → A: Add `delete(id: string)` method to `Registry<T>` in core.
- Q: Can flows with `mcp: true` but no HTTP endpoint be invoked? → A: No — `mcp: true` is a hint but an HTTP endpoint is still required for invocation; flows without one are skipped with a warning.
- Q: Tool ID format: colon vs dot notation conflict with existing nodered tools? → A: Keep the distinction — `nodered.` for management tools, `nodered:` for dynamic flow tools.
- Q: How does the bridge call unregisterTool at runtime? → A: Add `unregisterTool(id: string)` to `PluginContext` contract (mirrors `registerTool`); bridge uses `context.unregisterTool(id)` — no direct registry access.
- Q: How does the bridge determine HTTP method when invoking a flow? → A: Read the method from the HTTP-in node's `method` field; respect the flow's declared method.
- Q: Default tool name conflict resolution — suffix or reject? → A: Reject the duplicate with a warning log; flow author must rename the conflicting flow.
- Q: What is the TypeScript shape of `ParamDescriptor`? → A: `{ type: 'string' | 'number' | 'boolean'; description?: string; required?: boolean }`
- Q: Reconciliation strategy after Node-RED restart? → A: Full teardown (unregister all `nodered:*` tools) + re-scan on each `nodered:ready` event; diff-based add/remove for normal `flow:updated` events during steady-state.
- Q: How to extract tool parameter schemas from flows? → A: Require flow creators to declare params in metadata (`FlowMetadata.params: Record<string, ParamDescriptor>`) from day one.
- Q: Should the bridge support streaming responses from flows? → A: Deferred — FR-011 removed from MVP; bridge returns full responses as single ToolResult only. No async iterator; SDK has no streaming support.

### Session 2026-02-25 (integration clarifications)

- Q: Where should the MCP bridge logic live architecturally? → A: New `McpBridgeService` class in `src/plugins/nodered/services/`. The existing `createNodeRedPlugin()` captures `context` in its `setup()` closure and passes it to the service. No new plugin manifest needed.
- Q: Should FR-011 streaming be in scope? → A: Deferred — `ToolResult` has no streaming API; adding one would be a breaking SDK change. Bridge returns full HTTP response as single `ToolResult`.
- Q: How should `FlowMetadata.params` be added given it's missing from the current type? → A: Add `params?: Record<string, ParamDescriptor>` as an optional field to `FlowMetadata` in `flow-types.ts`. No migration needed — absent field treated as `{}`, triggering the fallback schema.
- Q: How should the bridge subscribe to EventBus events (`flow:created`, `nodered:ready`, etc.)? → A: Inject EventBus via `context.getService('core.eventbus')` in `setup()`, then pass to `McpBridgeService`. The service calls `eventBus.subscribe(...)` directly in its `init()` method — same pattern as `FlowManager`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-discovery of Deployed Flows (Priority: P1)

When a new flow is deployed in Node-RED that contains an HTTP endpoint or is annotated for exposure, the system automatically registers it as a tool that the bot can discover and invoke — without any manual configuration.

**Why this priority**: This is the core value proposition. Without auto-discovery, every flow would require manual tool registration, defeating the purpose of the bridge.

**Independent Test**: Can be fully tested by deploying a flow with an HTTP endpoint and verifying it appears as an available tool within 10 seconds.

**Acceptance Scenarios**:

1. **Given** a flow with an HTTP endpoint is deployed, **When** the flow deployment event is received, **Then** the system registers a new tool with a name derived from the flow label, a description, and parameter schema within 10 seconds.
2. **Given** a flow with the naming convention `mcp-<tool-name>` in its label is deployed, **When** the deployment event fires, **Then** the system registers a tool named `nodered:<tool-name>`.
3. **Given** a flow with `mcp: true` in its description metadata is deployed but has no HTTP endpoint, **When** the deployment event fires, **Then** the system logs a warning and skips registration (an HTTP endpoint is required for invocation even when `mcp: true` is set).
4. **Given** Node-RED has just started and existing flows are already deployed, **When** the bridge initializes, **Then** it scans all existing flows and registers any exposable flows as tools.

---

### User Story 2 - Bot Invokes a Flow-Based Tool (Priority: P1)

The bot can invoke any flow that has been registered as a tool, passing parameters and receiving structured results, just like any other tool in the system.

**Why this priority**: Discovery without invocation is useless. This completes the core loop of "flow becomes usable tool."

**Independent Test**: Can be tested by registering a mock flow tool and invoking it through the tool system, verifying the correct HTTP request is sent and the response is returned as a structured result.

**Acceptance Scenarios**:

1. **Given** a flow is registered as tool `nodered:check-sol-price`, **When** the bot invokes this tool, **Then** the system sends an HTTP request to the corresponding Node-RED endpoint and returns the response as a structured result.
2. **Given** a flow expects query parameters, **When** the bot invokes the tool with parameters, **Then** those parameters are correctly passed to the Node-RED endpoint.
3. **Given** a flow's HTTP endpoint returns an error (e.g., 500), **When** the bot invokes the tool, **Then** the system returns a structured error result describing the failure.
4. **Given** a flow's HTTP endpoint does not respond within a reasonable time, **When** the bot invokes the tool, **Then** the system returns a timeout error result.

---

### User Story 3 - Dynamic Tool Updates on Flow Changes (Priority: P2)

When flows are modified or deleted, the tool registry is updated in real time so the bot always has an accurate view of available tools.

**Why this priority**: Important for correctness but the system is still usable with stale tools in the short term. Enables a reliable dynamic environment.

**Independent Test**: Can be tested by modifying a registered flow's endpoint and verifying the tool definition updates, and by deleting a flow and verifying the tool is removed.

**Acceptance Scenarios**:

1. **Given** a registered flow is updated (e.g., its endpoint or parameters change), **When** the update event fires, **Then** the tool definition is updated to reflect the new configuration.
2. **Given** a registered flow is deleted, **When** the deletion event fires, **Then** the corresponding tool is removed from the registry and the bot no longer sees it.
3. **Given** a flow that was not exposable is modified to include an HTTP endpoint, **When** the update event fires, **Then** a new tool is registered for that flow.
4. **Given** a flow that was exposable is modified to remove its HTTP endpoint, **When** the update event fires, **Then** the corresponding tool is removed.

---

### User Story 4 - System Prompt Refresh on Tool Changes (Priority: P2)

When tools are added, updated, or removed, the system prompt is refreshed so the bot's next interaction reflects the current set of available tools.

**Why this priority**: Ensures the bot is aware of tool changes without requiring a restart or manual intervention.

**Independent Test**: Can be tested by adding a flow tool and verifying a prompt refresh event is emitted.

**Acceptance Scenarios**:

1. **Given** a new tool is registered, **When** registration completes, **Then** a prompt refresh event is emitted.
2. **Given** a tool is removed, **When** removal completes, **Then** a prompt refresh event is emitted.

---

### Edge Cases

- What happens when two flows have the same derived tool name? The system rejects the duplicate with a warning log and skips registration; flow authors must rename the conflicting flow (per FR-010).
- What happens when a flow has an HTTP endpoint but no declared `params` in metadata? The system uses the default schema `z.object({ input: z.string().optional() })`.
- What happens when a flow endpoint returns a streaming/chunked response? The bridge collects the full response body and returns it as a single `ToolResult`. Streaming is deferred (FR-011 removed from MVP).
- What happens when Node-RED is restarted while the bridge is running? On each `nodered:ready` event, the bridge performs a full teardown (unregisters all `nodered:*` tools) then re-scans. During steady-state operation, `flow:updated` events use diff-based reconciliation (add/remove only changed tools).
- What happens when a flow endpoint changes URL but keeps the same label? The tool definition MUST be updated with the new endpoint.

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Node-RED is unreachable when invoking a tool | "The Node-RED service is unavailable. The tool cannot be executed right now. It will become available once Node-RED is back online." | Automatic retry when Node-RED becomes available; tool stays registered |
| Flow endpoint returns HTTP error (4xx/5xx) | "The flow encountered an error ([status code]). Check the Node-RED debug panel for details." | Bot receives structured error and can decide how to proceed |
| Flow invocation times out | "The flow did not respond within 30 seconds. You can retry or check the Node-RED debug panel." | Bot receives timeout error; can retry or inform user |
| Flow produces unparseable response | "The flow returned an unexpected response format. The raw response has been included as text." | System returns raw response as text fallback |
| Tool name conflict during registration | Logged as warning; conflicting flow skipped | Administrator must rename the conflicting flow to resolve |
| McpBridgeService initialization failure | Logged as warning; bridge disabled, plugin continues without MCP tools | MUST NOT crash the application (per constitution §Error Handling) |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect flows eligible for tool exposure based on: (a) containing an HTTP-in node, (b) having `mcp: true` in description metadata, or (c) following the `mcp-<tool-name>` label naming convention. In all cases, an HTTP endpoint is required for invocation; flows matching (b) or (c) without an HTTP endpoint MUST be skipped with a warning log.
- **FR-002**: The system MUST automatically register eligible flows as tools when `flow:created` or `flow:updated` events are received.
- **FR-003**: The system MUST automatically unregister tools via `context.unregisterTool(id)` (requires adding `unregisterTool(id: string)` to `PluginContext` contract and `delete(id: string)` to `Registry<T>`) when a `flow:deleted` event fires or a flow is modified to no longer be eligible.
- **FR-004**: The system MUST derive tool names from flow labels using the pattern `nodered:<slugified-label>`. Slugification algorithm: lowercase, replace non-alphanumeric characters (except hyphens) with hyphens, collapse consecutive hyphens, trim leading/trailing hyphens. Allowed characters in result: `[a-z0-9-]`. Maximum tool name length (after `nodered:` prefix): 64 characters; names exceeding this MUST be truncated and a warning logged.
- **FR-005**: The system MUST generate tool parameter schemas from `FlowMetadata.params` (`Record<string, ParamDescriptor>` where `ParamDescriptor = { type: 'string' | 'number' | 'boolean'; description?: string; required?: boolean }`). The `params` field is optional in `FlowMetadata` (added as `params?: Record<string, ParamDescriptor>`); flows without declared params use a default schema `z.object({ input: z.string().optional() })`.
- **FR-006**: The system MUST invoke flow tools by sending HTTP requests to the corresponding Node-RED endpoint using the HTTP method declared on the flow's HTTP-in node (`method` field; defaults to GET if the method field is absent), and returning the response as a structured result.
- **FR-007**: The system MUST handle invocation errors (HTTP errors, timeouts, unparseable responses) and return structured error results. The default invocation timeout MUST be 30 seconds. Flows MAY override this via a `timeout` field in `FlowMetadata` (in milliseconds).
- **FR-008**: On each `nodered:ready` event (startup or restart), the system MUST perform a full teardown of all registered `nodered:*` flow tools, then re-scan all existing flows and register any eligible tools. During steady-state, `flow:updated` events use diff-based reconciliation (register new tools, unregister removed ones, upsert changed ones). A tool is considered "changed" when any of: its HTTP endpoint URL, HTTP method, parameter schema (`FlowMetadata.params`), or flow label differs from the currently registered definition.
- **FR-009**: The system MUST emit a prompt refresh event after any tool registration or unregistration.
- **FR-010**: The system MUST reject duplicate tool names with a warning log and skip registration of the conflicting flow; no auto-suffixing. Flow authors must rename the conflicting flow to resolve the conflict.
- **FR-012**: The new `unregisterTool(id)` method on `PluginRegistrationContext` and `delete(id)` method on `Registry<T>` MUST be documented with JSDoc comments describing their contract and behavior.
- **FR-011**: ~~Streaming responses~~ — **Deferred**. The bridge returns full HTTP responses as a single structured `ToolResult`. Streaming via async iterator is out of scope for MVP; the SDK's `ToolResult` type does not support it without breaking changes.

### Key Entities

- **Flow Tool Definition**: Represents a Node-RED flow exposed as a tool — includes tool name, description, parameter schema, target HTTP endpoint URL, and HTTP method.
- **Tool Invocation**: A request to execute a flow tool — includes tool name, parameters, and produces a structured result (success or error).
- **Flow Eligibility Criteria**: The set of rules that determine whether a flow should be exposed as a tool. An HTTP endpoint (HTTP-in node) is always required for invocation. Additionally, the flow must match at least one exposure signal: `mcp: true` metadata annotation, `mcp-<name>` label naming convention, or simply having an HTTP-in node (which is sufficient on its own per FR-001).
- **FlowMetadata.params**: A `Record<string, ParamDescriptor>` where `ParamDescriptor = { type: 'string' | 'number' | 'boolean'; description?: string; required?: boolean }`. Used to generate Zod schemas for tool definitions.

## Performance Requirements

| Metric | Target | Justification |
|--------|--------|---------------|
| Tool registration latency | < 10 seconds after flow deployment | User-facing metric from feature requirements |
| Tool invocation overhead | < 100ms added on top of flow execution time | Bridge overhead should be negligible since calls are localhost |
| Startup scan duration | < 5 seconds for up to 50 flows | System should be ready quickly after Node-RED starts. Measured from `nodered:ready` event to last `registerTool` call. Beyond 50 flows, linear degradation is acceptable; no hard failure. |

## Security Considerations

| Security Concern | Mitigation | Notes |
|------------------|------------|-------|
| Flow endpoint input validation | Parameters validated against tool schema before sending to Node-RED; HTTP responses validated as JSON or treated as text fallback | Prevents malformed requests; validates both inbound and outbound boundaries |
| Localhost-only communication | All HTTP calls to Node-RED use `http://localhost:<port>` with the port from configuration; URLs MUST NOT be constructed from flow data without validation | Enforced programmatically, not just assumed |
| Tool naming injection | Tool names are slugified per FR-004 algorithm (`[a-z0-9-]`, max 64 chars) | Prevents special characters in tool identifiers |
| Authentication model | No authentication required — Node-RED runs as a local child process with the same trust level as slashbot itself; no external network access | Consistent with bash/filesystem plugin trust model |
| Sensitive data | No sensitive data (API keys, tokens, passwords) flows through the bridge; tool parameters and responses contain only flow-level business data | Bridge is a pass-through for flow I/O only |

## Data & State

- **Data ownership**: System-managed; tool definitions are derived from flow state
- **Access control**: Tools are available to the bot; registration is system-only
- **Retention policy**: Tool definitions are ephemeral — rebuilt from flow state on each startup
- **Persistent data**: `FlowMetadata.params` is persisted in `~/.slashbot/nodered/flow-metadata.json` (existing file, extended with `params` field)
- **Concurrent modification**: Events are processed sequentially to avoid race conditions during registration/unregistration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A deployed flow with an HTTP endpoint is available as a tool within 10 seconds of deployment.
- **SC-002**: The bot can successfully invoke a flow-based tool and receive a correct structured result on the first attempt.
- **SC-003**: When a flow is deleted, its corresponding tool is no longer available to the bot within 10 seconds.
- **SC-004**: After a Node-RED restart, the bridge performs full teardown and re-scan on `nodered:ready`; all eligible tools are re-registered and available without manual intervention.
- **SC-005**: Tool invocation adds less than 100ms overhead beyond the flow's own execution time.

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [idea.md](../../ideas/002-nodered-plugin/idea.md)
- **Feature**: [03-mcp-bridge.md](../../ideas/002-nodered-plugin/features/03-mcp-bridge.md)

### Technical Constraints
- Node-RED runs as a Node.js child process, not in the Bun runtime
- Node-RED Admin API is REST on localhost (port 1880 default)
- Flows stored by Node-RED in `~/.slashbot/nodered/flows.json`
- Bridge needs mapping from flow → tool definition (name, description, Zod parameters)

### Implementation Guidance
- Bridge lives in `src/plugins/nodered/services/McpBridgeService.ts`; instantiated inside `createNodeRedPlugin()`, receiving captured `context` from `setup()` closure
- Subscribe to `flow:created`, `flow:updated`, `flow:deleted`, `nodered:ready` via `context.getService('core.eventbus')` — same DI pattern as `FlowManager`
- Use `GET http://localhost:1880/flow/:id` to analyze flow and extract endpoints
- Use `http://localhost:1880/<endpoint>` to invoke flows — HTTP method read from the HTTP-in node's `method` field (GET, POST, etc.)
- Convention for exposure: flow contains `http in` node, has `mcp: true` metadata, or follows `mcp-<tool-name>` label pattern
- Tool name: derived from flow label, slugified, prefixed `nodered:`
- `FlowMetadata.params` is `params?: Record<string, ParamDescriptor>` (optional); absent → fallback default: `z.object({ input: z.string().optional() })`
- Add `params?: Record<string, ParamDescriptor>` to `FlowMetadata` in `flow-types.ts` (also add to `FlowMetadataInput`)
- Scan existing flows on startup after `nodered:ready` event
- Use `context.registerTool()` / `context.unregisterTool(id)` (add `unregisterTool` to `PluginRegistrationContext` in `plugin-sdk/index.d.ts`); `Registry<T>` in core also needs a `delete(id)` method
- Dynamic flow tools use `nodered:` prefix; static management tools use `nodered.` prefix
- No streaming: return full HTTP response as single `ToolResult` (`output: JsonValue`)

### Discovery Decisions
- Security model: same trust level as slashbot (consistent with bash/filesystem access)
- No separate MCP server needed for MVP — direct ToolRegistry mapping is simpler and more performant
- Flows are exposed via native tool system, not a standalone MCP server protocol
