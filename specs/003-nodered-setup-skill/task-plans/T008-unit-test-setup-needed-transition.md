# Task Plan: T008

## Task Description
Unit test: NodeRedManager transitions to setup-needed when Node.js present but Node-RED not installed.
Phase: Phase 3 | User Story: US1 | Parallel: Yes | Reuse Type: N/A (test)

## Architecture Alignment
- Patterns applied: Vitest test harness; NodeRedManager instantiated directly (unit concern)
- Conventions: file at `tests/nodered-manager.test.ts`, flat per project convention
- Anti-patterns avoided: No calling private setState() or ensureNodeRedInstalled(); drive state through init(), observe via getState()
- Status: Aligned

## Codebase Impact
- Files to create: `tests/nodered-manager.test.ts` — NodeRedManager unit tests (shared with T008b)
- Files to modify: none
- Dependencies: NodeRedManager, vitest, node:fs mocks, Bun.spawn mocks

## Implementation Steps
1. Create `tests/nodered-manager.test.ts` with shared infrastructure:
   - `noopEventBus()` factory returning mock `{ publish: vi.fn() }`
   - `tmpHomePath` via `mkdtemp` in beforeEach, cleaned in afterEach

2. Mock `Bun.spawn` — first call for `which node` returns exit 0 (Node.js found)

3. Mock `Bun.file` to return `{ exists: () => Promise.resolve(false) }` (no config file)

4. Mock `Bun.write` to resolve (bypass settings.js write)

5. Mock `fs.existsSync` to return `false` for paths containing `node-red/red.js` but `true` for userDir paths

6. Mock the npm install spawn (second Bun.spawn) to simulate failure

7. Write test:
   ```typescript
   test('transitions to setup-needed when Node.js present but Node-RED not installed', async () => {
     const manager = new NodeRedManager(noopEventBus(), homePath);
     expect(manager.getState()).toBe('disabled');
     await manager.init();
     expect(manager.getState()).toBe('setup-needed');
   });
   ```
   This test is TDD — fails until T010 modifies init().

8. Assert eventBus.publish called with 'nodered:setup-needed' event

Gotchas:
- `Bun.spawn` called twice in init(): once for `which node`, once for npm install — mock must differentiate by call order
- `fs.existsSync` called for multiple paths — use `mockImplementation` with path check
- `fs.mkdirSync` must also be spied to prevent real filesystem calls
- Test is TDD: fails on current code (transitions to `failed`), passes after T010

## Related Tasks
Depends on: none | Blocks: none | Parallel with: T008b, T009

## Estimated Complexity
Moderate | 60-90 min | Risk: Medium (Bun global mocking)
