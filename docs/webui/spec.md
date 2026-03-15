# Web UI Specification

> Source of truth for web UI functionality: gateway API, chat interface, and admin dashboard.
> Last updated: 2026-03-15

## Overview

The Web UI provides a browser-based interface to slashbot, consisting of a gateway API layer, a streaming chat interface, and an admin dashboard — all served as a self-contained SPA using Alpine.js and Tailwind CSS (PenguinUI components).

## Features

### Gateway API

> Added: 2026-03-15 | Source: specs/008-gateway-api/

#### User Stories

- **Streaming Chat via HTTP**: Web frontend sends a message and receives structured streaming events (text-delta, tool-call-start, tool-call-result, done) via SSE, powered by `AgentLoopCallbacks`.
- **Plugin Status Query**: GET endpoint returns all loaded plugins with name, status (loaded/failed/disabled/skipped), and version for admin dashboard consumption.
- **Live Log Streaming**: SSE endpoint streams `LogEntry` events (`{ ts, level, message, fields? }`) from `KernelLogger.subscribe()` in real time.
- **Static Frontend Asset Serving**: Gateway serves frontend static files (HTML/CSS/JS) with SPA fallback for client-side routing. Static assets are public (no auth required for login flow).
- **Admin RPC Methods**: `webui.systemInfo` RPC returns uptime, version, loaded plugin count, and active connector count.

#### Business Rules

- Each chat request spawns an independent agentic loop with its own session context.
- Chat sessions use `ConnectorSource` set to `'web'` and support optional `sessionId` for session reuse.
- Sessions managed in-memory with capacity limit; oldest evicted when full.
- SSE keepalive (`:keepalive`) sent every 15 seconds to prevent connection timeout.
- All API requests (except static assets) require bearer token authentication.

#### API Contracts

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/chat | Streaming chat with SSE events |
| GET | /api/plugins | Plugin list with diagnostics |
| GET | /api/logs | Live log streaming via SSE |
| POST | /api/rpc | JSON-RPC (webui.systemInfo, etc.) |
| GET | /* (fallback) | Static file serving / SPA fallback |

---

### Chat UI

> Added: 2026-03-15 | Source: specs/009-chat-ui/

#### User Stories

- **Streaming Chat Conversation**: Operator sends messages and receives progressive streaming responses rendered token-by-token. Markdown formatted on stream completion or during natural pauses.
- **Tool Call Visibility**: Tool calls appear as inline collapsible panels showing tool name, parameters, status (running/done/error), and result — interleaved with text in chronological order.
- **Chat Input & Interaction**: Enter sends, Shift+Enter for newlines, input disabled during streaming. Empty/whitespace messages blocked.
- **Thinking/Loading Indicator**: Appears within 100ms of sending; replaced by first streaming event.
- **Responsive Layout**: Desktop-first centered column layout; usable on tablet/mobile.

#### Business Rules

- Raw text displayed during streaming; Markdown rendered on completion or tool-call pauses.
- Auth token stored in localStorage; 401 responses redirect to token input prompt.
- Missing sessionId on server triggers new conversation gracefully.
- SSE comment lines (`:`) silently ignored per standard protocol.

#### Key Entities

- **Content Part**: Ordered element within an assistant message — either a text segment or a tool call panel.
- **Tool Call Panel**: Inline UI showing tool name, parameters, execution status, and result. Collapsible.

---

### Admin Dashboard

> Added: 2026-03-15 | Source: specs/010-admin-dashboard/

#### User Stories

- **Plugin Status Overview** (P1): Table listing all plugins with name, version, and status badges (green/loaded, red/failed, gray/disabled, yellow/skipped). Summary counts for total, loaded, and failed. Failure reasons visible for failed plugins.
- **Live Log Viewer** (P1): Real-time log streaming via SSE with level filtering (error/warn/info/debug), auto-scroll with pause-on-scroll-up, "scroll to bottom" indicator, and 1000-entry DOM cap. Structured fields rendered as compact inline key=value list, collapsed if >3 fields.
- **System Health Overview** (P2): Health panel showing uptime (human-readable), memory usage (heap used/total), plugin counts, and connector statuses via `StatusIndicatorRegistry`. Auto-refreshes every 30 seconds.
- **Dashboard Navigation** (P2): Tab-based navigation between chat and dashboard views within the SPA. Both views coexist in the DOM; state preserved when switching. Log SSE connects/disconnects on tab visibility.

#### Business Rules

- Plugin statuses mapped to user-facing labels: loaded→"Active", failed→"Error", disabled→"Disabled", skipped→"Skipped".
- Connector statuses fetched from `StatusIndicatorRegistry` (connected/disconnected/error/busy/idle/running/off).
- Health data from `webui.systemInfo` RPC supplemented by `GET /api/status-indicators`.
- Log entries color-coded by level: red/error, orange/warn, blue/info, gray/debug.
- SSE disconnections show "Reconnecting..." indicator with automatic reconnect.
- Auth failures (401) redirect to token input prompt.

#### API Contracts

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/status-indicators | Status indicator registry data (id, label, kind, status) |

> See also: [Gateway API](#gateway-api) for shared endpoints (/api/plugins, /api/logs, /api/rpc)

#### Key Entities

- **StatusIndicator**: `{ id, label, kind (connector/service), status }` — from StatusIndicatorRegistry.

---

## Cross-Cutting Concerns

### Authentication

All API endpoints (except static assets) use bearer token authentication. Token stored in `localStorage`. 401 responses redirect to token input prompt. Editor password hashed with `Bun.password.hash()` (bcrypt).

### Accessibility

- Keyboard navigation (Tab, Enter/Space) for all interactive elements
- ARIA landmarks, aria-live regions for log entries and status updates
- Proper table semantics for plugin list
- 4.5:1 contrast ratio for body text, 3:1 for badges
- Status conveyed by both color and text label
- Respects `prefers-reduced-motion`

### Performance

- Dashboard LCP < 2s (lightweight CDN assets)
- Log entry render latency < 100ms from SSE event
- DOM capped at 1000 log entries; oldest removed
- High-frequency logs batched for rendering
- Health refresh < 500ms per cycle (background, non-blocking)

### Technology Stack

- **Backend**: TypeScript (strict mode) on Bun 1.0+, InversifyJS DI, Vercel AI SDK (streaming), Zod v4
- **Frontend**: HTML/CSS/JavaScript ES2022+, Alpine.js 3.x (CDN), Tailwind CSS (CDN), PenguinUI components, marked + highlight.js (CDN)
- **No build step**: Frontend served as static files
