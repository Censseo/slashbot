# Task Plan: T010

## Task Description
Modify NodeRedManager.init() to detect missing Node-RED binary and call setState('setup-needed') instead of ensureNodeRedInstalled().
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: REFACTOR

## Architecture Alignment
- Patterns applied: State machine via setState() — no direct mutation. Typed event emission via emitNodeRedEvent().
- Tech decisions followed: TypeScript strict; VALID_TRANSITIONS['stopped'] already contains 'setup-needed' (line 42)
- Conventions: All changes in src/plugins/nodered/services/NodeRedManager.ts
- Anti-patterns avoided: No direct state mutation; no skipping setState()
- Status: Aligned

## Reuse Decision
Original: REFACTOR | Validation: VALID
Target: NodeRedManager.ts:173-182 — replace ensureNodeRedInstalled() call with binary-exists check

## Codebase Impact
- Files to create: None
- Files to modify:
  - `src/plugins/nodered/services/NodeRedManager.ts:173-182` — replace ensureNodeRedInstalled() call with fs.existsSync(redJsPath) guard
  - `src/plugins/nodered/index.ts:484` — extend startup hook guard to also exclude 'setup-needed' from auto-start
- Dependencies: path (already imported), fs (already imported), VALID_TRANSITIONS already has transition

## Implementation Steps
1. After settings.js write (line 171), compute redJsPath:
   ```typescript
   const redJsPath = path.join(resolvedUserDir, 'node_modules/node-red/red.js');
   ```

2. Replace lines 173-182 (ensureNodeRedInstalled call block) with:
   ```typescript
   if (!fs.existsSync(redJsPath)) {
     this.setState('setup-needed');
     this.emitNodeRedEvent({ type: 'nodered:setup-needed' });
     return;
   }
   ```

3. Stale process probe block (lines 184-201) remains unchanged — only reached when binary exists.

4. **CRITICAL**: In `src/plugins/nodered/index.ts:484`, extend the startup hook guard:
   ```typescript
   if (config.enabled && state !== 'unavailable' && state !== 'disabled' && state !== 'setup-needed') {
   ```
   Without this, start() would be called in setup-needed state, causing setState('starting') to throw (not in VALID_TRANSITIONS['setup-needed']).

Gotchas:
- resolvedUserDir already computed at line 159 — derive redJsPath from it
- Event 'nodered:setup-needed' already declared in EventMap at index.ts:28 with Record<string, never>
- start() guards disabled/unavailable but NOT setup-needed — the startup hook guard (step 4) is essential
- Log to logBuffer optionally: `this.runtimeState.logBuffer?.push('[slashbot] Node-RED not found.')`

## Related Tasks
Depends on: None | Blocks: T011, T012, T013 | Parallel with: T014

## Estimated Complexity
Moderate | 30 min | Risk: Medium (startup hook guard must also be patched)
