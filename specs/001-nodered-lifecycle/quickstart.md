# Quickstart: Node-RED Lifecycle Management

**Feature**: 001-nodered-lifecycle
**Branch**: `001-nodered-lifecycle`

## Prerequisites

- Bun 1.0+ installed (slashbot runtime)
- Node.js >= 18.x installed on host (`which node` must succeed)
- Node-RED >= 3.x installed locally: `cd ~/.slashbot/nodered && npm install node-red`

## What This Feature Does

Adds a `NodeRedPlugin` to slashbot that manages a Node-RED instance as a child process. It handles:

1. **Automatic startup** — Node-RED spawns when slashbot starts
2. **Health monitoring** — Periodic HTTP probes detect crashes
3. **Auto-restart** — Crashed processes restart with exponential backoff (up to 3 retries)
4. **Manual control** — `/nodered start|stop|restart|status` commands
5. **Graceful shutdown** — Node-RED stops cleanly when slashbot exits
6. **Sidebar status** — TUI shows "NR: Running", "NR: Stopped", etc.

## File Layout

```
src/plugins/nodered/
  index.ts                  # NodeRedPlugin class (thin wrapper)
  types.ts                  # NodeRedConfig, NodeRedState, NodeRedStatus
  commands.ts               # /nodered command handler
  prompt.ts                 # NODERED_PROMPT for LLM context
  services/
    NodeRedManager.ts       # Core service: process lifecycle, health checks, config
    RingBuffer.ts           # Fixed-size circular buffer for log lines
    settings.ts             # Generates Node-RED settings.js from config
```

## Configuration

**File**: `~/.slashbot/nodered.json`

```json
{
  "enabled": true,
  "port": 1880,
  "userDir": "~/.slashbot/nodered",
  "healthCheckInterval": 30,
  "shutdownTimeout": 10,
  "maxRestartAttempts": 3,
  "localhostOnly": true
}
```

Created automatically on first startup with these defaults.

## DI Registration

```typescript
// New token in src/core/di/types.ts
NodeRedManager: Symbol.for('NodeRedManager')

// Registered in plugin init()
context.container.bind(TYPES.NodeRedManager).toConstantValue(manager);
```

## Plugin Registration

Add to `src/plugins/loader.ts`:
```typescript
import { NodeRedPlugin } from './nodered';
// In loadBuiltinPlugins():
new NodeRedPlugin(),
```

## Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `nodered:ready` | Node-RED responds to health probe | `{ port }` |
| `nodered:stopped` | Process exits | `{}` |
| `nodered:error` | Crash detected, before restart | `{ error }` |
| `nodered:failed` | All restarts exhausted | `{ error }` |
| `prompt:redraw` | Any state change | (core event) |

## Testing Approach

```bash
# Run all Node-RED plugin tests
bun run test -- --testPathPattern=nodered

# Unit tests
bun run test -- src/plugins/nodered/services/RingBuffer.test.ts
bun run test -- src/plugins/nodered/services/NodeRedManager.test.ts

# Integration test (requires Node.js + Node-RED installed)
bun run test -- src/plugins/nodered/index.test.ts
```

### Key Test Scenarios

1. **State machine transitions** — Unit test all valid/invalid state transitions
2. **RingBuffer** — Unit test capacity, wrapping, tail operations
3. **Settings.js generation** — Unit test config → settings.js mapping
4. **Health check** — Mock fetch to simulate up/down scenarios
5. **Crash recovery** — Mock process exit to verify restart logic with backoff
6. **Idempotent commands** — Verify start-when-running and stop-when-stopped
7. **Stale process adoption** — Mock port probe to verify adopt-vs-spawn logic
8. **Graceful shutdown** — Verify SIGTERM → timeout → SIGKILL escalation
9. **Sidebar label** — Verify dynamic label updates per state

## Slash Commands

```
/nodered start       Start Node-RED (idempotent)
/nodered stop        Stop Node-RED gracefully (idempotent)
/nodered restart     Stop then start
/nodered status      Show state, PID, port, uptime, recent logs
/nodered config      Show current configuration
/nodered config <key> <value>   Update a config value
```

Alias: `/nr` (e.g., `/nr status`)
