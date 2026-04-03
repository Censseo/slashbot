# Task Plan: T008b

## Task Description
Unit test: NodeRedManager probes port on startup and adopts existing instance (FR-011), and plugin init completes without blocking when Node-RED is unavailable (FR-016).
Phase: Phase 3 | User Story: US1 | Parallel: Yes | Reuse Type: N/A (test)

## Architecture Alignment
- Patterns applied: Same Vitest + direct instantiation as T008; lives in same file
- Conventions: appended to `tests/nodered-manager.test.ts` in same describe block
- Anti-patterns avoided: No calling internal timers directly; use vi.useFakeTimers() to prevent leaks
- Status: Aligned

## Codebase Impact
- Files to create: none (appended to file from T008)
- Files to modify: none
- Dependencies: same as T008; additionally vi.useFakeTimers/useRealTimers, vi.stubGlobal('fetch')

## Implementation Steps

### FR-011: Port probe and stale-process adoption

1. Mock init() path to reach stale-process probe (NodeRedManager.ts:185):
   - `Bun.spawn` for `which node` → exit 0
   - `fs.existsSync` for redJsPath → `true` (Node-RED installed)
   - `Bun.file.exists()` → false (no config), `Bun.write` → OK

2. Mock global `fetch` to return `{ ok: true, status: 200 }` — triggers adoption branch

3. Use `vi.useFakeTimers()` to prevent health check timer leaks

4. Test:
   ```typescript
   test('adopts existing Node-RED instance when port responds (FR-011)', async () => {
     vi.useFakeTimers();
     const manager = new NodeRedManager(noopEventBus(), homePath);
     await manager.init();
     expect(manager.getState()).toBe('running');
     vi.useRealTimers();
   });
   ```

5. Assert eventBus.publish called with 'nodered:ready'

### FR-016: Non-blocking init when unavailable

6. Mock `Bun.spawn` for `which node` → exit 1 (Node.js not found)

7. Test:
   ```typescript
   test('init completes without blocking when Node-RED unavailable (FR-016)', async () => {
     const manager = new NodeRedManager(noopEventBus(), homePath);
     const start = Date.now();
     await manager.init();
     expect(manager.getState()).toBe('unavailable');
     expect(Date.now() - start).toBeLessThan(5000);
   });
   ```

8. Test idempotency:
   ```typescript
   test('init() is idempotent — second call is no-op if already initialized', async () => {
     const manager = new NodeRedManager(noopEventBus(), homePath);
     await manager.init();
     const state = manager.getState();
     await manager.init();
     expect(manager.getState()).toBe(state);
   });
   ```

Gotchas:
- Health check timer from adoption path leaks without fake timers
- `fetch` mock via `vi.stubGlobal` — restore with `vi.unstubAllGlobals()` in afterEach
- AbortSignal.timeout(2000) may interact oddly with fake timers — ensure fetch mock resolves synchronously
- FR-011 and FR-016 tests verify CURRENT behavior — should pass immediately once mocks are correct

## Related Tasks
Depends on: T008 (shares file) | Blocks: none | Parallel with: T008, T009

## Estimated Complexity
Moderate | 60-90 min | Risk: Medium (global fetch mock + fake timer interaction)
