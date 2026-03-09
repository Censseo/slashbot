# Research: Chat UI

**Branch**: `009-chat-ui` | **Date**: 2026-03-09

## Existing Codebase Analysis

### Reusable Components

| Component | Location | Reuse Approach | Notes |
|-----------|----------|----------------|-------|
| WebUI Plugin (backend) | `src/plugins/webui/` | REUSE (as-is) | Fully implemented: POST /api/chat, GET /api/plugins, GET /api/logs, static file serving |
| SSE Event Types | `src/plugins/webui/types.ts` | REUSE (reference) | StreamEvent union: text-delta, tool-call-start, tool-call-result, done, error — frontend must match these exactly |
| SSE Helper | `src/plugins/webui/sse.ts` | REUSE (as-is) | Server-side SSE formatting; keepalive every 15s |
| Chat Handler | `src/plugins/webui/handlers/chat.ts` | REUSE (as-is) | Handles POST /api/chat, emits SSE events via AgentLoopCallbacks |
| Static File Handler | `src/plugins/webui/handlers/static.ts` | REUSE (as-is) | Serves from `frontend/public/` with SPA fallback |
| Gateway Auth | `src/core/gateway/server.ts` | REUSE (as-is) | Bearer token auth; static files exempt |
| WebSocket Monitor | `index.html` (root) | REFERENCE | Existing WS monitoring page — useful reference for event handling patterns |

### Existing Patterns to Follow

| Pattern | Source | Application |
|---------|--------|-------------|
| SSE event format | `src/plugins/webui/types.ts` | Frontend must parse `data: {"type":"...","payload":{...}}\n\n` |
| Bearer token auth | `src/core/gateway/server.ts` | `Authorization: Bearer <token>` header on all /api/* requests |
| Static file serving | `src/plugins/webui/handlers/static.ts` | Files in `frontend/public/` served at root path; SPA fallback to index.html |
| Session management | `src/plugins/webui/handlers/chat.ts` | `done` event returns `sessionId`; send it back in next request |

### Potential Conflicts

None — this is a pure frontend feature consuming existing backend APIs.

## Technical Decisions

### Decision 1: Frontend Framework

- **Decision**: PenguinUI (Alpine.js + Tailwind CSS) served as static HTML
- **Existing code considered**: Root `index.html` (vanilla JS WebSocket monitor)
- **Reuse approach**: NEW — no existing chat frontend exists
- **Rationale**: PenguinUI provides AI chatbot components as starting point; Alpine.js is lightweight with no build step; Tailwind via CDN
- **Alternatives considered**: React (too heavy, needs build), Vue (same), HTMX (less control over streaming)

### Decision 2: SSE Consumption Method

- **Decision**: `fetch()` with `ReadableStream` reader for POST-based SSE
- **Existing code considered**: Root `index.html` uses `WebSocket` — different protocol
- **Reuse approach**: NEW
- **Rationale**: POST /api/chat requires POST method; `EventSource` only supports GET. `fetch()` with `response.body.getReader()` allows POST + streaming
- **Alternatives considered**: EventSource (GET-only, can't send POST body)

### Decision 3: Markdown Rendering

- **Decision**: `marked` library via CDN for Markdown → HTML conversion
- **Existing code considered**: No existing Markdown renderer in frontend
- **Reuse approach**: NEW
- **Rationale**: Lightweight (~40KB), widely used, escapes HTML by default (XSS safe), no build step needed
- **Alternatives considered**: markdown-it (larger), showdown (larger), custom (too much work)

### Decision 4: Code Syntax Highlighting

- **Decision**: `highlight.js` via CDN for code block highlighting
- **Existing code considered**: None
- **Reuse approach**: NEW
- **Rationale**: Works with `marked` renderer hook; CDN-available; supports many languages
- **Alternatives considered**: Prism.js (similar quality, either works)

### Decision 5: Token Storage

- **Decision**: localStorage for bearer token persistence
- **Existing code considered**: Root `index.html` stores WS URL in localStorage — same pattern
- **Reuse approach**: REUSE (pattern)
- **Rationale**: Simple, sufficient for single-user self-hosted; survives page refresh

## API Contract Reference

The chat UI consumes the gateway API defined in `specs/008-gateway-api/contracts/api.md`:

- **POST /api/chat**: SSE stream with text-delta, tool-call-start, tool-call-result, done, error events
- **Request**: `{ message: string, sessionId?: string }` with `Authorization: Bearer <token>`
- **Static files**: Served from `frontend/public/` at root path; SPA fallback for client-side routing
