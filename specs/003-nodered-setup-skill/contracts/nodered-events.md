# Contract: Node-RED Events (Extended)

## New Event

### `nodered:setup-needed`

**Emitted when**: Plugin detects Node.js is available but Node-RED is not installed.

**Payload**: `Record<string, never>` (empty object)

**Consumers**:
- Plugin's own context provider (enriches LLM prompt with skill invocation instruction)
- Plugin's automation integration (fires one-shot job)

## Modified Behavior

### `nodered:error`

**Additional trigger**: Heartbeat detects crash → also triggers one-shot automation job for skill-based restart (up to 3 retries with exponential backoff).

## Existing Events (Unchanged)

- `nodered:ready` — Node-RED responding on port
- `nodered:stopped` — Intentional stop
- `nodered:failed` — All restart attempts exhausted
- `nodered:state` — State change notification
