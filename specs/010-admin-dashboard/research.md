# Research: Admin Dashboard

**Branch**: `010-admin-dashboard` | **Date**: 2026-03-09

## Existing Codebase Analysis

### Reusable Components

| Component | Location | Reuse Decision | Notes |
|-----------|----------|---------------|-------|
| WebUI Plugin | `src/plugins/webui/index.ts` | EXTEND | Add new route for status indicators |
| GET /api/plugins | `src/plugins/webui/handlers/plugins.ts` | REUSE | Already returns `PluginDiagnostic[]` |
| GET /api/logs | `src/plugins/webui/handlers/logs.ts` | REUSE | SSE log streaming already implemented |
| RPC webui.systemInfo | `src/plugins/webui/index.ts:31-55` | REUSE | Returns uptime, plugin counts, connector count |
| SSE utilities | `src/plugins/webui/sse.ts` | REUSE | `writeSSEEvent()`, keepalive, headers |
| SSE client | `frontend/public/js/sse-client.js` | EXTEND | Add `streamLogs()` function alongside `streamChat()` |
| Static file handler | `src/plugins/webui/handlers/static.ts` | REUSE | Serves new frontend files automatically |
| Auth mechanism | Bearer token in localStorage (`slashbot_token`) | REUSE | Same token for dashboard API calls |
| StatusIndicatorRegistry | `src/core/kernel/registries.ts` | REUSE | Existing registry for connector/service statuses |
| KernelLogger.subscribe() | `src/core/kernel/logger.ts` | REUSE | Already used by log handler |
| Alpine.js patterns | `frontend/public/js/chat.js` | REUSE | Follow same `x-data` component pattern |

### Existing Patterns to Follow

| Pattern | Example | Apply To |
|---------|---------|----------|
| Alpine.js component factory | `function chat() { return { ... } }` | `function dashboard() { return { ... } }` |
| SSE stream consumption | `streamChat()` in sse-client.js | Log stream consumption |
| Token auth on fetch | `Authorization: Bearer ${token}` | All dashboard API calls |
| CDN-based libraries | Alpine.js, Tailwind, marked via CDN | PenguinUI (if needed) |
| SPA tab switching | Not yet implemented (chat is only page) | NEW — add tab navigation to index.html |
| HTTP route registration | `context.registerHttpRoute({ method, path, ... })` | Status indicators endpoint |
| RPC method registration | `context.registerGatewayMethod({ id, ... })` | Alternative for status indicators |

### Potential Conflicts

| Area | Risk | Mitigation |
|------|------|------------|
| index.html structure | Dashboard adds tab navigation, modifying chat-only layout | Wrap chat in a container, add dashboard container, toggle via Alpine.js state |
| CSS conflicts | Dashboard styles may conflict with chat styles | Use scoped class prefixes or Tailwind utility classes |
| Multiple SSE connections | Dashboard logs SSE + chat SSE could run simultaneously | Close log SSE when navigating away from dashboard |

## Technical Decisions

### Decision 1: Navigation Architecture

- **Decision**: Client-side tab switching within single SPA (index.html)
- **Existing code considered**: Current index.html is chat-only with full-page layout
- **Reuse approach**: EXTEND — modify index.html to add tab navigation wrapping both views
- **Rationale**: Preserves chat state when switching; no page reload; simpler than multi-page

### Decision 2: Status Indicators API

- **Decision**: New GET /api/status-indicators endpoint returning StatusIndicatorRegistry data
- **Existing code considered**: `StatusIndicatorRegistry` already exists with `list()`, `getStatus()` methods
- **Reuse approach**: EXTEND — add new HTTP route handler in webui plugin
- **Rationale**: REST endpoint is simpler and cacheable; consistent with existing /api/plugins pattern

### Decision 3: Dashboard Component Architecture

- **Decision**: Single `dashboard.js` Alpine.js component following chat.js patterns
- **Existing code considered**: chat.js component pattern with init(), data properties, methods
- **Reuse approach**: REUSE pattern — new file following identical conventions
- **Rationale**: Consistency with existing frontend; Alpine.js handles reactive state well

### Decision 4: Log Stream Client

- **Decision**: Use native EventSource API for log streaming (not fetch-based like chat)
- **Existing code considered**: Chat uses fetch + ReadableStream (POST needed); logs use GET
- **Reuse approach**: NEW — EventSource is simpler for GET-based SSE with auto-reconnect
- **Rationale**: GET /api/logs is a GET endpoint; EventSource provides native auto-reconnect, which is exactly what the spec requires

### Decision 5: Health Data Fetching

- **Decision**: Use JSON-RPC call to `webui.systemInfo` for health panel data
- **Existing code considered**: `/health` endpoint exists but returns minimal data; `webui.systemInfo` returns full stats
- **Reuse approach**: REUSE — call existing RPC method from frontend
- **Rationale**: `webui.systemInfo` already returns uptime, plugin counts, connector count — exactly what health panel needs
