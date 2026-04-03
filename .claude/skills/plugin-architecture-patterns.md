---
name: plugin-architecture-patterns
description: Plugin system architecture and contribution patterns for slashbot
---

# Plugin Architecture Patterns

## Plugin Interface

Every plugin implements the `Plugin` interface from `src/plugins/types.ts`:

```typescript
export interface Plugin {
  readonly metadata: PluginMetadata;
  init(context: PluginContext): Promise<void>;
  getActionContributions(): ActionContribution[];
  getPromptContributions(): PromptContribution[];
  getCommandContributions?(): CommandHandler[];
  getContextProviders?(): ContextProvider[];
  getEventSubscriptions?(): EventSubscription[];
  getToolContributions?(): ToolContribution[];
  destroy?(): Promise<void>;
}
```

## Plugin Metadata

```typescript
export interface PluginMetadata {
  id: string;           // e.g., 'core.bash', 'feature.git'
  name: string;         // Human-readable name
  version: string;      // Semver
  category: string;     // 'core' | 'feature'
  description: string;  // What the plugin does
  dependencies?: string[];      // Other plugin IDs
  contextInject?: boolean;      // Include in conversation context (default: true)
}
```

## Directory Structure (per plugin)

```
src/plugins/my-plugin/
  index.ts          # Plugin class (exports MyPlugin)
  executors.ts      # Action executor functions
  parser.ts         # XML parser configurations
  tools.ts          # AI SDK tool contributions (Zod schemas)
  prompt.ts         # System prompt text
  types.ts          # Plugin-specific type definitions
  commands.ts       # CLI command handlers (optional)
  services/         # Domain services (optional)
```

## Contribution Types

### 1. Action Contributions (XML-based execution)
```typescript
getActionContributions(): ActionContribution[] {
  return [{
    type: 'my-action',       // Action type identifier
    tagName: 'my-action',    // XML tag name for parsing
    handler: { onMyAction }, // Handler functions
    execute: executeMyAction, // Executor function
  }];
}
```

### 2. Tool Contributions (AI SDK native tools)
```typescript
getToolContributions(): ToolContribution[] {
  return [{
    name: 'my_tool',
    description: 'LLM-visible description',
    parameters: z.object({ path: z.string() }),
    toAction: (args) => ({ type: 'my-action', path: args.path as string }),
  }];
}
```

### 3. Prompt Contributions (system prompt segments)
```typescript
getPromptContributions(): PromptContribution[] {
  return [{
    id: 'my-plugin.tools',
    title: 'My Plugin Tools',
    priority: 20,       // Lower = higher priority
    content: MY_PROMPT, // String constant or function
  }];
}
```

### 4. Context Providers (dynamic context injection)
```typescript
getContextProviders(): ContextProvider[] {
  return [{
    id: 'git-context',
    priority: 10,
    isActive: () => true,
    getContext: async () => `Current branch: ${branch}`,
  }];
}
```

### 5. Command Contributions (CLI commands)
```typescript
getCommandContributions(): CommandHandler[] {
  return [{
    name: 'commit',
    description: 'Create a git commit',
    usage: '/commit [message]',
    execute: async (args, context) => { /* ... */ },
  }];
}
```

## Plugin Lifecycle

1. **Instantiation**: `new MyPlugin()` in `src/plugins/loader.ts`
2. **Registration**: Added to `PluginRegistry`
3. **Dependency sorting**: `topologicalSort()` based on `metadata.dependencies`
4. **Initialization**: `plugin.init(context)` called in dependency order
5. **Contribution collection**: Registry collects all contributions
6. **Runtime**: Contributions are active (tools available, prompts injected)
7. **Shutdown**: `plugin.destroy()` called on exit

## Adding a New Plugin

1. Create directory: `src/plugins/my-plugin/`
2. Implement `Plugin` interface in `index.ts`
3. Define tools in `tools.ts` with Zod schemas
4. Add executors in `executors.ts`
5. Register in `src/plugins/loader.ts`:
   ```typescript
   import { MyPlugin } from './my-plugin';
   // Add to loadBuiltinPlugins() array
   ```

## Plugin Categories

| Category | ID Prefix | Examples |
|----------|-----------|---------|
| Core | `core.*` | bash, filesystem, code-editor, providers |
| Feature | `feature.*` | git, explore, planning, wallet, heartbeat |
| Connector | `connector.*` | telegram, discord |
