# Feature Specification: Admin Dashboard

**Feature Branch**: `010-admin-dashboard`
**Created**: 2026-03-09
**Status**: Draft
**Source**: [Feature 03](../../ideas/005-web-ui/features/03-admin-dashboard.md)
**Parent Idea**: [idea.md](../../ideas/005-web-ui/idea.md)

## Clarifications

### Session 2026-03-09

- Q: What are the actual plugin status values from the API? → A: The `PluginDiagnostic` type uses `loaded`, `failed`, `disabled`, `skipped` — not "active/error/disabled". The dashboard maps these to user-facing labels: loaded→"Active", failed→"Error", disabled→"Disabled", skipped→"Skipped".
- Q: How should connector statuses be fetched for the health panel? → A: Via the existing `StatusIndicatorRegistry` which tracks connector/service status (`connected`, `disconnected`, `error`, etc.) and supports change subscriptions. A new API endpoint or RPC method exposes this data.
- Q: Should the dashboard be a separate page or a tab within the SPA? → A: Client-side tab switching within the same `index.html` SPA using Alpine.js reactive state. Both chat and dashboard views coexist in the DOM, toggled by a navigation component. This preserves chat state when switching.
- Q: Which API should provide health data — `/health` or RPC `webui.systemInfo`? → A: Use `webui.systemInfo` RPC for the dashboard health panel (provides uptime, plugin counts, connector count). Supplement with a new RPC method or endpoint that exposes `StatusIndicatorRegistry` data for per-connector status details.
- Q: How should log entry structured fields be displayed? → A: Structured fields (`LogEntry.fields`) are rendered as a compact inline key=value list after the message text, in a muted/secondary style. Fields are collapsed by default and expandable if more than 3 fields are present.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plugin Status Overview (Priority: P1)

The operator opens the admin dashboard and sees a table listing all loaded plugins with their current status. Each plugin row shows the plugin name, version, and a status badge (loaded, failed, disabled, or skipped). If a plugin has failed, the error reason is visible. The operator can quickly scan this table to confirm all plugins are functioning correctly.

**Why this priority**: Plugin visibility is the most fundamental admin capability — knowing what's loaded and whether it's working is the baseline for all system monitoring.

**Independent Test**: Can be fully tested by loading the dashboard page and verifying the plugin table displays all loaded plugins with accurate status badges.

**Acceptance Scenarios**:

1. **Given** slashbot is running with multiple plugins, **When** the operator opens the admin dashboard, **Then** a table displays all plugins with name, version, and status badge (green for loaded, red for failed, gray for disabled, yellow for skipped).
2. **Given** a plugin has failed initialization, **When** the operator views the plugin table, **Then** that plugin's row shows a red "Failed" badge and the failure reason is visible (inline or via expandable detail).
3. **Given** the operator has just opened the dashboard, **When** they view the plugin count summary, **Then** a summary shows total plugins, loaded count, and failed count.

---

### User Story 2 - Live Log Viewer (Priority: P1)

The operator navigates to the log section of the dashboard and sees real-time log entries streaming as slashbot processes events. Logs can be filtered by level (error, warn, info, debug). The log view auto-scrolls to show the latest entries, and the operator can pause auto-scroll to inspect older entries.

**Why this priority**: Live logs are essential for debugging issues in real time — without this, the operator must access the terminal to read logs, which defeats the purpose of the dashboard.

**Independent Test**: Can be tested by opening the log viewer and verifying that log entries appear in real time, with level filtering and auto-scroll behavior.

**Acceptance Scenarios**:

1. **Given** the operator opens the log viewer, **When** slashbot emits log entries, **Then** each entry appears in the log viewer in real time with timestamp, level, and message.
2. **Given** the log viewer is showing all levels, **When** the operator selects a specific level filter (e.g., "error"), **Then** only log entries matching that level are displayed.
3. **Given** new log entries are arriving, **When** the operator has not scrolled up, **Then** the view auto-scrolls to show the latest entry.
4. **Given** the operator has scrolled up to inspect older entries, **When** new entries arrive, **Then** auto-scroll is paused and a "scroll to bottom" indicator appears.
5. **Given** the operator clicks the "scroll to bottom" indicator, **When** the view scrolls down, **Then** auto-scroll resumes.
6. **Given** log entries include structured fields (e.g., plugin name, action type), **When** the operator views an entry, **Then** structured fields are visible alongside the message.

---

### User Story 3 - System Health Overview (Priority: P2)

The operator sees a health summary panel at the top of the dashboard showing key system metrics: uptime, memory usage, number of active plugins, and connection status for active connectors (Telegram, Discord) and Node-RED.

**Why this priority**: Health overview provides at-a-glance system status but is less actionable than plugin details or logs — it's a "nice to have" summary that rounds out the dashboard.

**Independent Test**: Can be tested by loading the dashboard and verifying the health panel shows accurate system metrics that update periodically.

**Acceptance Scenarios**:

1. **Given** the operator opens the dashboard, **When** the health panel loads, **Then** it displays system uptime in a human-readable format (e.g., "2d 4h 12m").
2. **Given** the system is running, **When** the health panel loads, **Then** it displays current memory usage (heap used / heap total).
3. **Given** connectors are configured, **When** the health panel loads, **Then** it shows each connector's connection status (connected/disconnected) with a status indicator.
4. **Given** Node-RED integration is active, **When** the health panel loads, **Then** it shows Node-RED connection status.
5. **Given** the dashboard is open, **When** 30 seconds have elapsed, **Then** the health metrics refresh automatically.

---

### User Story 4 - Dashboard Navigation (Priority: P2)

The operator can navigate between the chat view and the admin dashboard view using tab-style navigation within the same SPA. The current view is visually indicated. Navigation preserves the state of each view (chat conversation is not lost when switching to dashboard) since both views coexist in the DOM.

**Why this priority**: Navigation is required for the integrated web UI experience, but the dashboard can function standalone for initial testing.

**Independent Test**: Can be tested by switching between chat and dashboard pages and verifying navigation works and page state is preserved.

**Acceptance Scenarios**:

1. **Given** the operator is on the chat page, **When** they click the dashboard navigation item, **Then** the dashboard page loads with plugin table, log viewer, and health panel.
2. **Given** the operator is on the dashboard, **When** they click the chat navigation item, **Then** the chat page loads with any previous conversation preserved.
3. **Given** the operator is viewing the dashboard, **When** they look at the navigation, **Then** the dashboard item is visually highlighted as the current page.

---

### Edge Cases

- What happens when the log SSE connection drops? The viewer shows a "connection lost" indicator and attempts to reconnect automatically using SSE retry.
- What happens when there are no plugins with errors? The error count shows "0" and no error details are displayed — the dashboard presents a clean, healthy state.
- What happens when the system has been running for a very long time? Uptime displays correctly for extended periods (e.g., "45d 3h 12m").
- What happens when the operator switches between pages rapidly? Navigation is immediate; no duplicate SSE connections are created (previous connections are closed).
- What happens when hundreds of log entries arrive per second? The viewer buffers entries and renders in batches to maintain performance, with oldest entries being removed from the DOM after a maximum of 1000 visible entries.

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Log SSE connection lost | "Log stream disconnected. Reconnecting..." | Auto-reconnect via SSE retry; manual reconnect button if retries fail |
| Plugin status API fails | "Could not load plugin status. Retrying..." | Auto-retry once; show error state with manual retry button |
| System health API fails | "Health data unavailable." | Show stale data with "last updated" timestamp; retry on next refresh cycle |
| Authentication expired during dashboard use | "Session expired. Please re-authenticate." | Redirect to token input prompt |
| Network connectivity lost entirely | "No network connection. Data may be outdated." | Show cached/stale data; reconnect indicators for all live feeds |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a table of all plugins showing name, version, and status (loaded/failed/disabled/skipped) with corresponding visual badges (green/red/gray/yellow).
- **FR-002**: System MUST show failure reason for plugins in failed state — either inline in the table row or via an expandable detail section.
- **FR-003**: System MUST display a summary count of total, loaded, and failed plugins.
- **FR-004**: System MUST provide a live log viewer that streams log entries in real time via SSE from the gateway's log streaming endpoint.
- **FR-005**: System MUST allow filtering log entries by level (error, warn, info, debug) with the filter applied client-side to the incoming stream.
- **FR-006**: System MUST auto-scroll the log viewer to show the latest entry, unless the operator has scrolled up manually.
- **FR-007**: System MUST provide a "scroll to bottom" indicator when auto-scroll is paused, and resume auto-scroll when the operator scrolls to the bottom.
- **FR-008**: System MUST limit visible log entries in the DOM to a maximum of 1000 entries, removing the oldest entries as new ones arrive.
- **FR-009**: System MUST display a health overview panel showing system uptime, memory usage, active plugin count, and connector statuses.
- **FR-010**: System MUST refresh health metrics automatically at a regular interval (every 30 seconds).
- **FR-011**: System MUST display each log entry with timestamp, level (color-coded), and message text. Structured fields, if present, MUST be rendered as a compact inline key=value list in a secondary style, collapsed by default if more than 3 fields.
- **FR-012**: System MUST provide navigation between the dashboard and chat pages, with the current page visually indicated.
- **FR-013**: Navigation between pages MUST NOT destroy the state of the page being left (chat conversation preserved, log stream reconnects on return).
- **FR-014**: System MUST authenticate all API requests using the bearer token stored in localStorage, reusing the same auth mechanism as the chat UI.
- **FR-015**: System MUST handle authentication failures (401 responses) by redirecting to the token input prompt.
- **FR-016**: System MUST gracefully handle SSE disconnections for the log stream — display a reconnection indicator and attempt automatic reconnect.
- **FR-017**: System MUST apply color-coded level indicators to log entries: red for error, yellow/orange for warn, blue for info, gray for debug.

### Key Entities

- **Plugin Status Entry**: A snapshot of a plugin's lifecycle state — includes plugin ID, status (loaded/failed/disabled/skipped), and optional failure reason. Retrieved from the plugins API endpoint (`GET /api/plugins`).
- **Log Entry**: A single log event — includes timestamp, level (error/warn/info/debug), message text, and optional structured fields. Received via SSE from the log streaming endpoint.
- **System Health**: A snapshot of system metrics — includes uptime (seconds), loaded/failed plugin counts, active connector count, tool count, and command count. Retrieved from the `webui.systemInfo` RPC method. Connector-level statuses (connected/disconnected/error) retrieved from the status indicator registry.
- **Status Indicator**: A connector or service status entry — includes ID, label, kind (connector/service), and current status (connected/disconnected/busy/error/idle/running/off). Retrieved from a dedicated status indicators endpoint.

## Accessibility Requirements *(mandatory for UI features)*

| Requirement | Applies? | Acceptance Criteria |
|-------------|----------|---------------------|
| Keyboard navigation | Yes | Tab navigates between navigation items, plugin table rows, log filter buttons, and health cards; Enter/Space activates controls |
| Screen reader support | Yes | Plugin table uses proper `<table>` semantics; status badges have text alternatives; log entries announced via aria-live region; navigation landmarks defined |
| Color contrast | Yes | 4.5:1 for body text, 3:1 for status badges and log level indicators; status not conveyed by color alone (icon + text label) |
| Focus indicators | Yes | Visible focus ring on all interactive elements (nav items, filter buttons, retry buttons) |
| Reduced motion | Yes | Auto-scroll and any transition animations respect `prefers-reduced-motion` |
| Touch targets | N/A | Desktop-first; mobile is not primary target |

**Additional accessibility notes**: Status badges include both color and text label (e.g., "Loaded", "Failed", "Disabled", "Skipped"). Log level indicators use both color and level text.

## Performance Requirements *(include if performance-sensitive)*

| Metric | Target | Justification |
|--------|--------|---------------|
| Dashboard page initial load (LCP) | < 2s | Lightweight page with CDN assets, same as chat UI |
| Plugin status load time | < 500ms | Includes API round-trip; simple data retrieval |
| Log entry render latency | < 100ms from SSE event arrival | Real-time feel for log monitoring |
| Health metrics refresh | < 500ms per refresh cycle | Background refresh should not impact UI responsiveness |
| DOM performance with 1000 log entries | Smooth scrolling at 60fps | Log viewer must handle maximum visible entries without jank |

### Degradation Scenarios

- Under rapid log emission (>100 entries/second), the system SHOULD batch render entries to maintain UI responsiveness.
- If the health API is slow or unreachable, stale data is shown with a "last updated" indicator rather than blocking the dashboard.
- If the plugin list is very large (>50 plugins), the table SHOULD still render and be scrollable within 500ms.

## Security Considerations *(mandatory — handles auth and external input)*

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Authentication | Reuse existing bearer token auth from chat UI | Token in localStorage, sent as Authorization header on all API calls |
| XSS via log messages | Escape all log message text before rendering | Log entries rendered as text content, not innerHTML |
| XSS via plugin error messages | Escape error messages before display | Render as text content |
| Token exposure | Token not displayed in dashboard UI | Excluded from visible DOM |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The operator can see all plugins and their status (loaded/failed/disabled/skipped) on the dashboard within 2 seconds of page load.
- **SC-002**: Log entries appear in the live viewer within 200ms of being emitted by slashbot.
- **SC-003**: The operator can filter logs by level and only see matching entries.
- **SC-004**: System health metrics (uptime, memory, connector statuses) are visible and refresh automatically.
- **SC-005**: The operator can navigate between chat and dashboard without losing chat conversation state.

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [ideas/005-web-ui/idea.md](../../ideas/005-web-ui/idea.md)
- **Feature**: [ideas/005-web-ui/features/03-admin-dashboard.md](../../ideas/005-web-ui/features/03-admin-dashboard.md)

### Technical Constraints
- Must work with slashbot's existing InversifyJS DI architecture and plugin system
- Frontend must be lightweight (no React/Vue/Svelte build pipeline) — PenguinUI (Alpine.js + Tailwind CSS)
- Single developer, self-hosted only
- Desktop browser primary target
- Static HTML + Alpine.js served directly by the existing gateway server

### Implementation Guidance
- Use PenguinUI table components for plugin list display
- Log viewer: SSE stream from `/api/logs` endpoint (already defined in gateway-api spec, FR-004), rendered in a scrollable container
- Status badges: green (active), red (error), gray (disabled) — use PenguinUI badge components
- Dashboard and chat should share a common layout/navigation (tabs or sidebar)
- Reuse the same auth token mechanism as the chat UI (localStorage bearer token)
- System health data available via RPC method (gateway-api spec, FR-006 / User Story 5)
- Plugin status available via GET endpoint (gateway-api spec, FR-003 / User Story 2)
- Frontend architecture should follow the same Alpine.js patterns established in chat-ui (009)

### Discovery Decisions
- Read-only dashboard for MVP — no plugin enable/disable actions
- SSE for log streaming (same pattern as chat streaming)
- Shared navigation between chat and dashboard pages
- PenguinUI provides table, card, and badge components suitable for this layout
