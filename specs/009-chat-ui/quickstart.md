# Quickstart: Chat UI

**Branch**: `009-chat-ui` | **Date**: 2026-03-09

## Prerequisites

- slashbot running with gateway enabled (`--gateway` flag)
- Gateway auth token configured (`--gateway-token <token>`)
- 008-gateway-api feature implemented (webui plugin active)

## Development Setup

1. Create the frontend directory:
   ```bash
   mkdir -p frontend/public/css frontend/public/js
   ```

2. Start slashbot with gateway:
   ```bash
   bun run src/cli.ts --gateway --gateway-token mytoken
   ```

3. Open browser at `http://localhost:7680/`

4. Enter the gateway token when prompted

5. Start chatting — responses stream in real time with tool call visibility

## File Locations

| File | Purpose |
|------|---------|
| `frontend/public/index.html` | Main chat page (Alpine.js + Tailwind CSS) |
| `frontend/public/js/chat.js` | Chat component Alpine.js logic |
| `frontend/public/js/sse-client.js` | SSE stream consumer |
| `frontend/public/css/app.css` | Custom styles |

## Testing

Open browser dev tools to verify:
- SSE events flowing in Network tab
- Alpine.js state in devtools (`$store` or `x-data` inspection)
- Auth token in localStorage
