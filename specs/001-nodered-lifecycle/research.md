# Research: Node-RED Lifecycle Management

**Feature**: 001-nodered-lifecycle
**Date**: 2026-02-13

## Existing Codebase Analysis

### Reusable Components

| Component | Location | Reuse Decision | Rationale |
|-----------|----------|----------------|-----------|
| ProcessManager | `src/plugins/bash/services/ProcessManager.ts` | EXTEND | Manages child processes with spawn/kill/list. However, it uses `setsid -f` + fully detached processes, which is wrong for a managed child process that needs health monitoring. We need a **new** NodeRedProcessManager that spawns non-detached, monitors lifecycle events (exit, error), and manages graceful shutdown. ProcessManager's SIGTERM→SIGKILL escalation pattern will be replicated. |
| HeartbeatService | `src/plugins/heartbeat/services/HeartbeatService.ts` | REUSE pattern | Timer-based periodic task pattern (setInterval + tick). We'll follow the same pattern for health checks: configurable interval, guard against concurrent execution, start/stop lifecycle. |
| ConfigManager | `src/core/config/config.ts` | REUSE | Plugin-specific config file pattern (`~/.slashbot/nodered.json`). Follow HeartbeatService's `loadConfig()`/`saveConfig()` pattern with defaults + merge. |
| EventBus | `src/core/events/EventBus.ts` | REUSE | Plugin events via untyped overload. Emit `nodered:ready`, `nodered:stopped`, `nodered:error`, `nodered:failed` + trigger `prompt:redraw` for sidebar updates. |
| SidebarContribution | `src/plugins/types.ts` | REUSE | Dynamic label + boolean status pattern from spec. Use `getStatus()` returning `true` only when running. Label changes per FR-010. |
| Plugin scaffold | `src/plugins/types.ts` | REUSE | Standard Plugin interface with init, destroy, contributions. Follow canonical structure. |
| CommandRegistry | `src/core/commands/registry.ts` | REUSE | Register `/nodered` commands with subcommands. Follow HeartbeatPlugin's command pattern. |
| display service | `src/core/ui/display.ts` | REUSE | For tool indicators and status output. |
| HOME_SLASHBOT_DIR | `src/core/config/constants.ts` | REUSE | `~/.slashbot/` base path for config and logs. |
| TYPES registry | `src/core/di/types.ts` | EXTEND | Add `TYPES.NodeRedManager` symbol for DI registration. |

### Existing Patterns to Follow

| Pattern | Source | Application |
|---------|--------|-------------|
| Plugin-First Architecture | architecture-registry | New `NodeRedPlugin` implementing `Plugin` interface |
| Library-First Development | architecture-registry | `NodeRedManager` service class, plugin as thin wrapper |
| Service Self-Registration | HeartbeatPlugin | `context.container.bind(TYPES.NodeRedManager).toConstantValue(service)` in `init()` |
| Plugin-Specific Config Files | HeartbeatService | `~/.slashbot/nodered.json` for config, separate state tracking |
| Timer-Based Health Check | HeartbeatService | `setInterval` with configurable interval for periodic health probes |
| Graceful Shutdown Escalation | ProcessManager | SIGTERM → wait timeout → SIGKILL pattern |
| Event-Driven State Changes | HeartbeatService | Emit lifecycle events on state transitions |
| Dynamic Sidebar Label | spec FR-010 | New pattern: `label` changes dynamically (e.g., "NR: Running") |
| Non-Blocking Init | spec FR-015 | `init()` returns immediately, readiness detected async |
| Idempotent Commands | spec FR-016 | Return info messages without state change |

### Potential Conflicts

| Conflict | Description | Resolution |
|----------|-------------|------------|
| ProcessManager reuse | ProcessManager creates fully detached processes; Node-RED needs a managed child process with monitored lifecycle | Create new NodeRedManager service with `Bun.spawn()` instead of reusing ProcessManager |
| Port conflict | If another service uses port 1880 | FR-018: Probe port before spawn; adopt existing instance or report error |
| Shutdown ordering | Node-RED must stop before slashbot exits | Plugin `destroy()` handles graceful stop; kernel calls `destroyAll()` in reverse order |
| SidebarContribution label | Current API has static `label` field | Use getter pattern or dynamic label via closure (label reads current state) |

## Technical Decisions

### Decision 1: Child Process Management

- **Decision**: Create a new `NodeRedManager` service instead of reusing `ProcessManager`
- **Existing code considered**: `ProcessManager` in `src/plugins/bash/services/ProcessManager.ts`
- **Reuse approach**: NEW (with pattern replication)
- **Rationale**: ProcessManager uses `setsid -f` + `detached: true` for fire-and-forget background processes. Node-RED requires a managed child process with: (1) exit event handling for crash detection, (2) stdout/stderr capture to ring buffer + log file, (3) graceful shutdown with SIGTERM→SIGKILL escalation, (4) health check polling. The spawn semantics are fundamentally different.
- **Alternatives considered**: Wrapping ProcessManager with additional monitoring — rejected because ProcessManager's `spawn()` signature and detachment strategy would need breaking changes.

### Decision 2: Health Check Implementation

- **Decision**: Timer-based HTTP polling using `fetch()`, following HeartbeatService's `setInterval` + `tick()` pattern
- **Existing code considered**: HeartbeatService timer pattern, MCPPlugin connection management
- **Reuse approach**: REUSE pattern (from HeartbeatService)
- **Rationale**: HeartbeatService's tick pattern is proven: 60s base interval with elapsed-time checking. For Node-RED, we use a configurable interval (default 30s) with direct `fetch('http://localhost:{port}/')` probes. MCPPlugin's passive health check (no polling) is insufficient — we need active crash detection.
- **Alternatives considered**: MCPPlugin's connection-time-only checks — rejected because we need continuous monitoring for auto-restart (FR-005).

### Decision 3: Configuration Storage

- **Decision**: Plugin-specific config file at `~/.slashbot/nodered.json`
- **Existing code considered**: HeartbeatService config pattern, ConfigManager
- **Reuse approach**: REUSE pattern (from HeartbeatService)
- **Rationale**: Follow the established pattern of plugin-specific JSON files in HOME_SLASHBOT_DIR. Non-secret config (port, intervals, paths) stored in plain JSON. No secrets involved (Node-RED binds to localhost only).
- **Alternatives considered**: Using ConfigManager's central config.json — rejected because plugin-specific files are the established pattern for feature plugins.

### Decision 4: Node-RED Settings File Generation

- **Decision**: Generate `~/.slashbot/nodered/settings.js` from plugin config before each startup
- **Existing code considered**: No existing settings.js generation pattern
- **Reuse approach**: NEW
- **Rationale**: Node-RED requires a `settings.js` file configuring `httpAdminRoot`, `httpNodeRoot`, `userDir`, `flowFile`, `functionGlobalContext`, and `uiPort`. This must be generated dynamically from the plugin's JSON config to avoid users editing JavaScript directly.
- **Alternatives considered**: Shipping a static settings.js — rejected because port and paths need to be configurable per spec.

### Decision 5: Log Capture Strategy

- **Decision**: Dual output: persistent log file (`~/.slashbot/logs/nodered.log`) + in-memory ring buffer
- **Existing code considered**: ProcessManager's output buffer (last 100 lines per process)
- **Reuse approach**: EXTEND pattern (from ProcessManager)
- **Rationale**: FR-014 requires both persistent logs and quick in-memory access. ProcessManager already buffers last 100 lines — we replicate this as a ring buffer class and add file-based logging via `Bun.write()` append.
- **Alternatives considered**: File-only logging with `tail` reads — rejected for latency; memory-only — rejected for post-mortem debugging needs.

### Decision 6: State Machine for Node-RED Lifecycle

- **Decision**: Explicit 6-state machine: `disabled`, `unavailable`, `stopped`, `starting`, `running`, `failed`
- **Existing code considered**: MCPPlugin status types (connected/disabled/disconnected/failed/needs_auth)
- **Reuse approach**: NEW (inspired by MCP status types)
- **Rationale**: The spec defines 6 states (FR-010, Key Entities). An explicit state machine ensures valid transitions and prevents impossible states (e.g., starting health checks on a disabled instance).
- **Alternatives considered**: Simple boolean running/stopped — rejected because the spec requires 6 distinct states with different behaviors.

### Decision 7: Sidebar Dynamic Label

- **Decision**: Override `SidebarContribution.label` with a getter that returns the current state label
- **Existing code considered**: HeartbeatPlugin sidebar (static label "Heartbeat"), WalletPlugin sidebar (static label "Wallet")
- **Reuse approach**: EXTEND
- **Rationale**: FR-010 requires dynamic labels like "NR: Running", "NR: Stopped". The existing `SidebarContribution` interface has a `label: string` field. Since contributions are collected at startup but `getStatus()` is called dynamically, we can use a JavaScript getter or return a contribution whose `label` property is a getter that reads the current state. The kernel calls `getSidebarContributions()` and accesses `.label` on each redraw.
- **Alternatives considered**: Extending SidebarContribution interface — rejected per FR-010 ("No extension of the core SidebarContribution API is required"). Using `Object.defineProperty` to create a dynamic getter on the contribution object.

### Decision 8: Stale Process Adoption

- **Decision**: On startup, probe the configured port; if Node-RED responds, adopt the existing instance
- **Existing code considered**: No existing pattern for process adoption
- **Reuse approach**: NEW
- **Rationale**: FR-018 requires adopting stale Node-RED processes. If a previous slashbot instance crashed, the Node-RED child process may still be running. Rather than failing or spawning a duplicate, we probe the port and if responsive, skip spawn and begin health monitoring.
- **Alternatives considered**: Always killing any existing process — rejected because it would interrupt a potentially healthy Node-RED instance.

## Dependency Research

### Bun.spawn for Child Process Management

- **Finding**: Bun's `spawn()` API supports non-detached child processes with stdio piping
- **API**: `Bun.spawn(['node', 'red.js', '-s', 'settings.js'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })`
- **Key**: Returns a `Subprocess` with `.exited` (Promise), `.pid`, `.kill()`, `.stdout`, `.stderr`
- **Pattern**: Use `.exited.then()` for crash detection without blocking
- **Limitation**: `Bun.spawn` does not support `detached` mode like Node.js — which is actually what we want (managed child)

### Node-RED Startup Probing

- **Finding**: Node-RED serves its editor UI at `http://localhost:{port}/` when ready
- **Health Check**: `fetch('http://localhost:{port}/')` returns 200 when ready
- **Startup Time**: Typically 3-15 seconds depending on installed nodes
- **Pattern**: Poll every 500ms during startup, switch to configured interval (default 30s) once running

### Node-RED Settings.js Requirements

- **Finding**: Minimal required settings for our use case:
  ```javascript
  module.exports = {
    uiPort: 1880,
    userDir: '~/.slashbot/nodered',
    flowFile: 'flows.json',
    httpAdminRoot: '/',
    httpNodeRoot: '/api',
    httpStaticRoot: false,
    functionGlobalContext: {},
    editorTheme: { projects: { enabled: false } },
    logging: { console: { level: 'warn' } }
  };
  ```
- **Key**: `uiPort` controls both admin API and editor. `userDir` is where flows, credentials, and package.json live.
