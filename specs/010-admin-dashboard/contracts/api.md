# API Contracts: Admin Dashboard

## Existing Endpoints (REUSE)

### GET /api/plugins

Returns list of all plugin diagnostics.

**Auth**: Bearer token required

**Response**: `200 OK`
```json
[
  { "pluginId": "slashbot.webui", "status": "loaded" },
  { "pluginId": "slashbot.nodered", "status": "failed", "reason": "Not installed" },
  { "pluginId": "slashbot.bash", "status": "loaded" }
]
```

**Status values**: `loaded` | `failed` | `disabled` | `skipped`

### GET /api/logs

SSE stream of real-time log entries.

**Auth**: Bearer token required (query param `?token=` supported)

**Response**: `200 OK` (text/event-stream)
```
data: {"ts":"2026-03-09T12:00:00.000Z","level":"info","message":"Plugin loaded","fields":{"plugin":"slashbot.bash"}}

:keepalive

data: {"ts":"2026-03-09T12:00:01.000Z","level":"error","message":"Connection failed","fields":{"service":"nodered"}}
```

### RPC: webui.systemInfo

Returns system-wide metrics.

**Method**: `webui.systemInfo`

**Response**:
```json
{
  "version": "0.1.0",
  "uptime": 3672,
  "pluginsLoaded": 22,
  "pluginsFailed": 1,
  "connectorsActive": 2,
  "commandCount": 15,
  "toolCount": 8,
  "heapUsed": 52428800,
  "heapTotal": 104857600
}
```

## New Endpoints

### GET /api/status-indicators (NEW)

Returns list of all registered status indicators with current status.

**Auth**: Bearer token required

**Response**: `200 OK`
```json
[
  {
    "id": "connector.telegram",
    "label": "Telegram",
    "kind": "connector",
    "status": "connected"
  },
  {
    "id": "connector.discord",
    "label": "Discord",
    "kind": "connector",
    "status": "disconnected"
  },
  {
    "id": "service.nodered",
    "label": "Node-RED",
    "kind": "service",
    "status": "running"
  }
]
```

**Status values**: `connected` | `busy` | `disconnected` | `idle` | `running` | `error` | `off`

**Error**: `401 Unauthorized` | `500 Internal Server Error`

## RPC Call Format (for frontend reference)

```javascript
// Calling webui.systemInfo from frontend
const response = await fetch('/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    method: 'webui.systemInfo',
    params: null,
    requestId: crypto.randomUUID()
  })
});
const { result } = await response.json();
```
