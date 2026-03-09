# Feature: Gateway API Extensions

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 01
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Extend the existing SlashbotGateway (`src/core/gateway/server.ts`) with HTTP routes and gateway methods for chat streaming, admin queries, and static file serving. The gateway already provides HTTP JSON-RPC, WebSocket event streaming, bearer token auth, and a pluggable route registry — this feature adds the specific routes needed by the web UI.

## User Value

**Who benefits**: Self-hosted operator
**What they gain**: Ability to interact with slashbot over HTTP from any web browser
**Success metric**: Can send a chat message via HTTP and receive a streaming response with tool call events

## Existing Infrastructure

The gateway (`src/core/gateway/server.ts`) already provides:
- HTTP server with JSON-RPC (`POST /rpc`)
- WebSocket with event subscription and RPC
- Bearer token authentication on all endpoints
- `HttpRouteRegistry` for custom HTTP routes
- `GatewayMethodRegistry` for RPC methods
- `publishEvent()` for broadcasting to WS subscribers
- `/health` endpoint

## Scope

### This Feature Includes
- Register HTTP routes via `HttpRouteRegistry` for:
  - `POST /api/chat` — streaming chat endpoint (SSE response using existing WS or SSE)
  - `GET /api/plugins` — list plugins and status
  - `GET /api/logs` — SSE streaming log endpoint
- Register gateway RPC methods for admin queries (plugin status, system info)
- Static file serving middleware for frontend assets
- Structured streaming format for chat that includes text deltas and tool call events

### This Feature Does NOT Include
- Node-RED specific endpoints (feature 05)
- Association graph endpoints (feature 06)
- Conversation persistence/history endpoints (feature 04)
- New auth mechanism (uses existing bearer token auth)

## Key Use Cases

### Use Case 1: Streaming Chat
**Actor**: Web frontend
**Goal**: Send a user message and receive streaming response
**Flow**:
1. Frontend POSTs to `/api/chat` with message and conversation context
2. Server processes through slashbot's LLM pipeline (Vercel AI SDK)
3. Server streams back structured events: `text-delta`, `tool-call-start`, `tool-call-result`, `done`
4. Frontend renders each event type appropriately

### Use Case 2: System Status
**Actor**: Web frontend
**Goal**: Get current system state
**Flow**:
1. Frontend GETs `/api/plugins`
2. Server returns plugin list with name, status, version
3. Frontend displays in dashboard

## Dependencies

### Requires
- None (foundational feature)

### Enables
- Feature 02 (chat-ui): provides the chat streaming API
- Feature 03 (admin-dashboard): provides the admin endpoints
- All future features depend on this API layer

## Technical Hints

### Required Tools & Versions

- **Vercel AI SDK**: existing integration — use `toDataStream()` or `toTextStreamResponse()` for SSE
- **Existing gateway**: `src/core/gateway/server.ts` — extend via `HttpRouteRegistry`

### Implementation Notes

- Implement as a slashbot plugin that registers routes via `HttpRouteRegistry` and methods via `GatewayMethodRegistry`
- Chat streaming: use SSE (Server-Sent Events) via the existing HTTP route handler — write to `ServerResponse` directly
- Leverage Vercel AI SDK's streaming format (`toDataStream()`) for structured tool call events
- Static files: register a catch-all route or middleware that serves from `frontend/public/`
- Auth: reuse existing bearer token mechanism — frontend stores token in localStorage

## Open Questions

- Should the chat endpoint go through the existing RPC mechanism or be a dedicated HTTP route? (HTTP route is better for SSE streaming)
- How to bridge between the agentic loop and the HTTP streaming response?

## Notes

This is primarily a plugin that **extends** the existing gateway — not a new server. The gateway architecture already supports everything needed.
