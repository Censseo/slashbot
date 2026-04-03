---
name: vitest-patterns
description: Vitest testing conventions and patterns for slashbot
---

# Vitest Testing Patterns

## Configuration

- **Config file**: `vitest.config.ts`
- **Globals**: Enabled — `describe`, `it`, `expect`, `vi` available without imports
- **Environment**: Node.js
- **Test pattern**: `src/**/*.test.ts`
- **Timeout**: 10 seconds per test
- **Coverage**: V8 provider with text, HTML, LCOV reporters

## Scripts

```bash
bun run test            # Single run
bun run test:watch      # Watch mode
bun run test:ui         # UI dashboard
bun run test:coverage   # Coverage report
```

## Test File Placement

Tests are co-located with source files:

```
src/plugins/code-editor/services/
  replacers.ts           # Implementation
  replacers.test.ts      # Tests
src/core/commands/
  registry.ts            # Implementation
  registry.test.ts       # Tests
```

## Test Structure

### Describe/It Organization
```typescript
describe('ClassName', () => {
  let instance: MyClass;

  beforeEach(() => {
    instance = new MyClass();
  });

  describe('methodName', () => {
    it('does X when condition Y', () => {
      const result = instance.methodName(input);
      expect(result).toBe(expected);
    });
  });
});
```

### Inversify Tests (require reflect-metadata)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';

describe('ServiceUsingDI', () => {
  // ...
});
```

## Mocking Patterns

### Function Mocks
```typescript
const handler = vi.fn();                          // Basic mock
const asyncFn = vi.fn().mockResolvedValue(true);  // Async mock
const custom = vi.fn().mockImplementation(async () => {
  await new Promise(r => setTimeout(r, 10));
  return result;
});
```

### Mock Assertions
```typescript
expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
expect(fn).toHaveBeenCalledTimes(1);
```

### Type-safe Result Helpers
```typescript
function ok(r: Result | Failure): Result {
  expect(r.ok).toBe(true);
  return r as Result;
}

function fail(r: Result | Failure): Failure {
  expect(r.ok).toBe(false);
  return r as Failure;
}
```

## Common Assertions

```typescript
expect(value).toBe(expected);           // Strict equality
expect(value).toBeDefined();            // Existence
expect(string).toContain('substring');  // String contains
expect(array).toHaveLength(3);          // Array length
expect(obj).toEqual({ key: 'value' }); // Deep equality
```

## Conventions

- Test files use `.test.ts` extension (not `.spec.ts`)
- Import `'reflect-metadata'` in tests that touch Inversify-bound classes
- Use `vi.fn()` for all mocks (not jest-style)
- Mock context objects with `{} as any` for unit tests
- Prefer testing pure functions and public API surfaces
- Group tests by method name under the class-level `describe`
