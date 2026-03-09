# Implementation Plan: Gateway API Extensions

**Branch**: `008-gateway-api` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-gateway-api/spec.md`

## Summary

Extend the existing SlashbotGateway with HTTP endpoints for streaming chat (SSE), plugin status, log streaming, static file serving, and admin RPC methods. Implemented as a standard slashbot plugin (`webui`) that registers routes via `HttpRouteRegistry` and methods via `GatewayMethodRegistry`. The gateway server needs a minor extension to support static file fallback (prefix matching) and auth exemptions for static assets.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Bun 1.0+
**Primary Dependencies**: Vercel AI SDK (streaming), Zod v4 (validation), InversifyJS (DI)
**Storage**: N/A (stateless — sessions managed by existing SessionManager)
**Testing**: Vitest
**Target Platform**: Linux server (self-hosted)
**Project Type**: Single project (plugin within existing monolith)
**Performance Goals**: < 500ms time to first chat event, < 50ms static file serving, < 200ms log delivery
**Constraints**: No new dependencies; reuse existing gateway infrastructure

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Plugin-First Architecture | PASS | Implemented as webui plugin |
| Library-First Development | PASS | SSE helpers and static file server as standalone services |
| No feature logic in core | PASS (with caveat) | Static file fallback requires minor gateway extension — minimal, infrastructure-level |
| Type safety (no `any`) | PASS | All interfaces typed |
| Test-First (TDD) | PASS | Unit tests for each handler |
| Simplicity (YAGNI) | PASS | No unnecessary abstractions |
| Performance thresholds | PASS | Targets defined in spec |
| Security (input validation) | PASS | Chat request validated at boundary, path traversal prevention |

## Architecture Alignment

| Capability | Registry Pattern | Alignment | Notes |
|-----------|-----------------|-----------|-------|
| Plugin structure | Plugin-First (ADR-001) | ALIGNED | Standard `createWebuiPlugin()` factory |
| HTTP routes | Gateway Method Registration | ALIGNED | `registerHttpRoute()` for chat, plugins, logs |
| RPC methods | Gateway Method Registration | ALIGNED | `registerGatewayMethod()` for systemInfo |
| Session management | Session-Scoped Context | ALIGNED | Reuse `ConversationSession` with `'web'` source |
| Streaming | AgentLoopCallbacks | ALIGNED | Map callbacks to SSE events |
| Static file serving | N/A (new pattern) | NEW | New pattern: gateway static file fallback. To be registered post-merge. |

### New Patterns Introduced

| Pattern | Description | Registry Update Needed |
|---------|-------------|----------------------|
| Gateway Static File Fallback | Gateway checks static files directory for unmatched paths before 404 | Yes — add after implementation |
| SSE Streaming Handler | Writing SSE-formatted events to `ServerResponse` with proper headers | Yes — useful for future SSE endpoints |

### Source Idea Alignment

| Constraint (from idea) | Plan Status | Notes |
|------------------------|-------------|-------|
| Implement as plugin via HttpRouteRegistry | ALIGNED | webui plugin registers all routes |
| Chat streaming via SSE | ALIGNED | SSE over HTTP route |
| Leverage Vercel AI SDK toDataStream() | DIVERGENT | Using AgentLoopCallbacks instead — toDataStream() produces Vercel-specific format, callbacks give more control over custom SSE events |
| Static files from frontend/public/ | ALIGNED | Configurable directory, defaults to frontend/public/ |
| Reuse bearer token auth | ALIGNED | Existing auth mechanism |
| Gateway exact-match limitation | ADDRESSED | Static file fallback extends gateway |

**Divergence justification**: Using `AgentLoopCallbacks` instead of `toDataStream()` — the callbacks provide direct access to tool call lifecycle events (`onToolStart`, `onToolEnd`) which map cleanly to our custom SSE event format. `toDataStream()` produces Vercel AI SDK's specific data stream protocol which would require the frontend to use Vercel's client library.

## Project Structure

### Documentation (this feature)

```text
specs/008-gateway-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/plugins/webui/
├── index.ts              # Plugin factory + route/method registration
├── handlers/
│   ├── chat.ts           # POST /api/chat — SSE streaming handler
│   ├── plugins.ts        # GET /api/plugins — plugin status handler
│   ├── logs.ts           # GET /api/logs — SSE log streaming handler
│   └── static.ts         # Static file serving service
├── sse.ts                # SSE helper utilities (writeEvent, headers)
└── types.ts              # ChatRequest, StreamEvent types

src/core/gateway/
└── server.ts             # EXTEND: add static file fallback in handleHttp()

tests/
└── plugins/webui/
    ├── chat.test.ts
    ├── plugins.test.ts
    ├── logs.test.ts
    ├── static.test.ts
    └── sse.test.ts
```

**Structure Decision**: New plugin at `src/plugins/webui/` following established plugin pattern. Minimal gateway extension for static file fallback.

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:

- [x] Phase 0: Research complete (/specforge.plan command)
- [x] Phase 1: Design complete (/specforge.plan command)
- [x] Phase 2: Task planning complete (/specforge.plan command - describe approach only)
- [x] Phase 3: Tasks generated (/specforge.tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (static file fallback = new pattern, justified)

## Reuse Summary

| Category | Count | Details |
|----------|-------|---------|
| REUSE (as-is) | 7 | Gateway, HttpRouteRegistry, GatewayMethodRegistry, AgentLoopCallbacks, KernelLogger.subscribe, PluginDiagnostic, SessionManager |
| EXTEND | 1 | Gateway handleHttp() for static file fallback |
| NEW | 4 | webui plugin, SSE helpers, chat handler, static file service |

## Phase 2 Approach

Task planning will be organized in 3 phases:
1. **Foundation**: SSE utilities, types, gateway extension for static files
2. **Core Endpoints**: Chat streaming handler, plugins handler, logs handler, static handler
3. **Integration & Testing**: Plugin wiring, RPC method, tests, CORS headers
