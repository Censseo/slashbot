# Implementation Plan: MCP Bridge

**Branch**: `004-mcp-bridge` | **Date**: 2026-02-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-mcp-bridge/spec.md`

## Summary

Automatically expose Node-RED flows as slashbot tools by creating a `McpBridgeService` inside the existing nodered plugin. The bridge listens to flow lifecycle events, detects eligible flows (HTTP endpoint + naming/metadata convention), generates Zod-schema tool definitions, and registers/unregisters them dynamically. Flow invocation is a localhost HTTP call. Core requires two small extensions: `Registry<T>.delete()` and `PluginRegistrationContext.unregisterTool()`.

## Technical Context

**Language/Version**: TypeScript (strict mode), Bun 1.0+
**Primary Dependencies**: InversifyJS (DI), Zod v4 (schemas), EventBus (core), native `fetch` (HTTP)
**Storage**: Ephemeral — tool definitions rebuilt from flow state on each startup; FlowMetadata extended with `params` (persisted in `~/.slashbot/nodered/flow-metadata.json`)
**Testing**: Vitest (`bun run test`)
**Target Platform**: Linux (same as slashbot)
**Project Type**: Single project — extends existing `src/plugins/nodered/`
**Performance Goals**: Tool registration < 10s after flow deploy; invocation overhead < 100ms; startup scan < 5s for 50 flows
**Constraints**: Localhost-only HTTP; no streaming (FR-011 deferred); sequential event processing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Accessibility | N/A | No TUI components; bridge is backend-only |
| Performance | PASS | Quantified targets in spec (10s registration, 100ms overhead, 5s scan) |
| Security | PASS | Localhost-only HTTP; input validated against Zod schema before sending; tool names slugified |
| Error Handling | PASS | 5 error scenarios with user messages and recovery actions defined in spec |
| Data & State | PASS | Tool definitions ephemeral; FlowMetadata.params stored in existing JSON file; no new sensitive data |
| Test-First (TDD) | PASS | Unit tests for McpBridgeService; integration tests for event-driven registration |
| Plugin-First | PASS | Extends existing nodered plugin; no core feature logic |
| Library-First | PASS | McpBridgeService is standalone testable class; plugin wires it |
| Simplicity (YAGNI) | PASS | No streaming, no MCP server protocol, no auto-suffixing; minimal changes to core |
| Compliance (MIT) | PASS | No new dependencies |
| Privacy | PASS | No user data transmitted externally |
| Quality Standards | PASS | TypeScript strict, Vitest coverage, Zod schemas |

**Initial Constitution Check: PASS**

## Architecture Alignment

### Patterns Applied

| Pattern | Source | Status |
|---------|--------|--------|
| Plugin-First Architecture | Registry ADR-001 | ALIGNED — extends existing nodered plugin |
| Library-First Development | Registry | ALIGNED — McpBridgeService is injectable, testable service |
| Contribution-Based Extension | Registry | ALIGNED — uses `registerTool` / `unregisterTool` |
| Typed Event Bus | Registry | ALIGNED — subscribes to existing typed events |
| AI SDK Tool Integration | Registry | ALIGNED — generates `ToolDefinition` with Zod schemas |
| Managed Child Process | Registry | REUSED — Node-RED managed by existing NodeRedManager |
| Dynamic Sidebar Label | Registry | N/A — no new sidebar items |

### New Patterns Introduced

| Pattern | Justification | Registry Update Needed |
|---------|---------------|----------------------|
| Dynamic Tool Lifecycle (register + unregister at runtime) | First feature needing runtime tool removal; `delete()` on Registry is minimal extension | YES — add to registry after implementation |
| Full Teardown + Re-scan Reconciliation | Node-RED restart recovery; no existing reconciliation pattern | YES |

### Divergences

None. All decisions align with established architecture.

## Project Structure

### Documentation (this feature)

```text
specs/004-mcp-bridge/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (by /specforge.tasks)
```

### Source Code (repository root)

```text
src/
├── core/kernel/
│   ├── registries.ts          # MODIFY: add delete() to Registry<T>
│   ├── contracts.ts           # MODIFY: add unregisterTool to PluginRegistrationContext
│   └── kernel.ts              # MODIFY: wire unregisterTool in createPluginRegistrationContext()
├── plugin-sdk/
│   └── index.d.ts             # MODIFY: add unregisterTool to PluginRegistrationContext
└── plugins/nodered/
    ├── index.ts               # MODIFY: instantiate McpBridgeService, pass context
    ├── flow-types.ts          # MODIFY: add ParamDescriptor type, params field to FlowMetadata
    └── services/
        └── McpBridgeService.ts  # NEW: core bridge logic

tests/
└── plugins/nodered/
    └── services/
        └── McpBridgeService.test.ts  # NEW: unit + integration tests
```

**Structure Decision**: Extends existing `src/plugins/nodered/` with one new service file. Three core files receive minimal additions (one method each). Follows established patterns.

## Complexity Tracking

No violations to justify. All changes are minimal extensions of existing patterns.

## Idea Alignment

### Source

- **Idea**: [idea.md](../../ideas/002-nodered-plugin/idea.md)
- **Feature**: [03-mcp-bridge.md](../../ideas/002-nodered-plugin/features/03-mcp-bridge.md)

### Alignment Report

| Constraint (from idea/feature) | Plan Status | Notes |
|-------------------------------|-------------|-------|
| Bridge in `src/plugins/nodered/services/McpBridgeService.ts` | ALIGNED | Exact location matches |
| Subscribe to `flow:created/updated/deleted`, `nodered:ready` via EventBus | ALIGNED | Same DI pattern as FlowManager |
| Use `GET /flow/:id` to analyze flow | ALIGNED | FlowParser already does this |
| Use `http://localhost:1880/<endpoint>` to invoke flows | ALIGNED | Native fetch with retry |
| Convention: `http in` node, `mcp: true` metadata, `mcp-<name>` label | ALIGNED | All three criteria in FR-001 |
| Tool name: slugified label, prefixed `nodered:` | ALIGNED | FR-004 |
| `FlowMetadata.params` as `Record<string, ParamDescriptor>` | ALIGNED | Extends flow-types.ts |
| Fallback schema `z.object({ input: z.string().optional() })` | ALIGNED | FR-005 |
| `context.registerTool()` / `context.unregisterTool(id)` | ALIGNED | Requires core extension |
| `nodered:` for dynamic, `nodered.` for static tools | ALIGNED | Existing convention |
| No streaming; full response as `ToolResult` | ALIGNED | FR-011 deferred |
| No separate MCP server; direct ToolRegistry mapping | ALIGNED | Discovery decision preserved |
| Scan existing flows on `nodered:ready` | ALIGNED | FR-008 full teardown + re-scan |

**All constraints ALIGNED. No divergences.**

## Reuse Summary

| Category | Count | Details |
|----------|-------|---------|
| Components REUSED as-is | 6 | ToolRegistry, FlowManager, FlowParser, EventBus, fetchWithRetry, ToolDefinition |
| Components EXTENDED | 4 | Registry<T> (+delete), PluginRegistrationContext (+unregisterTool), FlowMetadata (+params), createNodeRedPlugin (+bridge init) |
| NEW code | 2 | McpBridgeService.ts, McpBridgeService.test.ts |

## Phase 2 Approach (Task Planning)

Task generation will be handled by `/specforge.tasks`. The implementation will be structured as:

1. **Core extensions** — `Registry<T>.delete()`, `PluginRegistrationContext.unregisterTool`, kernel wiring
2. **Type extensions** — `ParamDescriptor`, `FlowMetadata.params`, `FlowMetadataInput.params`
3. **McpBridgeService** — eligibility detection, schema generation, tool registration/unregistration, invocation, reconciliation
4. **Plugin integration** — wire McpBridgeService into `createNodeRedPlugin()` setup
5. **Tests** — unit tests for each capability, integration tests for event-driven flows

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete (/specforge.plan command)
- [x] Phase 1: Design complete (/specforge.plan command)
- [ ] Phase 2: Task planning complete (/specforge.plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/specforge.tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none needed)
