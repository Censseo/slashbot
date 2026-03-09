# Quickstart: Gateway API Extensions

**Branch**: `008-gateway-api` | **Date**: 2026-03-09

## Prerequisites

- Slashbot running with gateway enabled (`config.json` → `gateway.enabled: true`)
- Gateway auth token configured (`config.json` → `gateway.authToken`)
- Frontend assets in `frontend/public/` (for static serving)

## Test the API

### Chat Streaming
```bash
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, what can you do?"}' \
  http://localhost:3000/api/chat
```

### Plugin Status
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/plugins
```

### Log Streaming
```bash
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/logs
```

### System Info (RPC)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method":"webui.systemInfo","params":{}}' \
  http://localhost:3000/rpc
```

## Architecture

```text
Browser → GET /index.html → Static File Handler (no auth)
Browser → POST /api/chat → WebUI Plugin → AgentLoop → SSE Events
Browser → GET /api/plugins → WebUI Plugin → Kernel diagnostics
Browser → GET /api/logs → WebUI Plugin → KernelLogger.subscribe()
Browser → POST /rpc → Gateway → webui.systemInfo method
```
