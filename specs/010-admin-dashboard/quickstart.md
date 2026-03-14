# Quickstart: Admin Dashboard

## Prerequisites

- Slashbot running with gateway enabled (`config.gateway.enabled: true`)
- Gateway auth token configured
- Features 008 (gateway-api) and 009 (chat-ui) implemented

## Development Setup

```bash
# Start slashbot with gateway
bun run start --gateway

# Open browser to gateway URL (default: http://localhost:3000)
# Enter auth token when prompted
# Click "Dashboard" tab to view admin dashboard
```

## Architecture Overview

```
Browser (index.html)
├── Tab Navigation (Alpine.js state: currentPage)
├── Chat View (chat.js) — existing
└── Dashboard View (dashboard.js) — new
    ├── Health Panel → RPC webui.systemInfo + GET /api/status-indicators
    ├── Plugin Table → GET /api/plugins
    └── Log Viewer → GET /api/logs (SSE via EventSource)
```

## Key Files

### Backend (EXTEND existing)
- `src/plugins/webui/index.ts` — add status-indicators route registration
- `src/plugins/webui/handlers/status-indicators.ts` — NEW handler

### Frontend (NEW + MODIFY)
- `frontend/public/index.html` — add tab navigation, dashboard container
- `frontend/public/js/dashboard.js` — NEW Alpine.js dashboard component
- `frontend/public/js/sse-client.js` — add `connectLogStream()` helper
- `frontend/public/css/app.css` — add dashboard-specific styles

### Tests
- `tests/plugins/webui/handlers/status-indicators.test.ts` — endpoint tests
- `tests/frontend/dashboard.test.ts` — component logic tests (if applicable)

## Testing

```bash
# Run all tests
bun run test

# Run webui-specific tests
bun run test -- --grep webui
```
