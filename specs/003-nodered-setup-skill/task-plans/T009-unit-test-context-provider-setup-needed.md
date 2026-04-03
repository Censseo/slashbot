# Task Plan: T009

## Task Description
Unit test: context provider returns skill invocation message when state is setup-needed.
Phase: Phase 3 | User Story: US1 | Parallel: Yes | Reuse Type: N/A (test)

## Architecture Alignment
- Patterns applied: Plugin test harness pattern from tests/skills-plugin.test.ts:21-55 — factory plugin with mock context
- Conventions: file at `tests/nodered-context.test.ts`, flat in tests/
- Anti-patterns avoided: No importing NodeRedManager internals; test through plugin's public contribution surface
- Status: Aligned

## Codebase Impact
- Files to create: `tests/nodered-context.test.ts` — context provider unit tests
- Files to modify: none
- Dependencies: createNodeRedPlugin from src/plugins/nodered/index.ts, vitest

## Implementation Steps

1. Create mock context following tests/skills-plugin.test.ts pattern, collecting:
   - Context providers via `contributeContextProvider`
   - Registered services via `registerService` (capture NodeRedManager instance at id 'nodered.manager')

2. Call `plugin.setup(mockContext)` — setup() is synchronous, no Bun mocks needed (init() only runs in startup hook)

3. Capture manager from registerService, spy on getState:
   ```typescript
   vi.spyOn(capturedManager, 'getState').mockReturnValue('setup-needed');
   ```

4. Primary test (TDD — fails until T012):
   ```typescript
   test('returns skill invocation message when state is setup-needed', () => {
     vi.spyOn(manager, 'getState').mockReturnValue('setup-needed');
     const result = provider.provide();
     expect(result).toMatch(/setup|install|skill/i);
     expect(result).not.toBe('');
   });
   ```

5. Complementary tests (verify existing behavior — pass immediately):
   ```typescript
   test('returns empty string when disabled', () => { ... });
   test('returns running status when running', () => { ... });
   ```

Gotchas:
- setup() does NOT call init() — no Bun mocks needed
- contributeStatusIndicator mock must return a function: `() => () => {}`
- Manager created inside setup(), capture via registerService callback
- TDD test fails until T012 changes provide() to return skill instruction for setup-needed

## Related Tasks
Depends on: none | Blocks: none | Parallel with: T008, T008b

## Estimated Complexity
Simple | 30-45 min | Risk: Low
