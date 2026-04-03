---
name: typescript-bun-patterns
description: TypeScript and Bun runtime conventions for the slashbot project
---

# TypeScript & Bun Patterns

## Runtime & Build

- **Runtime**: Bun (dev via `bun run src/index.ts`, build via `bun build --compile`)
- **Target**: ES2022 with ESNext modules (`"moduleResolution": "bundler"`)
- **Strict mode**: Enabled with `experimentalDecorators` and `emitDecoratorMetadata` for Inversify
- **Package type**: ESM (`"type": "module"`)

## Code Style (Prettier)

- **Line width**: 100 characters
- **Quotes**: Single quotes (`'value'`)
- **Semicolons**: Always
- **Trailing commas**: All (`all`)
- **Indentation**: 2 spaces
- **Arrow parens**: Avoid when possible (`x => x` not `(x) => x`)

## ESLint Rules

- **Unused imports**: Error — all unused imports must be removed
- **Unused vars**: Warn — prefix unused vars with `_` (e.g., `_unused`)
- **Floating promises**: Error — all promises must be awaited or returned
- **Misused promises**: Error — no passing promises where void is expected
- **Nullish coalescing**: Warn — prefer `??` over `||` for nullable values

## Conventions

- Use `type` imports for type-only imports: `import type { Foo } from './foo'`
- Export interfaces and types alongside implementations
- Prefer `readonly` for immutable plugin metadata properties
- Use Zod (`z.object(...)`) for runtime schema validation (tool parameters)
- Use `as const` for literal type narrowing
- Prefix private/internal members with no underscore (use `private` keyword)
- Use discriminated unions with `.ok` property for result types

## File Organization

```
src/
  core/           # Framework core (DI, events, API, config)
  plugins/        # Plugin modules (one directory per plugin)
  connectors/     # Platform connectors (telegram, discord)
  index.ts        # Entry point
```

## Common Patterns

### Async Factory Functions
```typescript
export async function createConfigManager(): Promise<ConfigManager> {
  // ... initialization logic
}
```

### Result Types (Discriminated Union)
```typescript
interface Success { ok: true; content: string; strategy: string; }
interface Failure { ok: false; message: string; }
type Result = Success | Failure;
```

### Re-export Barrel Files
```typescript
// plugins/bash/index.ts
export { BashPlugin } from './plugin';  // or define class directly
```
