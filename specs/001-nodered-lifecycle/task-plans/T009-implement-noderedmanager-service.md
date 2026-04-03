# Task Plan: T009

## Task Description
Implement NodeRedManager service in `src/plugins/nodered/services/NodeRedManager.ts`: 6-state machine with valid/invalid transitions, init() (load config with defaults, check Node.js via `which node`, determine initial state, probe port for stale process adoption), start() (generate settings.js, spawn `node red.js -s settings.js` via Bun.spawn, readiness poll every 500ms, start health check timer at configured interval), stdout/stderr capture to RingBuffer + log file, getState(), getStatus(), emit lifecycle events via EventBus, emit `prompt:redraw` on state changes

Phase: User Story 1 - Automatic Node-RED Startup | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Library-First (reuse RingBuffer, settings generator), DI (injectable service), Typed Event Bus (emit lifecycle events), HeartbeatService timer pattern, ProcessManager SIGTERM->SIGKILL escalation
- Tech decisions followed: TypeScript strict, Bun 1.0+ APIs (spawn, write), InversifyJS
- Conventions: file at `src/plugins/nodered/services/NodeRedManager.ts`
- Anti-patterns avoided: No feature logic in core, no direct cross-plugin imports (only core EventBus)
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID
Justification: NodeRedManager is the central lifecycle orchestrator for Node-RED. No existing service handles this domain.

Components to reuse:
- RingBuffer (`src/plugins/nodered/services/RingBuffer.ts`) -- log buffering
- generateSettings (`src/plugins/nodered/services/settings.ts`) -- settings.js generation
- EventBus (`src/core/events/EventBus.ts`) -- lifecycle event emission
- HeartbeatService pattern -- timer setup and cleanup
- ProcessManager pattern -- graceful shutdown with timeout

## Codebase Impact
- Files to create: `src/plugins/nodered/services/NodeRedManager.ts` -- core lifecycle manager
- Files to modify: None (plugin registration happens in later tasks)
- Dependencies:
  - `NodeRedState, NodeRedConfig, NodeRedRuntimeState, NodeRedStatus` from `../types.ts`
  - `RingBuffer` from `./RingBuffer`
  - `generateSettings` from `./settings`
  - EventBus from `src/core/events/EventBus.ts`
  - Bun APIs: `Bun.spawn`, `Bun.write`, `Bun.file`
  - Node.js: `path.join`, `fs.existsSync`, `fs.mkdirSync`

## Implementation Steps

1. **File setup and imports** (lines 1-30)
   - Import types from `../types` (NodeRedState, NodeRedConfig, NodeRedRuntimeState, NodeRedStatus)
   - Import RingBuffer from `./RingBuffer`
   - Import generateSettings from `./settings`
   - Import path/fs utilities
   - Define HOME_SLASHBOT_DIR constant (from `src/core/config/constants.ts` pattern)
   - Define DEFAULT_CONFIG object

2. **Class declaration** (lines 31-60)
   - `export class NodeRedManager`
   - Constructor accepts EventBus instance
   - Private fields: config, runtimeState (with defaults), logBuffer (new RingBuffer(200))

3. **State transition helper** (lines 61-90)
   - `private setState(newState: NodeRedState): void`
   - Define valid transitions map:
     ```
     disabled -> [stopped, unavailable]
     unavailable -> [stopped]
     stopped -> [starting]
     starting -> [running, failed]
     running -> [stopped, starting, failed]
     failed -> [starting]
     ```
   - Validate transition, throw if invalid
   - Set new state, emit `prompt:redraw`

4. **init() method** (lines 91-150)
   - Load config from `~/.slashbot/nodered.json` with JSON parse error handling (fallback to defaults)
   - If `config.enabled === false` -> set state 'disabled', return
   - Check Node.js via `Bun.spawn(['which', 'node'])`, await `.exited`
   - If exit code !== 0 -> set state 'unavailable', return
   - Probe configured port for stale process adoption:
     - `fetch(\`http://localhost:${config.port}/\`, { signal: AbortSignal.timeout(2000) })`
     - If 200: set state 'running', start health check timer, emit `nodered:ready`
     - Otherwise: set state 'stopped'
   - Create userDir if not exists

5. **start() method** (lines 151-220)
   - Idempotency: if state is 'starting' or 'running', return info message
   - Guard: if state is 'disabled' or 'unavailable', return error message
   - Reset intentionalStop flag
   - Generate settings.js via `generateSettings(config)`, write to `{userDir}/settings.js`
   - Create userDir if not exists
   - Transition to 'starting'
   - Spawn Node-RED: `Bun.spawn(['node', '{userDir}/node_modules/node-red/red.js', '-s', settingsPath], { cwd: userDir, env: { HOME, NODE_PATH, PATH }, stdio: ['ignore', 'pipe', 'pipe'] })`
   - Store process reference and PID
   - Attach log capture handlers for stdout/stderr
   - Set up `process.exited.then()` handler for crash detection
   - Start readiness poll (every 500ms)

6. **Readiness polling** (lines 221-260)
   - `private startReadinessPoll(): void`
   - Poll `fetch(\`http://localhost:${config.port}/\`)` every 500ms
   - On success (200): clear poll timer, transition to 'running', set startedAt, start health check timer, reset restartCount, emit `nodered:ready`
   - On timeout (max ~60 attempts = 30s): clear poll timer, transition to 'failed', kill process, emit `nodered:failed`

7. **Health check timer** (lines 261-300)
   - `private startHealthCheckTimer(): void`
   - Clear existing timer if any
   - `setInterval(performHealthCheck, config.healthCheckInterval * 1000)`
   - `private async performHealthCheck(): Promise<void>`
   - Fetch health endpoint, log result
   - Note: health check failure handling is Phase 4 (US2 - crash recovery). In US1, health checks monitor only.

8. **Log capture** (lines 301-340)
   - `private attachLogHandlers(proc): void`
   - Read stdout via `proc.stdout.getReader()` async loop
   - Read stderr via `proc.stderr.getReader()` async loop
   - Each line: push to RingBuffer, append to log file (`~/.slashbot/logs/nodered.log`)
   - `private async appendToLogFile(line: string): Promise<void>`

9. **Process exit handler** (lines 341-370)
   - `private handleProcessExit(code: number): void`
   - If intentionalStop: transition to 'stopped', emit `nodered:stopped`, return
   - Else: emit `nodered:error` (crash detected). Actual auto-restart logic is Phase 4 (T014).
   - Clear health check timer, null process reference

10. **stop() method** (lines 371-410)
    - Idempotency: if already stopped/disabled, return info message
    - Set intentionalStop = true
    - Clear health check and readiness timers
    - Send SIGTERM to process
    - Wait for `.exited` with configurable timeout (Promise.race)
    - If timeout: send SIGKILL, log forced termination
    - Transition to 'stopped', emit `nodered:stopped`

11. **restart() method** (lines 411-420)
    - Call stop(), then start()
    - Reset restartCount

12. **Getter methods** (lines 421-460)
    - `getState(): NodeRedState` -- return current state
    - `getConfig(): NodeRedConfig` -- return copy of config
    - `getStatus(logLines = 10): NodeRedStatus` -- assemble status object with uptime calculation, RingBuffer tail

13. **saveConfig() method** (lines 461-490)
    - Merge partial config with existing
    - Write to `~/.slashbot/nodered.json` with mode 0600
    - Return change summary message

14. **destroy() method** (lines 491-510)
    - If running/starting: call stop()
    - Clear all timers (health check, readiness poll)
    - Clear log buffer
    - Null process references

Gotchas:
- Bun.spawn `.exited` is a Promise, not an event -- attach `.then()` for crash detection
- SIGTERM -> SIGKILL escalation requires Promise.race with timeout
- Readiness poll timer must be cleaned up on success AND timeout to avoid leaks
- Health check timer must be cleared on stop/destroy
- `which node` may behave differently on different platforms (Linux vs macOS)
- Log file directory (`~/.slashbot/logs/`) must be created if not exists
- Config file may not exist on first run -- handle gracefully with defaults
- State transitions must be validated to prevent invalid states
- intentionalStop flag must be reset at start of start()
- Process adoption during init() must start health checks immediately

## Related Tasks
Depends on: T008 (tests provide TDD spec), T003 (types), T005 (RingBuffer), T007 (settings generator)
Blocks: T011 (NodeRedPlugin), T013-T021 (all subsequent user stories)
Parallel with: None

## Estimated Complexity
Complex | 2h | Risk: High
