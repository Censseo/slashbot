# Web UI Specification

> Source of truth for web UI functionality: gateway API, chat interface, admin dashboard, conversation history, and memory dashboard.
> Last updated: 2026-04-03

## Overview

The Web UI provides a browser-based interface to slashbot, consisting of a gateway API layer, a streaming chat interface, an admin dashboard, and persistent conversation history — all served as a self-contained SPA using Alpine.js and Tailwind CSS (PenguinUI components).

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

### Conversation History

> Added: 2026-03-17 | Source: specs/011-conversation-history/

#### User Stories

- **Resume a Past Conversation** (P1): Operator opens the sidebar, sees past conversations with titles and dates, selects one, and the full message history loads — including tool call records — allowing them to continue where they left off.
- **Start a New Conversation** (P1): Operator clicks "New Conversation" to get an empty chat ready for input. First exchange persists the conversation and triggers title generation.
- **Auto-Generated Conversation Titles** (P2): Conversations receive a descriptive LLM-generated title (5-8 words) after the first assistant response, displayed in the sidebar via SSE update.
- **Conversation List with Metadata** (P2): Sidebar shows rich metadata — title, relative date ("just now", "5 minutes ago", "yesterday"), and a 100-char message preview — with progressive loading for 50+ conversations.
- **Conversation Deletion** (FR-011): Operator can delete a single conversation from the sidebar UI (with confirmation) or via the API.

#### Business Rules

- Each conversation stored as a JSONL file in `~/.slashbot/web-ui/conversations/` with a separate `index.json` for fast sidebar loading.
- Conversation IDs are UUID v4, matching the existing `sessionId` pattern.
- Messages stored as `RichMessage[]` from `AgentLoopResult.messages`, preserving full tool call chains (`AgentToolAction` with id, name, args, status, result).
- Chat handler uses ConversationStore instead of in-memory sessions Map; loads history from disk on resume.
- Title generation is fire-and-forget async using `KernelLlmAdapter` with `noTools: true`, `maxTokens: 30`, `maxSteps: 1`.
- Corrupted conversation files are silently skipped in the sidebar with a warning logged; other conversations unaffected.
- Last-write-wins for concurrent browser tabs; in-memory state preserved even if disk write fails.
- Conversations persist indefinitely until manually deleted by the operator.

#### API Contracts

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/conversations | List all conversations (metadata from index) |
| GET | /api/conversations/:id | Get full conversation with message history |
| DELETE | /api/conversations/:id | Delete a single conversation |

> See also: [Gateway API](#gateway-api) for POST /api/chat (now persists to ConversationStore)

#### Key Entities

- **Conversation**: Named sequence of exchanges — ID (UUID v4), title, creation date, last activity date, ordered messages.
- **ConversationMessage**: Single turn with role (user/assistant), content (text and/or tool call records), timestamp. Stored as RichMessage format.
- **Tool Call Record**: Tool invocation within an assistant message — tool ID, name, input parameters, execution status, result.
- **Conversation Index**: Lightweight summary (ID, title, last activity, preview) for fast sidebar loading without reading full JSONL files.

---

### Memory Dashboard

> Added: 2026-04-03 | Source: specs/012-memory-dashboard/

#### User Stories

- **Explore the Knowledge Graph** (P1): Operator opens the Graph tab to visualize concept relationships as an interactive force-directed graph (Cytoscape.js). Nodes color-coded by type (concept, tool, decision, person, project, domain). Hover highlights direct neighbors; click shows detail panel (label, type, metadata, edges). Filter controls for node types and relationship types. Graceful degradation when AssociationGraph service is unavailable.
- **Search Across All Memory** (P1): Unified search bar (always visible) queries both memory files (BM25) and graph nodes (substring match on labels). Results grouped by source. Clicking a memory result opens Explorer with that file; clicking a graph result focuses the Graph tab on that node.
- **Browse and Edit Memory Files** (P2): Explorer tab shows memory directory as a navigable file tree. Click file → markdown-rendered content. Inline editing saves by direct file replace (not via MemoryStore.upsert). Delete with confirmation. "Add Note" appends to today's daily note via appendToday().
- **Review Recent Activity on Timeline** (P2): Timeline tab shows daily notes in reverse chronological order, grouped by day, with timestamp, tags, and preview. Click entry to expand full content. "Load more" pagination for older entries.
- **Monitor Memory Statistics** (P3): Persistent stats bar at top of dashboard shows graph node/edge counts, node type distribution, memory file count, chunk count, last indexed timestamp, and 7-day activity trend. Refreshes on tab switch or every 30 seconds.

#### Business Rules

- Memory Dashboard is a new tab in the existing admin dashboard navigation (alongside Chat and Admin tabs).
- AssociationGraph is an optional runtime dependency — dashboard loads even if the service is absent; Graph tab shows degradation message, graph stats show "N/A".
- File listing and deletion are handled via direct filesystem operations (MemoryStore.listFiles() is private, no delete method); not routed through MemoryStore.
- Memory file editing replaces full file content directly; only "Add Note" uses appendToday() (append-style).
- Search debounced at 300ms minimum to avoid excessive API calls.
- Graph performance warning shown when node count exceeds 5,000; filters recommended.
- Path traversal prevention: all file read/write/delete endpoints MUST reject paths outside the configured memory directory.

#### API Contracts

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/memory/stats | Memory + graph stats (node/edge counts, file count, last indexed) |
| GET | /api/memory/search | Unified search across MemoryStore (BM25) and AssociationGraph |
| GET | /api/memory/files | List memory files as tree structure |
| GET | /api/memory/files/:path | Read a specific memory file |
| PUT | /api/memory/files/:path | Update (replace) a memory entry |
| DELETE | /api/memory/files/:path | Delete a memory entry |
| POST | /api/memory/notes | Quick note (appendToday) |
| GET | /api/memory/timeline | Recent daily notes (paginated) |
| GET | /api/memory/graph | Full graph data (nodes + edges) |
| GET | /api/memory/graph/neighbors/:id | Node neighbors (with depth param) |

> See also: [Memory spec](/docs/memory/spec.md) for AssociationGraph and MemoryStore internals.

#### Key Entities

- **Memory File**: A file within the memory directory. Has path, content (markdown), metadata (tags, timestamps).
- **Graph Node**: A concept in the association graph. ID, label, type (concept/tool/decision/person/project/domain), optional metadata, creation date.
- **Graph Edge**: Directed, weighted relationship between two nodes. Source, target, relationship type, weight (0.0-1.0), creation date.
- **Search Result**: Unified result from memory search or graph search — source type, display text, relevance, navigation target.
- **Timeline Entry**: A daily note entry with day grouping, timestamp, tags, preview, and full content.

---

## Cross-Cutting Concerns

### Authentication

All API endpoints (except static assets) use bearer token authentication. Token stored in `localStorage`. 401 responses redirect to token input prompt. Editor password hashed with `Bun.password.hash()` (bcrypt).

### Accessibility

- Keyboard navigation (Tab, Enter/Space) for all interactive elements
- Sidebar navigable with arrow keys, Enter to select, Escape to close
- ARIA landmarks, aria-live regions for log entries, status updates, and conversation loading states
- Proper table semantics for plugin list
- 4.5:1 contrast ratio for body text and conversation titles, 3:1 for badges and preview text
- Status conveyed by both color and text label
- Respects `prefers-reduced-motion` (sidebar slide animation)

### Performance

- Dashboard LCP < 2s (lightweight CDN assets)
- Log entry render latency < 100ms from SSE event
- DOM capped at 1000 log entries; oldest removed
- High-frequency logs batched for rendering
- Health refresh < 500ms per cycle (background, non-blocking)
- Sidebar load < 500ms for 100 conversations (index-based)
- Conversation load < 1s for 500 messages
- Message append < 100ms (non-blocking to chat streaming)
- Title generation < 3s (background, fire-and-forget)

### Technology Stack

- **Backend**: TypeScript (strict mode) on Bun 1.0+, InversifyJS DI, Vercel AI SDK (streaming + title generation), Zod v4
- **Frontend**: HTML/CSS/JavaScript ES2022+, Alpine.js 3.x (CDN), Tailwind CSS (CDN), PenguinUI components, marked + highlight.js (CDN)
- **Storage**: JSONL per-conversation files + JSON index in `~/.slashbot/web-ui/conversations/`
- **No build step**: Frontend served as static files
