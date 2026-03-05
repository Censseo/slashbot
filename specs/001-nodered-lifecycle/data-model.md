# Data Model: Node-RED Lifecycle Management

**Feature**: 001-nodered-lifecycle
**Date**: 2026-02-13

## Entities

### NodeRedState (NEW)

Represents the lifecycle state of the managed Node-RED instance. Implemented as a TypeScript enum/union type within `NodeRedManager`.

```typescript
type NodeRedState = 'disabled' | 'unavailable' | 'stopped' | 'starting' | 'running' | 'failed';
```

**State Transitions**:

```text
                 ┌──────────────────────────────────────────────┐
                 │                                              │
  [init]──► disabled ◄──────────────────────────────────────────┘
               │ (config.enabled=true)                          │
               ▼                                                │
         unavailable ◄── (no Node.js) ──────────────────────────┤
               │                                                │
               │ (Node.js found)                                │
               ▼                                                │
           stopped ◄── /nodered stop ── running                 │
               │                           ▲                    │
               │ /nodered start            │ (ready probe OK)   │
               │ or auto-start             │                    │
               ▼                           │                    │
           starting ───────────────────────┘                    │
               │                                                │
               │ (spawn failed / all retries exhausted)         │
               ▼                                                │
            failed ── /nodered start ──► starting               │
               │                                                │
               └── (config change) ─────────────────────────────┘
```

**Valid Transitions**:

| From | To | Trigger | Guard |
|------|----|---------|-------|
| disabled | stopped | Config `enabled` is `true` and Node.js found | `init()` |
| disabled | unavailable | Config `enabled` is `true` but Node.js not found | `init()` |
| unavailable | stopped | Node.js becomes available | `/nodered start` |
| stopped | starting | Auto-start on init, `/nodered start` | Node.js available |
| starting | running | Health probe returns 200 | Readiness poll |
| starting | failed | Spawn fails or readiness timeout exhausted | Max retries reached |
| running | stopped | `/nodered stop` (intentional) | Graceful shutdown |
| running | starting | Crash detected → auto-restart | Restart count < max |
| running | failed | Crash detected → all restarts exhausted | Restart count >= max |
| failed | starting | `/nodered start` (manual retry) | Always |
| stopped | starting | `/nodered restart` | Node.js available |
| running | starting | `/nodered restart` | After graceful stop |

**Invalid Transitions (MUST reject)**:

| From | To | Reason |
|------|----|--------|
| disabled | starting | Must be enabled first |
| stopped | running | Must go through starting |
| failed | running | Must go through starting |

---

### NodeRedConfig (NEW)

Persistent user configuration stored at `~/.slashbot/nodered.json`.

```typescript
interface NodeRedConfig {
  /** Whether Node-RED auto-starts with slashbot. Default: true */
  enabled: boolean;

  /** Port for Node-RED HTTP server (admin + editor + node endpoints). Default: 1880 */
  port: number;

  /** Path to Node-RED user directory. Default: ~/.slashbot/nodered */
  userDir: string;

  /** Health check interval in seconds. Default: 30 */
  healthCheckInterval: number;

  /** Graceful shutdown timeout in seconds. Default: 10 */
  shutdownTimeout: number;

  /** Maximum restart attempts after crash. Default: 3 */
  maxRestartAttempts: number;

  /** Whether to bind Node-RED to localhost only. Default: true */
  localhostOnly: boolean;
}
```

**Defaults**:

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

**Storage**: `~/.slashbot/nodered.json` (HOME_SLASHBOT_DIR)
**Access**: Read at startup, saved on config change via `/nodered` commands
**Schema Migration**: First version — no migration needed

---

### NodeRedRuntimeState (NEW)

In-memory runtime state tracked by `NodeRedManager`. Not persisted to disk (reconstructed on startup).

```typescript
interface NodeRedRuntimeState {
  /** Current lifecycle state */
  state: NodeRedState;

  /** PID of the Node-RED child process (null if not running) */
  pid: number | null;

  /** Bun Subprocess reference (null if not running) */
  process: Subprocess | null;

  /** Timestamp when Node-RED entered Running state */
  startedAt: Date | null;

  /** Number of restart attempts since last successful start */
  restartCount: number;

  /** Whether the current stop was intentional (suppresses auto-restart) */
  intentionalStop: boolean;

  /** In-memory ring buffer for recent log lines */
  logBuffer: RingBuffer;

  /** Handle for the health check interval timer */
  healthCheckTimer: Timer | null;

  /** Handle for the readiness poll timer (during starting state) */
  readinessPollTimer: Timer | null;
}
```

---

### RingBuffer (NEW)

Fixed-size circular buffer for in-memory log capture.

```typescript
class RingBuffer {
  constructor(capacity: number);  // Default: 200 lines

  /** Append a line to the buffer */
  push(line: string): void;

  /** Get the last N lines */
  tail(n?: number): string[];

  /** Get all lines in order */
  toArray(): string[];

  /** Clear the buffer */
  clear(): void;

  /** Current number of lines stored */
  readonly size: number;
}
```

**Storage**: In-memory only. Capacity default: 200 lines.
**Purpose**: Quick access for `/nodered status` without file I/O (FR-014).

---

### NodeRedSettingsJS (GENERATED)

Node-RED's `settings.js` configuration file, generated by the plugin before each startup.

```typescript
interface NodeRedSettingsJS {
  uiPort: number;
  userDir: string;
  flowFile: string;
  httpAdminRoot: string;
  httpNodeRoot: string;
  functionGlobalContext: Record<string, unknown>;
  logging: {
    console: { level: string };
  };
  editorTheme: {
    projects: { enabled: boolean };
  };
}
```

**Storage**: `{config.userDir}/settings.js` (generated, not user-editable)
**Generated from**: `NodeRedConfig` fields
**Regenerated**: Before every Node-RED startup

---

## Entity Relationships

```text
NodeRedConfig (persistent)
    │
    ├── generates ──► NodeRedSettingsJS (file, regenerated on start)
    │
    └── configures ──► NodeRedManager (service)
                           │
                           ├── manages ──► NodeRedRuntimeState (in-memory)
                           │                   │
                           │                   ├── contains ──► RingBuffer (log lines)
                           │                   └── references ──► Subprocess (Bun)
                           │
                           ├── emits ──► LifecycleEvents (EventBus)
                           │               ├── nodered:ready
                           │               ├── nodered:stopped
                           │               ├── nodered:error
                           │               └── nodered:failed
                           │
                           └── writes ──► Log File (~/.slashbot/logs/nodered.log)
```

## DI Tokens

### New Token (EXTEND existing TYPES)

```typescript
// Add to src/core/di/types.ts
NodeRedManager: Symbol.for('NodeRedManager')
```

## Events

### New Plugin Events (untyped, via EventBus)

| Event | Payload | Trigger |
|-------|---------|---------|
| `nodered:ready` | `{ port: number }` | Node-RED responds to health probe after starting |
| `nodered:stopped` | `{}` | Node-RED process exits (intentional or crash) |
| `nodered:error` | `{ error: string }` | Crash detected, before restart attempt |
| `nodered:failed` | `{ error: string }` | All restart attempts exhausted, or fatal error |

All state transitions also emit `prompt:redraw` (core typed event) to update sidebar.
