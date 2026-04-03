# API Contracts: Chat UI

**Branch**: `009-chat-ui` | **Date**: 2026-03-09

## Consumed APIs (from 008-gateway-api)

This feature is a **frontend consumer** — it does not define new API endpoints. All APIs below are already implemented by the webui plugin.

### POST /api/chat (EXISTING — consumed)

See `specs/008-gateway-api/contracts/api.md` for full contract.

**Frontend usage**:
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ message, sessionId }),
});
// Read SSE stream via response.body.getReader()
```

**SSE Events consumed**:
- `text-delta` → append text to current assistant message
- `tool-call-start` → create tool call panel with running status
- `tool-call-result` → update tool call panel with result
- `done` → mark message complete, store sessionId
- `error` → display error, re-enable input

### Static File Serving (EXISTING — consumed)

Frontend files served from `frontend/public/` at root path. SPA fallback serves `index.html` for unmatched paths.

## Frontend File Structure

```text
frontend/public/
├── index.html          # Main SPA page (chat UI)
├── css/
│   └── app.css         # Custom styles (if needed beyond Tailwind)
└── js/
    ├── chat.js         # Alpine.js chat component logic
    └── sse-client.js   # SSE stream consumer utility
```

**CDN Dependencies** (no build step):
- Alpine.js 3.x
- Tailwind CSS (CDN or Play CDN)
- marked (Markdown renderer)
- highlight.js (code syntax highlighting)
