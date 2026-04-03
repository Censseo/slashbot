# Data Model: Slashbot Runner Module

**Branch**: `013-slashbot-runner-module`
**Date**: 2026-04-03

## Entities

### StepPayload

Input to `SlashbotRunner.executeStep()`. Carries all information needed by any plugin to execute a step.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stepType` | `string` | Yes | Plugin lookup key. e.g. `"claude-code"`, `"http-call"` |
| `prompt` | `string` | Yes | Instruction or query for the step |
| `model` | `string` | Yes | LLM model identifier. e.g. `"claude-opus-4-6"` |
| `workspacePath` | `string` | Yes | Absolute path to workspace directory |
| `credentials` | `Record<string, string>` | Yes | Env vars: API keys, OAuth tokens, etc. Never logged |
| `metadata` | `Record<string, unknown>` | No | Optional step-specific context (workflow node ID, etc.) |

**Invariants**:
- `stepType` is case-sensitive, exact match
- `workspacePath` must be a non-empty string (validation at boundary; plugin is responsible for path existence)
- `credentials` values must never appear in logs or error messages

### RunnerEvent

Discriminated union type for all events emitted by `executeStep`. Uses `type` as discriminant.

#### OutputChunkEvent

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'output_chunk'` | Yes | Discriminant |
| `content` | `string` | Yes | Text content of the output chunk |
| `timestamp` | `number` | No | Unix epoch milliseconds |

#### AskUserEvent

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'ask_user'` | Yes | Discriminant |
| `question` | `string` | Yes | Question text directed at the user |
| `callbackId` | `string` | Yes | Unique ID for routing the callback response (Feature 04) |
| `timestamp` | `number` | No | Unix epoch milliseconds |

#### StepCompleteEvent

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'step_complete'` | Yes | Discriminant |
| `result` | `string` | Yes | Summary result text |
| `exitCode` | `number` | No | Exit code of subprocess (if applicable) |
| `timestamp` | `number` | No | Unix epoch milliseconds |

#### ErrorEvent

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'error'` | Yes | Discriminant |
| `message` | `string` | Yes | Human-readable error description |
| `code` | `string` | No | Machine-readable error code (e.g. `"NO_PLUGIN"`, `"PLUGIN_ERROR"`) |
| `timestamp` | `number` | No | Unix epoch milliseconds |

**Event lifecycle invariant**: The final event in any step's iterator MUST be either `step_complete` or `error`. An iterator that closes without one of these is a plugin bug.

### RunnerPlugin

Interface for step executor implementations. Plugins are registered in `PluginRegistry`.

| Field | Type | Description |
|-------|------|-------------|
| `stepTypes` | `readonly string[]` | Step types this plugin handles (informational; registry uses explicit registration key) |
| `execute` | `(payload: StepPayload) => AsyncGenerator<RunnerEvent>` | Executes the step and yields events |

### PluginRegistry

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(stepType: string, plugin: RunnerPlugin): void` | Register plugin for exact step type |
| `registerDefault` | `(plugin: RunnerPlugin): void` | Register fallback plugin for unknown step types |
| `getPlugin` | `(stepType: string): RunnerPlugin \| undefined` | Look up plugin (returns default if no exact match; returns undefined if no default) |

**Registry invariants**:
- Registering the same `stepType` twice overwrites the previous registration (last-write-wins)
- Default plugin is also overwritten on repeated `registerDefault` calls
- Registry is write-once at startup in practice (not enforced by the class, enforced by convention)

### SlashbotRunner

| Member | Type | Description |
|--------|------|-------------|
| `registry` | `PluginRegistry` | Read-only access to the plugin registry |
| `executeStep` | `(payload: StepPayload) => AsyncGenerator<RunnerEvent>` | Main entry point |

## Relationships

```text
caller
  └─ calls ──► SlashbotRunner.executeStep(StepPayload)
                    │
                    ├─ validates ──► StepPayload (Zod schema)
                    │
                    └─ queries ──► PluginRegistry
                                        │
                                        └─ returns ──► RunnerPlugin
                                                            │
                                                            └─ yields ──► RunnerEvent[]
```

## State Management

The runner module is intentionally stateless:

| Component | State | Scope |
|-----------|-------|-------|
| `SlashbotRunner` instance | `registry` reference only | Module-scoped singleton |
| `PluginRegistry` | Plugin map | Module-scoped; populated at startup |
| `executeStep` call | AsyncGenerator context | Per-call; GC'd when iterator closes |
| `StepPayload` | Call argument | Per-call only; not retained |
| `credentials` | Per-call; passed to plugin | Never stored; not logged |

## Schema (Zod)

```typescript
// StepPayload Zod schema
const StepPayloadSchema = z.object({
  stepType: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().min(1),
  workspacePath: z.string().min(1),
  credentials: z.record(z.string(), z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```
