# Implementation Plan: Slashbot Runner Module

**Branch**: `013-slashbot-runner-module` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-slashbot-runner-module/spec.md`

## Summary

Add a self-contained `src/runner/` module to slashbot that exposes `executeStep(payload: StepPayload): AsyncIterator<RunnerEvent>`. This module is the integration point for embedding slashbot inside agent-service (Node.js 20). It includes: typed interfaces (`StepPayload`, `RunnerEvent`, `RunnerPlugin`), a `PluginRegistry` for step-type routing, a `SlashbotRunner` class orchestrating execution, and a Node.js-compatible build target.

No changes to the existing plugin system, kernel, or any UI component are required.

## Technical Context

**Language/Version**: TypeScript (strict mode), Bun 1.0+ (dev/test), Node.js 20 (target runtime via compiled bundle)
**Primary Dependencies**: None new — pure TypeScript, no external packages needed for the runner module itself
**Storage**: N/A — stateless module
**Testing**: Vitest (`bun run test`)
**Target Platform**: (a) Slashbot repo: Bun runtime; (b) Distribution: Node.js 20 compatible CJS bundle via `bun build --target=node`
**Project Type**: Single project (addition to existing slashbot monorepo)
**Performance Goals**: `executeStep` routing overhead < 10ms; first event latency < 200ms from plugin start
**Constraints**: No changes to existing Plugin/kernel interfaces; shim must be a single file; runtime strategy A (bun build --target=node) first
**Scale/Scope**: Supports ≥ 10 concurrent `executeStep` calls; 1 step type per call

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **Plugin-First** | ✅ PASS | `RunnerPlugin` is a new concept distinct from `SlashbotPlugin`; runner module is slashbot infrastructure, not a feature plugin |
| **Library-First** | ✅ PASS | `PluginRegistry` and `SlashbotRunner` are plain injectable classes, testable without plugin framework |
| **Test-First (TDD)** | ✅ PASS | Test tasks precede implementation tasks in all phases |
| **Simplicity (YAGNI)** | ✅ PASS | No speculative features; registry is minimal; no DI container needed |
| **Security — credential handling** | ✅ PASS | Credentials are per-call, never stored in module state; validated at boundary |
| **Security — input validation** | ✅ PASS | `StepPayload` validated with Zod at `executeStep` entry point |
| **Error Handling** | ✅ PASS | All plugin errors caught and emitted as `RunnerEvent.error`; never thrown |
| **Performance thresholds defined** | ✅ PASS | spec.md defines measurable targets |
| **Accessibility** | N/A | No UI component |
| **Data minimization** | ✅ PASS | Stateless; no persistence |
| **License compliance** | ✅ PASS | No new dependencies |

## Project Structure

### Documentation (this feature)

```text
specs/013-slashbot-runner-module/
├── spec.md              ✅ Created
├── research.md          ✅ Created
├── plan.md              ✅ This file
├── data-model.md        (Phase 1 output)
├── contracts/           (Phase 1 output)
│   └── runner-types.ts  (Canonical type definitions)
└── tasks.md             (Phase 2 output — /specforge.tasks)
```

### Source Code

```text
src/
└── runner/
    ├── types.ts          # StepPayload, RunnerEvent union, RunnerPlugin interface
    ├── registry.ts       # PluginRegistry class (register, registerDefault, getPlugin)
    ├── runner.ts         # SlashbotRunner class (executeStep, init, registry accessor)
    └── index.ts          # Public exports

tests/
└── runner/
    ├── types.test.ts     # Zod schema validation tests
    ├── registry.test.ts  # PluginRegistry unit tests
    └── runner.test.ts    # SlashbotRunner integration tests

# Modified:
package.json              # Add runner:build script (bun build --target=node)
```

**Structure Decision**: Single project, new `src/runner/` directory alongside existing `src/core/` and `src/plugins/`. This is a peer module, not a core module — it depends on nothing from core at Phase 1 (future phases may import agent-loop types).

## Phase 0: Research ✅ Complete

See [research.md](./research.md).

**Key findings**:
1. No existing runner/step concept in slashbot — building from scratch
2. Manual service registry (not InversifyJS) in current kernel
3. Strategy A (`bun build --target=node`) is viable for this feature (no native deps)
4. Runner module is stateless — no DI/kernel init needed at this phase
5. `SlashbotPlugin` ≠ `RunnerPlugin` — separate abstraction

## Phase 1: Design

### Data Model

The runner module defines 5 core types:

**StepPayload** (input):
```typescript
{
  stepType: string;           // e.g. "claude-code", "http-call"
  prompt: string;             // Instruction / query for the step
  model: string;              // LLM model identifier
  workspacePath: string;      // Working directory for the step
  credentials: Record<string, string>; // Env vars (API keys, OAuth tokens)
  metadata?: Record<string, unknown>;  // Optional step-specific data
}
```

**RunnerEvent** (discriminated union output):
```typescript
type RunnerEvent =
  | { type: 'output_chunk'; content: string; timestamp?: number }
  | { type: 'ask_user'; question: string; callbackId: string; timestamp?: number }
  | { type: 'step_complete'; result: string; exitCode?: number; timestamp?: number }
  | { type: 'error'; message: string; code?: string; timestamp?: number }
```

**RunnerPlugin** (executor interface):
```typescript
interface RunnerPlugin {
  readonly stepTypes: readonly string[];
  execute(payload: StepPayload): AsyncGenerator<RunnerEvent>;
}
```

**PluginRegistry** (router):
```typescript
class PluginRegistry {
  register(stepType: string, plugin: RunnerPlugin): void;
  registerDefault(plugin: RunnerPlugin): void;
  getPlugin(stepType: string): RunnerPlugin | undefined;
}
```

**SlashbotRunner** (entry point):
```typescript
class SlashbotRunner {
  readonly registry: PluginRegistry;
  executeStep(payload: StepPayload): AsyncGenerator<RunnerEvent>;
}
```

### Execution Flow

```text
caller
  │
  ▼
SlashbotRunner.executeStep(payload)
  │
  ├─ Validate payload (Zod schema) ──► error RunnerEvent if invalid
  │
  ├─ registry.getPlugin(payload.stepType)
  │     ├─ found → delegate to plugin.execute(payload)
  │     └─ not found → yield error RunnerEvent "No plugin for step type: X"
  │
  ├─ try {
  │     for await (const event of plugin.execute(payload)) {
  │       yield event;
  │     }
  │   } catch (err) {
  │     yield { type: 'error', message: `Plugin execution failed: ${err.message}` }
  │   }
  │
  └─ iterator closes
```

### Build Target

A new npm script `runner:build` in `package.json`:
```json
"runner:build": "bun build src/runner/index.ts --target=node --outfile=dist/runner.cjs --format=cjs"
```

This produces `dist/runner.cjs` importable by Node.js 20:
```typescript
// In agent-service: src/slashbot/runner.ts
const { SlashbotRunner } = require('../../path/to/dist/runner.cjs');
```

### Interface Contracts

See `contracts/runner-types.ts` (generated in Phase 1 output).

## Phase 2: Task Planning

Tasks will be generated by `/specforge.tasks`. High-level approach:

**Phase 1 (Setup)**: Create `src/runner/` directory structure, add build script to `package.json`

**Phase 2 (Foundational)**: Define and validate `RunnerEvent` union type and `StepPayload` Zod schema — all other code depends on these types

**Phase 3 (US2 — Plugin Registry)**: Implement `PluginRegistry` with register/registerDefault/getPlugin — enables plugin routing

**Phase 4 (US1 — Runner Core)**: Implement `SlashbotRunner.executeStep()` with validation, routing, error isolation, and concurrency safety

**Phase 5 (US3 — Build Target)**: Add and validate `bun build --target=node` build script; integration test in Node.js 20 context

**Phase 6 (Polish)**: Export cleanup, documentation, Zod validation edge cases

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete
- [x] Phase 1: Design complete
- [ ] Phase 2: Task planning complete (/specforge.tasks)
- [ ] Phase 3: Implementation complete
- [ ] Phase 4: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations: none
