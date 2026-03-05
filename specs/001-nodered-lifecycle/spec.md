# Feature Specification: Node-RED Lifecycle Management

**Feature Branch**: `001-nodered-lifecycle`
**Created**: 2026-02-13
**Status**: Draft
**Source**: [Feature 01](../../ideas/002-nodered-plugin/features/01-nodered-lifecycle.md)
**Parent Idea**: [idea.md](../../ideas/002-nodered-plugin/idea.md)

## Clarifications

### Session 2026-02-13

- Q: How should the Node-RED 6-state sidebar display be implemented given the current SidebarContribution API only supports boolean (active/inactive)? → A: Dynamic label + boolean (no core API change). The sidebar contribution uses a dynamic label (e.g. "NR: Running", "NR: Stopped") and maps the boolean to green (running) or gray (all other states).
- Q: How should the plugin handle a stale Node-RED process still running on the port after a slashbot crash? → A: Detect & adopt. On startup, probe the configured port before spawning; if Node-RED is already responding, adopt the existing instance (track its state, skip spawn) and transition to Running state.
- Q: Where should Node-RED be installed/discovered? → A: Local in userDir. Node-RED is installed in `~/.slashbot/nodered/node_modules/node-red`, self-contained and isolated from system packages. Launch command: `node ~/.slashbot/nodered/node_modules/node-red/red.js -s settings.js`.
- Q: Where should Node-RED stdout/stderr output be captured? → A: Both persistent log file (`~/.slashbot/logs/nodered.log`) AND in-memory ring buffer. File provides post-mortem debugging; buffer provides quick access via `/nodered status`.
- Q: When admin runs `/nodered stop`, should the health check auto-restart still be active? → A: No. Manual stop disables auto-restart. Health monitoring pauses in "stopped" state. Auto-restart only triggers from running->crash transitions, not from intentional stops.
- Q: Should Node-RED startup block slashbot's plugin init, or be fully async? → A: Non-blocking. The plugin spawns Node-RED during init and polls readiness in the background. `init()` returns immediately (< 5s overhead). The sidebar displays "NR: Starting" during the readiness probe, then updates to "NR: Running" when `nodered:ready` fires. This aligns with FR-015 and the HeartbeatPlugin pattern.
- Q: How should the plugin handle an incompatible Node-RED version (< 3.x)? → A: Warn but proceed. Check the installed Node-RED version; if < 3.x, log a warning but attempt to start anyway. Let runtime failures surface naturally rather than hard-blocking.
- Q: What should happen for idempotent commands (start when running, stop when stopped)? → A: Idempotent with info message. `/nodered start` when already running returns "Node-RED is already running (port {port})". `/nodered stop` when already stopped returns "Node-RED is not running." No error, no state change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Node-RED Startup (Priority: P1)

When slashbot starts, I want Node-RED to automatically launch as a managed child process, so I can use Node-RED-based features without manual intervention.

The plugin initializes during slashbot startup, generates the necessary configuration, spawns the Node-RED process, waits for it to become ready, and reports its status. This is the foundation for all subsequent Node-RED features.

**Why this priority**: Without automatic startup, no other Node-RED feature can function. This is the absolute foundation.

**Independent Test**: Can be fully tested by starting slashbot and verifying that Node-RED becomes reachable on its configured port, delivering a running Node-RED instance.

**Acceptance Scenarios**:

1. **Given** slashbot is starting and Node-RED is configured as enabled, **When** the NodeRedPlugin initializes, **Then** a Node-RED child process is spawned, the sidebar displays "NR: Starting", and the plugin monitors readiness asynchronously (init returns immediately without blocking slashbot startup).
2. **Given** Node-RED has been spawned, **When** the Node-RED process reports readiness (responds to health probes), **Then** a `nodered:ready` event is emitted and the TUI sidebar displays "NR: Running".
3. **Given** slashbot is starting and Node-RED is configured as disabled, **When** the NodeRedPlugin initializes, **Then** no Node-RED process is spawned and the sidebar displays "NR: Disabled".
4. **Given** slashbot is starting, **When** the Node.js runtime is not found on the host machine, **Then** the plugin logs a clear error, emits `nodered:failed`, displays "NR: Unavailable" in the sidebar, and does not block slashbot startup.

---

### User Story 2 - Automatic Crash Recovery (Priority: P1)

When Node-RED crashes unexpectedly, I want the system to automatically detect the failure and attempt to restart Node-RED, so that service interruptions are minimized without manual intervention.

**Why this priority**: Without crash recovery, any transient failure would require manual restart, making the system unreliable for production use.

**Independent Test**: Can be fully tested by killing the Node-RED process and observing that the system detects the failure and restarts it.

**Acceptance Scenarios**:

1. **Given** Node-RED is running normally, **When** the Node-RED process crashes unexpectedly, **Then** the system detects the crash within one health check interval, logs the error, and emits `nodered:error`.
2. **Given** the system detected a Node-RED crash, **When** it attempts to restart, **Then** it retries up to 3 times with increasing delays between attempts (exponential backoff).
3. **Given** a restart attempt succeeds, **When** Node-RED becomes ready again, **Then** the system emits `nodered:ready` and updates the sidebar to "NR: Running".
4. **Given** all 3 restart attempts have failed, **When** the final attempt fails, **Then** the system emits `nodered:failed`, updates the sidebar to "NR: Failed", and alerts the administrator with a clear error message.

---

### User Story 3 - Manual Lifecycle Commands (Priority: P2)

As an administrator, I want to manually start, stop, restart, and check the status of Node-RED using slash commands, so I can control the Node-RED instance when needed.

**Why this priority**: Manual control provides essential operational flexibility but is less critical than automatic management.

**Independent Test**: Can be fully tested by running each slash command and verifying the expected state change occurs.

**Acceptance Scenarios**:

1. **Given** Node-RED is running, **When** the administrator runs `/nodered stop`, **Then** the system sends a graceful shutdown signal to Node-RED, waits up to 10 seconds for a clean exit, and updates the sidebar to "NR: Stopped".
2. **Given** Node-RED is stopped, **When** the administrator runs `/nodered start`, **Then** the system spawns a new Node-RED process and waits for it to become ready.
3. **Given** Node-RED is running, **When** the administrator runs `/nodered restart`, **Then** the system performs a graceful stop followed by a fresh start.
4. **Given** Node-RED is in any state, **When** the administrator runs `/nodered status`, **Then** the system reports the current state (running, stopped, starting, failed), uptime if running, and port number.
5. **Given** Node-RED is running and does not shut down within 10 seconds of a graceful stop request, **When** the timeout expires, **Then** the system forcibly terminates the process and logs that a forced termination was required.

---

### User Story 4 - Graceful Shutdown with Slashbot (Priority: P2)

When slashbot is shutting down, I want Node-RED to be gracefully stopped before slashbot exits, so that no data is lost and flows are properly saved.

**Why this priority**: Prevents data corruption and flow state loss during normal shutdowns.

**Independent Test**: Can be fully tested by shutting down slashbot and verifying that Node-RED is stopped cleanly before slashbot exits.

**Acceptance Scenarios**:

1. **Given** Node-RED is running, **When** slashbot begins its shutdown sequence, **Then** the plugin sends a graceful stop signal to Node-RED before completing its own shutdown.
2. **Given** Node-RED is in a failed state, **When** slashbot shuts down, **Then** the plugin cleans up any remaining process handles without blocking the shutdown.

---

### User Story 5 - Node-RED Configuration (Priority: P3)

As an administrator, I want to configure Node-RED settings (port, user directory, startup behavior) through a persistent configuration file, so I can customize the Node-RED instance to my environment.

**Why this priority**: Configuration is important but sensible defaults make this lower priority for initial use.

**Independent Test**: Can be fully tested by modifying the configuration file and restarting Node-RED to verify the new settings take effect.

**Acceptance Scenarios**:

1. **Given** no configuration file exists, **When** the plugin starts for the first time, **Then** it creates a default configuration with sensible defaults (port 1880, auto-start enabled, health check interval 30 seconds).
2. **Given** a custom port is configured, **When** Node-RED starts, **Then** it listens on the configured port.
3. **Given** the administrator changes a configuration value, **When** Node-RED is restarted, **Then** the new configuration takes effect.

---

### Edge Cases

- What happens when the configured port is already in use by another application? → **Resolved**: The plugin detects the port conflict during Node-RED spawn. It logs a clear error, emits `nodered:failed`, and displays "NR: Failed" in the sidebar. The user is instructed to change the port or free it.
- What happens when Node-RED is installed but an incompatible version is detected? → **Resolved**: The plugin checks the Node-RED version on startup. If < 3.x, it logs a warning but proceeds with startup. Runtime failures surface naturally.
- What happens when the user directory path does not exist or has insufficient permissions? → **Resolved**: If the directory does not exist, the plugin creates it on first startup (FR-012). If permissions are insufficient, the plugin logs an error, emits `nodered:failed`, and displays a user message instructing them to fix directory permissions.
- What happens if two slashbot instances try to start Node-RED on the same port? → **Resolved**: The second instance's startup port probe (FR-018) detects an existing Node-RED process on the configured port. It adopts the existing instance and begins health monitoring. Only one slashbot instance should actively manage Node-RED; operators running multiple instances should configure different ports.
- What happens when a manual start command is issued while Node-RED is already running? → **Resolved**: Idempotent. Returns info message "Node-RED is already running (port {port})". No error, no state change.
- What happens when a stop command is issued while Node-RED is already stopped? → **Resolved**: Idempotent. Returns info message "Node-RED is not running." No error, no state change.
- What happens when the disk is full and Node-RED cannot write its flow file? → **Resolved**: Node-RED handles its own persistence failures internally. If disk issues cause Node-RED to become unresponsive, the standard health check failure and auto-restart flow applies. If restarts also fail due to disk, the plugin transitions to Failed state with user message directing them to free disk space.
- What happens when slashbot crashed and a stale Node-RED process is still running on the port? → **Resolved**: The plugin probes the configured port on startup before spawning. If Node-RED is already responding, it adopts the existing instance (skips spawn, tracks state) and transitions to Running.

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Node.js runtime not found on host | "Node-RED requires Node.js (>= 18.x) which was not found. Install Node.js to enable Node-RED features." | Install Node.js, then restart slashbot or run `/nodered start` |
| Node-RED package not available | Auto-installs via `npm install node-red`. If installation fails: "Failed to install Node-RED. Check npm and network connectivity." | Automatic; if fails, check npm availability and network *(Updated 2026-02-15)* |
| Configured port already in use | "Port {port} is already in use. Node-RED cannot start. Change the port in configuration or free the port." | Change port in config, or stop the conflicting process |
| Node-RED process fails to become ready within timeout | "Node-RED started but did not become responsive within the expected time. Check logs for details." | Review Node-RED logs, run `/nodered restart` |
| All restart attempts exhausted after crash | "Node-RED has crashed and could not be restarted after 3 attempts. Manual intervention required." | Check logs for root cause, fix the issue, run `/nodered start` |
| Insufficient permissions on user directory | "Cannot access the Node-RED user directory. Check file permissions." | Fix directory permissions |
| Health check detects Node-RED is unresponsive | "Node-RED is not responding. Attempting automatic restart..." | Automatic restart; if persistent, check Node-RED logs |
| Incompatible Node-RED version detected (< 3.x) | "Node-RED version {version} detected. Version >= 3.x is recommended. Proceeding with startup, but some features may not work correctly." | Upgrade Node-RED to >= 3.x |
| Disk full — Node-RED cannot write flow file | "Node-RED may be unable to save flows due to insufficient disk space. Free disk space and restart Node-RED." | Free disk space, run `/nodered restart` |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST spawn Node-RED as a managed child process when slashbot starts (if configured as enabled). The spawn and readiness monitoring MUST be non-blocking; `init()` returns immediately and readiness is detected asynchronously via background polling.
- **FR-002**: The system MUST detect Node-RED readiness by making an HTTP GET request to `http://localhost:{port}/` after spawning. A 200 status code indicates readiness; any other status code, connection refusal, or timeout is treated as not-yet-ready and the probe retries on the next poll interval.
- **FR-003**: The system MUST generate a Node-RED settings file from its own configuration before each startup.
- **FR-004**: The system MUST perform periodic health checks on the running Node-RED instance at a configurable interval (default: 30 seconds). Health check failure is defined as: unexpected HTTP status codes, connection refusal, or request timeout (see Security Considerations for validation requirements).
- **FR-005**: The system MUST automatically attempt to restart Node-RED when a crash is detected (transition from running to unexpected exit), with up to 3 retries using exponential backoff. Auto-restart MUST NOT trigger when Node-RED is in "stopped" state (i.e., after an intentional `/nodered stop`). Health monitoring pauses in stopped state and resumes only on the next `/nodered start`.
- **FR-006**: The system MUST emit lifecycle events: `nodered:ready`, `nodered:stopped`, `nodered:error`, `nodered:failed`.
- **FR-007**: The system MUST provide slash commands: `/nodered start`, `/nodered stop`, `/nodered restart`, `/nodered status`.
- **FR-008**: The system MUST gracefully stop Node-RED (with a configurable timeout, default: 10 seconds) before forcibly terminating it.
- **FR-009**: The system MUST stop Node-RED as part of slashbot's shutdown sequence.
- **FR-010**: The system MUST display Node-RED status in the TUI sidebar using a dynamic label via the existing `SidebarContribution` API. Labels use the abbreviated "NR:" prefix: "NR: Running", "NR: Stopped", "NR: Starting", "NR: Failed", "NR: Disabled", "NR: Unavailable". The boolean `getStatus()` returns `true` only when Node-RED is in Running state (green indicator); all other states return `false` (gray indicator). The label text conveys the specific state. No extension of the core SidebarContribution API is required.
- **FR-011**: The system MUST persist configuration in a dedicated configuration file within the slashbot configuration directory.
- **FR-012**: The system MUST create the Node-RED user directory on first startup if it does not exist.
- **FR-013**: The system MUST verify that the Node.js runtime is available before attempting to spawn Node-RED.
- **FR-014**: The system MUST capture Node-RED stdout and stderr output and redirect them to both a persistent log file (`~/.slashbot/logs/nodered.log`) and an in-memory ring buffer. The log file provides post-mortem debugging; the ring buffer provides quick access for `/nodered status` queries without file I/O.
- **FR-015**: The system MUST NOT block slashbot startup if Node-RED fails to start or Node.js is unavailable.
- **FR-016**: The system MUST handle idempotent commands gracefully: `/nodered start` when already running returns an informational message "Node-RED is already running (port {port})" without error; `/nodered stop` when already stopped returns "Node-RED is not running." without error. No state change occurs in either case.
- **FR-017**: The system SHOULD report uptime and port information when status is queried.
- **FR-018**: The system MUST probe the configured port on startup before spawning. If a Node-RED instance is already responding on that port, the plugin MUST adopt the existing instance (skip spawn, begin health monitoring) and transition to Running state.
- **FR-019**: The system MUST auto-install Node-RED via `npm install node-red` in the userDir if Node-RED is not found during initialization. If installation fails, the system MUST transition to Failed state and emit `nodered:failed` with a clear error message. *(Added 2026-02-15)*

### Key Entities

- **NodeRedInstance**: Represents the managed Node-RED child process. Key attributes: process state (running, stopped, starting, failed, disabled, unavailable), port number, process ID, uptime, restart count.
- **NodeRedConfiguration**: Persistent settings for the Node-RED instance. Key attributes: port (default 1880), auto-start flag, health check interval, graceful shutdown timeout, user directory path, maximum restart attempts.
- **LifecycleEvent**: Events emitted during Node-RED state transitions. Types: `nodered:ready`, `nodered:stopped`, `nodered:error`, `nodered:failed`.

## Accessibility Requirements *(mandatory for UI features)*

| Requirement | Applies? | Acceptance Criteria |
|-------------|----------|---------------------|
| Keyboard navigation | Yes | Status indicator and `/nodered` commands accessible via standard TUI keyboard navigation |
| Screen reader support | N/A | TUI operates in terminal environment |
| Color contrast | Yes | Status indicator uses green (running) and gray (all other states) via boolean SidebarContribution API; state detail conveyed by dynamic label text |
| Focus indicators | N/A | Standard terminal cursor behavior |
| Reduced motion | N/A | No animations involved |
| Touch targets | N/A | Terminal-based interface |

**Additional accessibility notes**: The sidebar status indicator MUST use both color and text label (not color alone) to convey Node-RED state, ensuring usability in monochrome terminals.
- Node-RED status messages delivered through connector output (Telegram/Discord) follow the standard command response formatting. No special formatting is required beyond the platform-native message delivery used by all slash commands.

## Performance Requirements *(include if performance-sensitive)*

| Metric | Target | Justification |
|--------|--------|---------------|
| Slashbot startup overhead | < 5 seconds added (on reference platform: Bun 1.0+, modern Linux) | Node-RED spawn should not significantly delay slashbot becoming usable |
| Health check response detection | < 2 seconds per probe | Rapid detection of Node-RED availability without excessive resource use |
| Crash detection to restart initiation | < 1 health check interval | Minimize downtime after a crash |
| Graceful shutdown completion | < 15 seconds total (10s graceful timeout + 5s force-kill buffer) | Prevent slashbot shutdown from hanging due to Node-RED |

**Performance Degradation Scenarios**:

| Scenario | Expected Impact | Mitigation |
|----------|----------------|------------|
| Heavy Node-RED flow load (many active flows/nodes) | Health check response time may exceed 2s target | Health check timeout is per-probe; slow responses are retried on next interval, not treated as failures unless fully unresponsive |
| Slow Node.js startup (large node_modules, cold start) | Readiness detection may take longer than typical | Readiness polling continues until timeout; no hard cap on startup duration beyond the health check mechanism |
| High system memory pressure | Node-RED process may be OOM-killed by OS | Treated as a crash; auto-restart flow applies (up to 3 retries with exponential backoff) |

## Security Considerations *(mandatory if handling auth, PII, or external input)*

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Node-RED listens on a network port | Bind to localhost only by default | Prevents remote access unless explicitly configured |
| Child process inherits environment | Limit environment variables passed to Node-RED | Only pass required variables (NODE_PATH, HOME) |
| Configuration file may contain sensitive paths | Standard file permissions (owner read/write only) | Configuration stored in user's home directory |
| Node-RED process runs with slashbot's privileges | Same trust model as other slashbot plugins (bash, filesystem) | Consistent with existing security posture |

**Additional Security Requirements**:

- The system MUST validate the configuration file on load: malformed JSON MUST result in a logged warning and fallback to default configuration (not a crash).
- The system MUST validate health check HTTP responses: unexpected status codes or connection errors MUST be treated as health check failures (not crashes).
- Configuration files MUST be created with owner read/write permissions only (mode 0600).

## Data & State *(mandatory if feature involves persistence)*

- **Data ownership**: System (slashbot instance) owns the configuration; Node-RED owns its flow data
- **Access control**: Only the slashbot process and administrator can read/write configuration
- **Retention policy**: Configuration persists indefinitely; logs may be rotated based on size
- **Concurrent modification**: Single writer (only one slashbot instance manages the Node-RED config at a time)
- **Sync behavior**: Configuration is read at startup and on explicit restart; no live reload
- **Sensitive data**: The Node-RED configuration contains no sensitive data (API keys, passwords, tokens). All fields are operational parameters (port, paths, flags, intervals).
- **Conversation context**: The Node-RED prompt contribution exposes only operational status (state, port, uptime). No sensitive data is included in conversation context or persisted history.
- **Schema migration**: Configuration schema v1 requires no migration. Future schema changes MUST include a migration strategy or backward-compatible defaults.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Node-RED starts automatically with slashbot and becomes reachable within 30 seconds of slashbot startup.
- **SC-002**: After an unexpected Node-RED crash, the system automatically restores a running Node-RED instance within 60 seconds (assuming the underlying issue is transient).
- **SC-003**: The administrator can stop and restart Node-RED using slash commands, with each operation completing within 15 seconds.
- **SC-004**: Node-RED maintains uptime of greater than 99% per operational session (from slashbot start to slashbot stop), excluding intentional `/nodered stop` periods.
- **SC-005**: Slashbot startup and shutdown are not blocked by Node-RED failures; slashbot remains fully usable for non-Node-RED features regardless of Node-RED state.

## Assumptions

- Node.js (>= 18.x) is installed on the host machine. The plugin does not auto-install Node.js.
- Node-RED (>= 3.x) is installed locally in `~/.slashbot/nodered/node_modules/node-red`. If not present, the plugin auto-installs it via `npm install node-red` during initialization. The launch command is `node ~/.slashbot/nodered/node_modules/node-red/red.js -s settings.js`. *(Updated 2026-02-15: auto-install replaces manual installation requirement)*
- The Node-RED instance runs on the same machine as slashbot (no remote management).
- Only one slashbot instance manages the Node-RED process at a time.
- The configured port is available for Node-RED to bind to.

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [ideas/002-nodered-plugin/idea.md](../../ideas/002-nodered-plugin/idea.md)
- **Feature**: [ideas/002-nodered-plugin/features/01-nodered-lifecycle.md](../../ideas/002-nodered-plugin/features/01-nodered-lifecycle.md)

### Technical Constraints
- Node-RED runs as a child Node.js process, not in the Bun runtime (potential incompatibility)
- The Node-RED Admin API is REST on the same port as the editor (default 1880)
- Flows are stored by Node-RED in `~/.slashbot/nodered/flows.json`
- Node-RED requires a `settings.js` file configuring: `httpAdminRoot`, `httpNodeRoot`, `userDir`, `flowFile`, `functionGlobalContext`

### Implementation Guidance
- Use `child_process.spawn` (via Bun) to launch Node-RED
- Launch command: `node node_modules/node-red/red.js -s settings.js`
- Port must be configurable (default: 1880) and stored in `~/.slashbot/config/nodered.json`
- Health check via `fetch('http://localhost:{port}/')` with configurable interval (default: 30s)
- Set `NODE_PATH` so Node-RED finds its modules
- The plugin should register in the DI container as `TYPES.NodeRedManager`
- Follow the BashPlugin (ProcessManager) pattern for process management
- Follow the MCPPlugin pattern for health check connections
- Follow the ConfigManager pattern for configuration management

### Discovery Decisions
- Usage: hybrid - both bot (autonomous) and human can manage Node-RED
- Integration: MCP dynamic - flows exposed as MCP tools (handled by feature 03)
- Lifecycle: managed by slashbot as child process
- Security: same trust model as slashbot (consistent with bash/filesystem plugins)
