---
name: inversify-di-patterns
description: Inversify dependency injection patterns used in slashbot
---

# Inversify DI Patterns

## Setup

- **Container**: Single global container with `defaultScope: 'Singleton'`
- **Requires**: `import 'reflect-metadata'` at entry point and in tests
- **tsconfig**: `experimentalDecorators: true`, `emitDecoratorMetadata: true`

## Container Configuration

```typescript
import 'reflect-metadata';
import { Container } from 'inversify';

export const container = new Container({ defaultScope: 'Singleton' });
```

## Binding Patterns

### Constant Value (pre-created instances)
```typescript
context.container.bind(TYPES.ProcessManager).toConstantValue(processManager);
```

### Dynamic Value (lazy initialization)
```typescript
container
  .bind(TYPES.ConfigManager)
  .toDynamicValue(() => createConfigManager())
  .inSingletonScope();
```

### Class Binding
```typescript
container.bind(TYPES.EventBus).to(EventBus).inSingletonScope();
```

## Symbol-based Types

All service identifiers are defined as symbols in `src/core/di/types.ts`:

```typescript
export const TYPES = {
  ConfigManager: Symbol.for('ConfigManager'),
  EventBus: Symbol.for('EventBus'),
  ConnectorRegistry: Symbol.for('ConnectorRegistry'),
  CommandRegistry: Symbol.for('CommandRegistry'),
  HooksManager: Symbol.for('HooksManager'),
  FileSystem: Symbol.for('FileSystem'),
  ProcessManager: Symbol.for('ProcessManager'),
  CodeEditor: Symbol.for('CodeEditor'),
  // ...
};
```

## Service Resolution

### In Plugin Handlers (via PluginContext)
```typescript
async init(context: PluginContext): Promise<void> {
  const fileSystem = createFileSystem(context.workDir);
  context.container.bind(TYPES.FileSystem).toConstantValue(fileSystem);
}

// Later, in action handlers:
const codeEditor = context.container.get<CodeEditor>(TYPES.CodeEditor);
```

### Global Access
```typescript
import { getService, TYPES } from './core/di/container';

const eventBus = getService<EventBus>(TYPES.EventBus);
```

## Conventions

- All bindings are singletons by default
- Plugins register their services during `init()` via `context.container.bind()`
- Use `toConstantValue()` for pre-instantiated services
- Use `toDynamicValue()` for services needing async initialization
- Symbol identifiers prevent naming collisions
- Type parameter on `get<T>()` provides type safety
