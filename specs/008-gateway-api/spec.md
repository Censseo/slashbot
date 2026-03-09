# Feature Specification: Gateway API Extensions

**Feature Branch**: `008-gateway-api`
**Created**: 2026-03-09
**Status**: Draft
**Source**: [Feature 01](../../ideas/005-web-ui/features/01-gateway-api.md)
**Parent Idea**: [idea.md](../../ideas/005-web-ui/idea.md)


## Clarifications

### Session 2026-03-09

- Q: How does the chat endpoint bridge to the agentic loop? → A: Via `AgentLoopCallbacks` — the handler invokes `runAgentLoop()` with callback hooks (`onThoughts` → `text-delta`, `onToolStart` → `tool-call-start`, `onToolEnd` → `tool-call-result`, `onDone` → `done`).
- Q: How does the web chat manage conversation sessions? → A: Each chat request includes an optional `sessionId`. If provided, the existing session is reused; if omitted, a new session is created. Sessions use the existing `ConversationSession` system with `ConnectorSource` set to `'web'`.
- Q: How does the gateway support static file serving given exact-path-only matching? → A: The gateway's HTTP handler must be extended with a fallback — after checking API routes, unmatched paths are checked against the static files directory before returning 404.
- Q: How are concurrent chat requests handled? → A: Each request spawns an independent agentic loop instance with its own session context. Concurrent requests are fully independent.
- Q: What log entry structure is streamed via SSE? → A: The existing `LogEntry` from `KernelLogger` — `{ ts, level, message, fields? }` — streamed as SSE `data` events via `KernelLogger.subscribe()`.
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Streaming Chat via HTTP (Priority: P1)

A web frontend sends a user message to slashbot and receives a streaming response that includes text content as it is generated, plus structured events for tool calls as they happen. The operator sees real-time output identical in richness to the TUI experience.

**Why this priority**: This is the core value proposition — without streaming chat, the web UI cannot function. All other features depend on this API being available.

**Independent Test**: Can be fully tested by sending an HTTP POST with a message payload and verifying that a streaming response arrives with structured events, delivering a complete conversational experience.

**Acceptance Scenarios**:

1. **Given** the gateway is running and authenticated, **When** a client sends a POST request to the chat endpoint with a message and valid auth token, **Then** the server responds with a streaming response containing `text-delta` events as the LLM generates text.
2. **Given** the LLM invokes a tool during response generation, **When** the tool begins execution, **Then** the stream emits a `tool-call-start` event with the tool name and parameters, followed by a `tool-call-result` event with the outcome.
3. **Given** the LLM has finished generating its response, **When** the response is complete, **Then** the stream emits a `done` event and the connection closes.
4. **Given** a client sends a chat request without a valid auth token, **When** the server receives the request, **Then** it responds with a 401 Unauthorized error without initiating any LLM processing.

---

### User Story 2 - Plugin Status Query (Priority: P2)

A web frontend queries the system to display what plugins are loaded, their current status, and version information. This powers the admin dashboard's plugin overview.

**Why this priority**: Plugin visibility is the simplest admin feature and provides immediate value for system monitoring.

**Independent Test**: Can be tested by sending a GET request to the plugins endpoint and verifying a JSON response listing all loaded plugins with name, status, and version.

**Acceptance Scenarios**:

1. **Given** slashbot is running with multiple plugins loaded, **When** a client sends an authenticated GET request to the plugins endpoint, **Then** the server responds with a JSON array listing each plugin's name, status (active/error/disabled), and version.
2. **Given** a plugin has encountered an initialization error, **When** the plugins endpoint is queried, **Then** that plugin appears with an error status and a human-readable error message.

---

### User Story 3 - Live Log Streaming (Priority: P2)

A web frontend connects to a log streaming endpoint and receives real-time log entries as they are produced by slashbot. This allows the operator to monitor system activity without accessing the terminal.

**Why this priority**: Live logs are essential for debugging and monitoring, complementing the plugin status view.

**Independent Test**: Can be tested by connecting to the log endpoint and verifying that log entries arrive in real-time as slashbot processes events.

**Acceptance Scenarios**:

1. **Given** the gateway is running, **When** a client connects to the log streaming endpoint with valid auth, **Then** the server responds with a streaming connection that emits log entries as they occur.
2. **Given** multiple log events are produced rapidly, **When** the client is connected, **Then** all events are delivered in order without loss.
3. **Given** a client disconnects from the log stream, **When** the server detects the disconnect, **Then** it stops sending events and cleans up resources for that client.

---

### User Story 4 - Static Frontend Asset Serving (Priority: P3)

The gateway serves the web frontend's static files (HTML, CSS, JavaScript) so that the operator can access the web UI by navigating to the gateway's address in a browser, without needing a separate web server.

**Why this priority**: Convenience feature — makes the web UI self-contained but is not strictly required (assets could be served separately during development).

**Independent Test**: Can be tested by requesting a known static file path and verifying the correct file is served with appropriate content type headers.

**Acceptance Scenarios**:

1. **Given** the gateway is running with static file serving enabled, **When** a client requests a path that matches a static file in the frontend assets directory, **Then** the server responds with the file content and correct MIME type.
2. **Given** a client requests a path that does not match any API route or static file, **When** the gateway processes the request, **Then** it serves the main HTML page (SPA fallback) to support client-side routing.
3. **Given** a client requests a static asset, **When** the request lacks a valid auth token, **Then** the server still serves the file (static assets are public to allow the login/auth flow).

---

### User Story 5 - Admin RPC Methods (Priority: P3)

Admin queries (system info, runtime configuration) are available as RPC methods through the existing gateway JSON-RPC mechanism, enabling the web frontend to query detailed system state.

**Why this priority**: Extends existing RPC infrastructure with additional methods; lower priority as basic admin needs are covered by the plugins endpoint.

**Independent Test**: Can be tested by sending RPC calls for system info and verifying structured responses.

**Acceptance Scenarios**:

1. **Given** the gateway is running, **When** a client sends an RPC call for system information, **Then** the server responds with uptime, version, loaded plugin count, and active connector count.

---

### Edge Cases

- What happens when the chat endpoint receives an empty message body? Server responds with HTTP 400 "Message body is required".
- How does the system handle a client that disconnects mid-stream during chat? Server detects disconnect, aborts the agentic loop via AbortController, cleans up resources.
- What happens when the LLM provider is unreachable during a chat request? Stream emits an `error` event with "AI service unavailable", then closes.
- How does static file serving behave when the frontend assets directory does not exist? Static file handler returns 404 for all asset requests; API routes remain functional.
- What happens when two clients send chat requests simultaneously? Each gets an independent agentic loop instance — no shared state.

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| LLM provider unreachable during chat | Stream emits an `error` event with "AI service unavailable" | Client displays error and offers retry button |
| Invalid or missing message in chat request | HTTP 400 with "Message body is required" | Client validates input before sending |
| Client disconnects during chat stream | Server detects disconnect, aborts LLM call, cleans up | No user action needed (server-side cleanup) |
| Plugin query fails internally | HTTP 500 with "Failed to retrieve plugin status" | Client shows error with retry option |
| Static file not found and no SPA fallback match | HTTP 404 with standard not found response | Client handles 404 gracefully |
| Log stream connection lost | SSE reconnection via standard EventSource retry | Client auto-reconnects using SSE protocol |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an HTTP endpoint that accepts a user message and returns a streaming response with structured events (text deltas, tool call events, completion event).
- **FR-002**: System MUST stream structured events that distinguish between text content (`text-delta`), tool invocation start (`tool-call-start`), tool results (`tool-call-result`), errors (`error`), and completion (`done`).
- **FR-003**: System MUST provide an HTTP endpoint that returns the list of loaded plugins with their name, status, and version.
- **FR-004**: System MUST provide an HTTP endpoint that streams log entries in real-time using Server-Sent Events.
- **FR-005**: System MUST serve static frontend files from a configurable directory, with SPA fallback for unmatched paths.
- **FR-006**: System MUST register admin RPC methods for querying system information (uptime, version, plugin count, connector count).
- **FR-007**: All API endpoints (except static assets) MUST require valid bearer token authentication, reusing the existing gateway auth mechanism.
- **FR-008**: System MUST abort LLM processing and clean up resources when a chat streaming client disconnects mid-response.
- **FR-009**: System MUST set appropriate CORS headers on API responses to allow browser-based access from the same origin.
- **FR-010**: The chat streaming endpoint MUST process the message through slashbot's existing LLM pipeline, preserving full tool call and agentic loop capabilities.
- **FR-011**: The chat endpoint MUST accept an optional session identifier to reuse an existing conversation session. If no session is provided, a new session MUST be created with `ConnectorSource` set to `'web'`.
- **FR-012**: Concurrent chat requests MUST each spawn an independent agentic loop instance. Concurrent requests MUST NOT share state or interfere with each other.

### Key Entities

- **Chat Request**: A user message with optional conversation context, sent to the chat endpoint for processing.
- **Stream Event**: A structured event emitted during chat streaming, typed by kind (text-delta, tool-call-start, tool-call-result, error, done) with type-specific payload.
- **Plugin Status**: A snapshot of a loaded plugin's current state including name, version, and operational status.

## Performance Requirements *(performance-sensitive)*

| Metric | Target | Justification |
|--------|--------|---------------|
| Time to first stream event (chat) | < 500ms | Includes LLM API round-trip; constitution's 200ms first-chunk target applies to the non-API portion (writing first SSE event after receiving first API chunk) |
| Non-API streaming overhead | < 200ms | Per constitution: time from receiving first API chunk to writing first SSE event to client |
| Static file response time (p95) | < 50ms | Static files should serve near-instantly |
| Plugin status endpoint (p95) | < 100ms | Simple data retrieval, no external calls |
| Log event delivery latency | < 200ms from emission | Real-time monitoring requires low latency |

### Degradation Scenarios

- Under high concurrent SSE connections (>50 simultaneous chat streams), the system SHOULD continue serving new requests but MAY increase time-to-first-event.
- If the frontend assets directory is missing, static file serving gracefully returns 404 without affecting API endpoint availability.
- Slow LLM responses do not block other concurrent chat sessions (independent agentic loops).

## Security Considerations *(mandatory — handles auth and external input)*

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Authentication | Reuse existing bearer token auth | All `/api/*` and `/rpc` endpoints require valid token; paths not matching API routes are treated as static asset requests and served without auth (enables login page loading) |
| Input validation | Validate chat request body at system boundary | Reject malformed or empty message payloads with 400 |
| Streaming resource exhaustion | Abort on client disconnect, enforce connection limits | Server-side cleanup when SSE/stream connections drop |
| Path traversal on static files | Resolve and validate paths within assets directory | Prevent escaping the configured static directory |
| CORS | Same-origin by default | Set appropriate headers; restrict to gateway origin |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A web client can send a chat message and receive a complete streaming response with visible text deltas and tool call events.
- **SC-002**: The plugins endpoint returns accurate status for all loaded plugins within 100ms.
- **SC-003**: Log streaming delivers events in real-time with less than 200ms latency from emission to client receipt.
- **SC-004**: Static files are served correctly with proper MIME types, and SPA fallback works for client-side routing.
- **SC-005**: All API endpoints correctly reject unauthenticated requests with 401 status.

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [ideas/005-web-ui/idea.md](../../ideas/005-web-ui/idea.md)
- **Feature**: [ideas/005-web-ui/features/01-gateway-api.md](../../ideas/005-web-ui/features/01-gateway-api.md)

### Technical Constraints
- Must work with slashbot's existing InversifyJS DI architecture and plugin system
- Frontend must be lightweight (no React/Vue/Svelte build pipeline) — PenguinUI (Alpine.js + Tailwind CSS)
- Single developer, self-hosted only
- Gateway (`src/core/gateway/server.ts`) already provides HTTP server, WebSocket, bearer token auth, `HttpRouteRegistry`, `GatewayMethodRegistry`, `publishEvent()`

### Implementation Guidance
- Implement as a slashbot plugin that registers routes via `HttpRouteRegistry` and methods via `GatewayMethodRegistry`
- Chat streaming: use SSE (Server-Sent Events) via HTTP route handler — write to `ServerResponse` directly
- Leverage Vercel AI SDK's `toDataStream()` for structured streaming with tool call events
- Static files: register a catch-all route or middleware that serves from `frontend/public/`
- Auth: reuse existing bearer token mechanism — frontend stores token in localStorage
- The existing `HttpRouteDefinition.handler` signature is `(req: IncomingMessage, res: ServerResponse, ctx: GatewayCallContext) => Promise<void>` — fully supports streaming responses
- Note: current route matching is exact path match (`item.path === req.url`); static file serving and SPA fallback may need pattern/prefix matching

### Discovery Decisions
- SSE chosen over WebSocket for chat streaming (simpler, HTTP-native, auto-reconnect via EventSource)
- HTTP route chosen over RPC for chat endpoint (better suited for streaming responses)
- Static files served from slashbot process (no separate frontend server)
