# Research: Gateway API Extensions

**Branch**: `008-gateway-api` | **Date**: 2026-03-09

## Existing Codebase Analysis

### Reusable Components

| Component | Location | Reuse Approach | Notes |
|-----------|----------|---------------|-------|
| SlashbotGateway | `src/core/gateway/server.ts` | EXTEND | HTTP server, WebSocket, bearer auth all exist. Need to add static file fallback to `handleHttp()` |
| HttpRouteRegistry | `src/core/kernel/registries.ts` | REUSE | Register `POST /api/chat`, `GET /api/plugins`, `GET /api/logs` |
| GatewayMethodRegistry | `src/core/kernel/registries.ts` | REUSE | Register `webui.systemInfo` RPC method |
| AgentLoopCallbacks | `src/core/agentic/agent-loop.ts` | REUSE | `onThoughts`, `onToolStart`, `onToolEnd`, `onDone` map directly to SSE events |
| KernelLogger.subscribe() | `src/core/kernel/logger.ts` | REUSE | Subscribe to log entries for SSE streaming |
| PluginDiagnostic | `src/core/kernel/contracts.ts` | REUSE | `{ pluginId, status, reason?, sourcePath? }` — exact data needed for plugins endpoint |
| SessionManager | `src/core/api/sessions.ts` | REUSE | Existing session management with `ConversationSession` |
| Bearer token auth | `src/core/gateway/server.ts` | REUSE | `parseAuthorizationToken()` + `isAuthorized()` already handle header and query param |
| Plugin pattern | `src/plugins/*/index.ts` | REUSE | Standard plugin setup with `registerHttpRoute`, `registerGatewayMethod` |
| PluginRegistrationContext | `src/core/kernel/contracts.ts` | REUSE | `registerHttpRoute()`, `registerGatewayMethod()`, `registerService()` |

### Existing Patterns to Follow

| Pattern | Example | Location |
|---------|---------|----------|
| HTTP route handler | Discord webhook handler | `src/plugins/discord/index.ts:519-532` |
| Gateway method handler | `core.health` method | `src/plugins/core-ops/index.ts` |
| Plugin factory function | `createCoreOpsPlugin()` | `src/plugins/core-ops/index.ts` |
| Event subscription cleanup | `eventBus.subscribe()` returning unsubscribe | `src/core/kernel/event-bus.ts` |

### Potential Conflicts

| Area | Issue | Resolution |
|------|-------|------------|
| Gateway route matching | Exact path only (`item.path === req.url`), no prefix matching | Extend `handleHttp()` with static file fallback after route check |
| Static file auth bypass | All routes except `/health` require auth | Add static file paths to auth exemption list in gateway |
| ConnectorSource `'web'` | Not in current union type | `ConnectorSource` is `string & {}` extensible — `'web'` works without type changes |

## Technical Decisions

### Decision 1: SSE for Chat Streaming

- **Decision**: Use Server-Sent Events (SSE) via HTTP route handler
- **Existing code considered**: WebSocket event streaming already exists in gateway
- **Reuse approach**: NEW (SSE is a different protocol from WS, but uses existing HTTP route handler)
- **Rationale**: SSE is simpler for one-directional streaming, auto-reconnects via EventSource API, works through proxies. WebSocket better for bidirectional but overkill for chat response streaming.
- **Alternatives considered**: WebSocket (already exists but adds complexity for this use case), Vercel AI SDK `toDataStream()` (would work but ties to specific SDK format)

### Decision 2: Plugin Architecture

- **Decision**: Implement as a standard slashbot plugin (`webui` plugin)
- **Existing code considered**: All 24 existing plugins follow same pattern
- **Reuse approach**: REUSE pattern
- **Rationale**: Follows Plugin-First Architecture (ADR-001). Plugin registers HTTP routes and gateway methods during setup.

### Decision 3: Static File Serving

- **Decision**: Extend gateway `handleHttp()` with a static file fallback
- **Existing code considered**: Gateway currently has exact-match routing only
- **Reuse approach**: EXTEND gateway server
- **Rationale**: Static files need prefix matching and auth exemption. Adding a registered static file handler via `HttpRouteRegistry` won't work because of exact-match routing. Instead, the webui plugin registers a service that the gateway calls as fallback.

### Decision 4: Log Streaming

- **Decision**: Use `KernelLogger.subscribe()` to tap log entries
- **Existing code considered**: `KernelLogger` already has subscriber support
- **Reuse approach**: REUSE
- **Rationale**: Direct subscription to logger — no new infrastructure needed.

### Decision 5: Agentic Loop Integration

- **Decision**: Use `AgentLoopCallbacks` to bridge agentic loop → SSE events
- **Existing code considered**: `runAgentLoop()` already accepts callback hooks
- **Reuse approach**: REUSE
- **Rationale**: Callbacks map directly to SSE event types: `onThoughts` → `text-delta`, `onToolStart` → `tool-call-start`, `onToolEnd` → `tool-call-result`, `onDone` → `done`.
