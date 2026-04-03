# Runner Specification

> Source of truth for the SlashbotRunner embedding API.
> Last updated: 2026-04-03

## Overview

The runner module makes slashbot embeddable as a TypeScript module within external Node.js services (e.g., agent-service). Instead of spawning a `claude` CLI subprocess, a host service imports `SlashbotRunner` directly and calls `executeStep(payload)` to receive a stream of typed events.

This domain covers the embedding API contract, event protocol, plugin routing, and Node.js runtime compatibility. All Atelier Runner features (02–06) build on this interface.

## Features

### Slashbot Runner Module

> Added: 2026-04-03 | Source: specs/013-slashbot-runner-module/

#### User Stories

1. **Step invocation via embedded module** — Agent-service imports `SlashbotRunner`, calls `executeStep(payload)`, and iterates the returned `AsyncIterator<RunnerEvent>` to consume `output_chunk`, `ask_user`, `step_complete`, and `error` events. The downstream agent-service ↔ Spring Boot protocol requires no changes.

2. **Plugin registry step-type routing** — `executeStep` reads `payload.stepType` to look up the registered plugin. A default plugin handles unknown step types. If no match and no default, an `error` event is yielded with a descriptive message.

3. **Node.js runtime compatibility** — The module is importable and executable in Node.js 20 via a compiled CJS bundle (`bun build --target=node`). No changes to the agent-service build pipeline are required.

#### Business Rules

- `executeStep` MUST yield events; it MUST NOT throw to the caller under any circumstances.
- Plugin errors are caught and emitted as `error` RunnerEvents.
- Concurrent `executeStep` calls are fully isolated — no event cross-contamination between steps.
- `StepPayload.credentials` MUST NOT appear in any log output or error message.
- The plugin registry is write-once at startup; read-only during execution (no locks needed).
- Runtime compatibility strategy: `bun build --target=node` (Strategy A) is canonical; Bun binary embed (Strategy B) is fallback.

#### Entities

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `StepPayload` | `stepType`, `prompt`, `model`, `workspacePath`, `credentials`, `metadata?` | Validated with Zod at entry point |
| `RunnerEvent` | `type` discriminant: `output_chunk`, `ask_user`, `step_complete`, `error` | Discriminated union |
| `OutputChunkEvent` | `type: 'output_chunk'`, `content: string` | Streaming text chunk |
| `AskUserEvent` | `type: 'ask_user'`, `question: string`, `callbackId: string` | Mid-stream human-in-the-loop |
| `StepCompleteEvent` | `type: 'step_complete'`, `result: string` | Terminal event — iterator closes after |
| `ErrorEvent` | `type: 'error'`, `message: string`, `code?: string` | Terminal event — never throws |
| `RunnerPlugin` | `stepTypes: string[]`, `execute(payload): AsyncIterator<RunnerEvent>` | Implemented by feature plugins (e.g., Feature 02) |
| `IPluginRegistry` | `register`, `registerDefault`, `getPlugin` | Interface; `PluginRegistry` is the default impl |
| `SlashbotRunner` | `executeStep(payload)`, `registry: IPluginRegistry` | Top-level export; stateless between calls |
| `RUNNER_ERRORS` | `NO_PLUGIN`, `INVALID_PAYLOAD`, `PLUGIN_ERROR`, `INIT_ERROR` | Error code constants |

#### API Contracts

**Module exports** (`src/runner/index.ts`):
```typescript
export { SlashbotRunner, PluginRegistry, StepPayloadSchema, RUNNER_ERRORS };
export type {
  StepPayload, RunnerEvent,
  OutputChunkEvent, AskUserEvent, StepCompleteEvent, ErrorEvent,
  RunnerPlugin, IPluginRegistry, ISlashbotRunner
};
```

**Build target** (`package.json`):
```json
"runner:build": "bun build src/runner/index.ts --target=node --outfile=dist/runner.cjs --format=cjs",
"runner:test:compat": "node tests/runner/node-compat.mjs"
```

**Error events**:

| Code | Trigger | Message pattern |
|------|---------|----------------|
| `NO_PLUGIN` | No plugin for `stepType`, no default | `"No plugin registered for step type: {type}"` |
| `INVALID_PAYLOAD` | Zod parse failure | `"Invalid payload: {field} is required"` |
| `PLUGIN_ERROR` | Plugin `execute()` throws | `"Plugin execution failed: {message}"` |
| `INIT_ERROR` | DI container bootstrap fails | `"Runner initialization failed: {message}"` |

#### Performance Targets

| Metric | Target |
|--------|--------|
| Runner init (first call) | < 2s |
| First event latency | < 200ms from plugin start |
| `executeStep` routing overhead | < 10ms |
| Concurrent steps | ≥ 10 simultaneous |

#### Security

- `credentials` injected per-call; never stored in module state.
- Credential values MUST NOT appear in logs, errors, or stack traces.
- Each `executeStep` creates a new generator context — no shared mutable state.
- Zod validates `StepPayload` at the public boundary before plugin dispatch.

#### Success Criteria

- `SlashbotRunner` imports without error in Node.js 20 (`dist/runner.cjs`).
- 10 concurrent `executeStep` calls produce isolated event streams (verified by integration test).
- Unknown `stepType` returns `error` RunnerEvent within 5ms.
- `executeStep` routing overhead < 10ms (excluding plugin execution).

---

## Integration Notes

- **agent-service shim**: `src/slashbot/runner.ts` (single file; converts `RunnerEvent` objects to NDJSON format for the existing orchestratorOutputParser).
- **Relation to SlashbotPlugin**: `RunnerPlugin` and `SlashbotPlugin` are separate interfaces. The runner module does not use the existing plugin initialization pipeline.
- **Future features**: Features 02–06 (idea-006) register `RunnerPlugin` implementations against this registry. Feature 02 (claude-code plugin) is the first consumer.

> See also: [Core architecture](/docs/core/spec.md) | [Plugin system](/docs/plugins/spec.md)
