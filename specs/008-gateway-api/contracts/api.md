# API Contracts: Gateway API Extensions

**Branch**: `008-gateway-api` | **Date**: 2026-03-09

## HTTP Endpoints

### POST /api/chat (NEW)

Streaming chat endpoint using Server-Sent Events.

**Auth**: Bearer token required
**Content-Type**: `application/json`
**Response Content-Type**: `text/event-stream`

**Request Body**:
```json
{
  "message": "string (required)",
  "sessionId": "string (optional, UUID)"
}
```

**Response**: SSE stream with events:
```
data: {"type":"text-delta","payload":{"text":"Hello"}}

data: {"type":"tool-call-start","payload":{"toolId":"tc_1","toolName":"bash","args":{"command":"ls"}}}

data: {"type":"tool-call-result","payload":{"toolId":"tc_1","toolName":"bash","result":"file1.txt","success":true}}

data: {"type":"done","payload":{"sessionId":"uuid-here"}}

```

**Error Responses**:
- `400`: Invalid request body (missing/empty message)
- `401`: Missing or invalid auth token
- `500`: Internal error (also emitted as SSE `error` event if stream started)

---

### GET /api/plugins (NEW)

Returns list of all plugins with their status.

**Auth**: Bearer token required
**Response Content-Type**: `application/json`

**Response Body**:
```json
[
  {
    "pluginId": "slashbot.core.ops",
    "status": "loaded",
    "reason": null
  },
  {
    "pluginId": "slashbot.nodered",
    "status": "failed",
    "reason": "Node-RED not installed"
  }
]
```

---

### GET /api/logs (NEW)

Real-time log streaming via Server-Sent Events.

**Auth**: Bearer token required
**Response Content-Type**: `text/event-stream`

**Response**: SSE stream of log entries:
```
data: {"ts":"2026-03-09T10:00:00.000Z","level":"info","message":"Gateway started","fields":{"host":"0.0.0.0","port":3000}}

data: {"ts":"2026-03-09T10:00:01.000Z","level":"debug","message":"Plugin loaded","fields":{"pluginId":"slashbot.bash"}}

```

**Notes**: Connection stays open. Client disconnection triggers server cleanup.

---

### Static File Serving (NEW)

Fallback handler for paths not matching API routes.

**Auth**: Not required (public access for login flow)
**Behavior**:
1. Check if path maps to a file in static assets directory
2. If file exists: serve with correct MIME type
3. If file doesn't exist and path doesn't start with `/api/` or `/rpc`: serve `index.html` (SPA fallback)
4. Otherwise: 404

---

## RPC Methods (via JSON-RPC at POST /rpc)

### webui.systemInfo (NEW)

**Request**:
```json
{
  "method": "webui.systemInfo",
  "params": {},
  "requestId": "optional-id"
}
```

**Response**:
```json
{
  "requestId": "...",
  "ok": true,
  "result": {
    "version": "0.1.0",
    "uptime": 3600,
    "pluginsLoaded": 22,
    "pluginsFailed": 2,
    "connectorsActive": 1,
    "commandCount": 15,
    "toolCount": 8
  }
}
```
