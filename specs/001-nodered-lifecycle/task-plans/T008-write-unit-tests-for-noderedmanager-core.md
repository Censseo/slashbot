# Task Plan: T008

## Task Description
Write unit tests for NodeRedManager core in `src/plugins/nodered/services/NodeRedManager.test.ts`: state machine transitions (disabled->stopped->starting->running, disabled->unavailable), init() with config loading and defaults, start() with spawn and readiness polling, health check timer setup, stale process adoption (FR-018 port probe), Node.js availability check (FR-013), log capture to RingBuffer and file, getState(), getStatus()

Phase: User Story 1 - Automatic Node-RED Startup | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Testing First (write tests before implementation), Plugin-First (test resides in plugin directory)
- Tech decisions followed: Vitest as test framework, TypeScript strict mode, InversifyJS DI for test setup
- Conventions: file at `src/plugins/nodered/services/NodeRedManager.test.ts`, co-located with implementation
- Anti-patterns avoided: No direct cross-plugin imports (mock EventBus, mock filesystem)
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID
Justification: NodeRedManager is a new service with complex state machine logic requiring comprehensive test coverage. No existing test suite to extend.
Similar pattern to follow: `src/plugins/nodered/services/RingBuffer.test.ts` (describe/it blocks with beforeEach, vitest imports) and `src/plugins/nodered/services/settings.test.ts` (44 tests covering edge cases).

## Codebase Impact
- Files to create: `src/plugins/nodered/services/NodeRedManager.test.ts` -- comprehensive unit tests for NodeRedManager
- Files to modify: None
- Dependencies:
  - Vitest (describe, it, expect, beforeEach, afterEach, vi)
  - Mock EventBus (typed mock with emit spy)
  - Mock filesystem operations (Bun.spawn, Bun.write, file.text())
  - Mock process (for which node check)
  - Mock fetch (for health checks and port probes)
  - Types from `src/plugins/nodered/types.ts`
  - RingBuffer from `src/plugins/nodered/services/RingBuffer.ts`

## Implementation Steps

1. **Set up test file structure** (`src/plugins/nodered/services/NodeRedManager.test.ts:1-50`)
   - Import vitest utilities (describe, it, expect, beforeEach, afterEach, vi)
   - Import NodeRedManager (will be implemented in T009)
   - Import types: NodeRedState, NodeRedConfig, NodeRedStatus from `../types`
   - Create mock EventBus factory with emit spy
   - Create mock Bun.spawn factory (returns mock Subprocess with exited Promise, pid, kill, stdout, stderr)
   - Create mock fetch factory for health checks and port probes

2. **Test suite: State machine transitions** (lines 51-150)
   - `describe('State Machine Transitions')`
   - Test valid transitions:
     - `disabled -> stopped` (when enabled=true, Node.js found)
     - `disabled -> unavailable` (when enabled=true, Node.js not found)
     - `unavailable -> stopped` (when Node.js becomes available)
     - `stopped -> starting` (on start() call)
     - `starting -> running` (health check returns 200)
     - `starting -> failed` (spawn fails)
     - `running -> stopped` (intentional stop)
     - `running -> starting` (crash with restarts available)
     - `running -> failed` (crash with exhausted restarts)
     - `failed -> starting` (manual retry)
   - Test invalid transitions (disabled->starting, stopped->running, failed->running) should not occur

3. **Test suite: init() method** (lines 151-250)
   - `describe('init()')`
   - Mock config loading (default config if no file exists)
   - Test with enabled=false -> state should be 'disabled'
   - Test with enabled=true, Node.js available -> state should be 'stopped'
   - Test with enabled=true, Node.js unavailable -> state should be 'unavailable'
   - Test stale process adoption (FR-018): mock fetch to port returns 200 -> state 'running'
   - Test default config values are applied correctly

4. **Test suite: start() method** (lines 251-350)
   - `describe('start()')`
   - Mock Bun.spawn to return controllable Subprocess
   - Test successful start: spawn succeeds, readiness poll returns 200 -> state 'running', health check timer started
   - Test spawn failure: Bun.spawn throws -> state 'failed', error event emitted
   - Test readiness timeout: mock fetch never returns 200 -> retries exhausted -> state 'failed'
   - Test idempotency: calling start() when already 'starting' or 'running' returns early
   - Test settings.js generation: verify generateSettings() is called with config
   - Test stdout/stderr capture: mock process streams, verify RingBuffer.push() called
   - Test EventBus emissions: 'nodered:ready', 'prompt:redraw'

5. **Test suite: Health check timer** (lines 351-400)
   - `describe('Health Check Timer')`
   - Test timer starts after process becomes 'running'
   - Use vi.useFakeTimers() and vi.advanceTimersByTime() for deterministic tests
   - Test timer fires at configured interval (healthCheckInterval from config)
   - Test health check success: fetch returns 200 -> no state change
   - Test health check failure detection
   - Test timer cleanup on stop() and destroy()

6. **Test suite: Stale process adoption (FR-018)** (lines 401-450)
   - `describe('Stale Process Adoption')`
   - Mock fetch to configured port during init()
   - Test port responds 200 -> state 'running', no new spawn, health checks start
   - Test port responds non-200 or timeout -> state 'stopped', no adoption
   - Test port probe error -> state 'stopped', no adoption

7. **Test suite: Node.js availability check (FR-013)** (lines 451-500)
   - `describe('Node.js Availability Check')`
   - Mock `which node` command via Bun.spawn
   - Test Node.js found -> state 'stopped' (if enabled=true)
   - Test Node.js not found -> state 'unavailable', error logged

8. **Test suite: Log capture** (lines 501-550)
   - `describe('Log Capture')`
   - Mock Bun.spawn with stdout/stderr streams
   - Mock Bun.write for file logging
   - Test stdout lines pushed to RingBuffer
   - Test stderr lines pushed to RingBuffer
   - Test logs written to file (path from config.userDir)

9. **Test suite: getState() and getStatus()** (lines 551-600)
   - `describe('getState() and getStatus()')`
   - Test getState() returns current NodeRedState
   - Test getStatus() returns NodeRedStatus with all fields
   - Test getStatus(logLines) returns correct number of log lines from RingBuffer
   - Test uptime calculation (from startedAt)
   - Test restartCount increments on each restart

10. **Cleanup and edge cases** (lines 601-650)
    - Test destroy() cleans up timers, process, event listeners
    - Test multiple init() calls are idempotent
    - Test process crash during startup (before 'running') -> state 'failed'

Gotchas:
- Bun.spawn returns `Subprocess` with async `.exited` Promise -- use await or mock resolution
- Timers (setInterval) need vi.useFakeTimers() and vi.advanceTimersByTime() for deterministic tests
- EventBus emit is fire-and-forget -- use spy to verify calls
- Fetch mocking for health checks must return Response-like objects
- RingBuffer is stateful -- use fresh instance in beforeEach()
- Port probe during init() is async -- ensure init() awaits completion

## Related Tasks
Depends on: T003 (types defined), T005 (RingBuffer implemented), T007 (settings generator implemented)
Blocks: T009 (implementation uses tests as spec)
Parallel with: None (must complete before T009)

## Estimated Complexity
Complex | 1-2h | Risk: Medium
