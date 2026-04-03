# Feature Specification: Slashbot Runner Module

**Feature Branch**: `013-slashbot-runner-module`
**Created**: 2026-04-03
**Status**: Draft
**Source**: [Feature 01](../../ideas/006-slashbot-atelier-runner/features/01-slashbot-runner-module.md)
**Parent Idea**: [idea.md](../../ideas/006-slashbot-atelier-runner/idea.md)

<!--
  CONSTITUTION COMPLIANCE (v1.0.0)
  ================================
  MANDATORY SECTIONS: User Scenarios, Requirements, Error Scenarios, Success Criteria
  CONDITIONAL SECTIONS:
    - Accessibility: N/A — no UI
    - Performance: YES — streaming latency, initialization cost
    - Security: YES — credential injection from host environment
    - Data & State: YES — stateless module design (initialization scope)
-->

## Summary

Make slashbot embeddable as a TypeScript module within agent-service (a Node.js service). Agent-service invokes slashbot via `SlashbotRunner.executeStep(payload)` instead of spawning `claude cli` directly. This is the foundational integration point — all other Atelier Runner features (Feature 02–06) build on this interface.

The feature covers three concerns:
1. Defining the `executeStep(payload): AsyncGenerator<RunnerEvent>` interface and its event contract.
2. Resolving the runtime compatibility problem (Bun vs Node.js 20).
3. Implementing a minimal plugin registry for step-type routing inside slashbot.

## Clarifications

### Session 2026-04-03

- **Q: Does the RunnerPlugin interface conflict with the existing SlashbotPlugin interface?** → A: No. They are separate concerns. `SlashbotPlugin` is slashbot's internal extension mechanism (setup, contribute tools/prompts, etc.). `RunnerPlugin` is a new, lightweight interface used only by the runner module to route `executeStep` calls. The runner module does not re-use the existing plugin initialization pipeline for routing.

- **Q: Does the runner module need to initialize `SlashbotKernel` (full kernel with TUI, connectors, etc.)?** → A: No for Phase 1. The runner module is a stateless router; it does not need the full kernel. A minimal initialization (just the PluginRegistry, basic service registry) is sufficient. Full kernel initialization is deferred to Feature 02 (claude-code plugin) which may need the agent loop.

- **Q: The architecture registry mentions InversifyJS, but the actual code uses a manual service registry (`PluginRegistrationContext.getService()`). Which applies here?** → A: The manual service registry is the actual implementation. The architecture registry is outdated on this point. The runner module should use the same manual service registry pattern, not InversifyJS.

- **Q: How is the runner module initialized in the Node.js context?** → A: The runner module is fully stateless at Phase 1 — no `SlashbotKernel` initialization is needed. `SlashbotRunner` and `PluginRegistry` are plain TypeScript classes with no kernel dependency. Kernel integration (for the agent loop) is deferred to Feature 02 (claude-code plugin), which may introduce a `SlashbotKernel.createHeadless()` entry point if needed.

- **Q: Does `node-pty` (used by Feature 02's claude-code plugin) need to load at runner module import time?** → A: No. `node-pty` is only needed when a plugin that uses PTY is registered and invoked. The runner module itself has no PTY dependency. Native module loading is deferred to plugin initialization.

- **Q: Should `RunnerEvent` format be identical to the NDJSON format agent-service's `orchestratorOutputParser.ts` expects?** → A: Recommended default: runner emits typed `RunnerEvent` objects; the shim in `src/slashbot/runner.ts` handles conversion to the NDJSON format expected by the existing parser. This keeps the runner module protocol-agnostic and agent-service responsible for protocol compatibility.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Step Invocation via Embedded Module (Priority: P1)

Agent-service imports the slashbot runner shim and calls `executeStep(payload)`. It receives an `AsyncIterator<RunnerEvent>` and iterates it to consume events — `output_chunk`, `ask_user`, `step_complete`, or `error`. The existing downstream processing in agent-service (forwarding to Redis / WebSocket) consumes these events without requiring changes to the agent-service ↔ Spring Boot protocol.

**Why this priority**: This is the entire purpose of the feature. Nothing else can be built without a callable interface that returns typed events.

**Independent Test**: Can be tested by instantiating SlashbotRunner with a stub plugin registered, calling `executeStep({ prompt: "hello", stepType: "stub", ... })`, and asserting that `step_complete` event is received as the final item from the iterator.

**Acceptance Scenarios**:

1. **Given** agent-service imports `SlashbotRunner` and calls `executeStep(payload)`, **When** the registered plugin completes successfully, **Then** the iterator yields one or more `output_chunk` events followed by a `step_complete` event, and then closes.
2. **Given** agent-service calls `executeStep(payload)`, **When** the registered plugin emits an `ask_user` event, **Then** the iterator yields the `ask_user` event and pauses until a response is injected (or the caller moves on per feature 04 scope).
3. **Given** agent-service calls `executeStep(payload)`, **When** the plugin throws or rejects, **Then** the iterator yields a single `error` event with a non-empty `message` field, and then closes without throwing on the caller side.
4. **Given** `executeStep` is called concurrently for two different steps, **When** both complete, **Then** each call returns an independent iterator with no event cross-contamination.

---

### User Story 2 - Plugin Registry Step-Type Routing (Priority: P1)

When slashbot receives a `StepPayload`, it reads `payload.stepType` to look up the registered plugin. A default plugin can be registered to handle unknown step types. If no plugin matches and no default is set, the iterator yields a descriptive `error` event.

**Why this priority**: Without a routing mechanism, the module would be hardcoded to one executor. The registry is required even for a minimal MVP so that Feature 02 (claude-code plugin) can register itself cleanly.

**Independent Test**: Can be tested by registering two stub plugins under different `stepTypes` and verifying each is invoked only for matching payloads.

**Acceptance Scenarios**:

1. **Given** a plugin is registered for `stepType: "claude-code"`, **When** `executeStep({ stepType: "claude-code", ... })` is called, **Then** the claude-code plugin's executor runs and its events flow through the iterator.
2. **Given** no plugin is registered for `stepType: "unknown-type"` and no default plugin exists, **When** `executeStep({ stepType: "unknown-type", ... })` is called, **Then** the iterator yields an `error` event with `message` containing "No plugin registered for step type: unknown-type".
3. **Given** a default plugin is registered via `registerDefault(plugin)`, **When** `executeStep({ stepType: "unregistered", ... })` is called, **Then** the default plugin runs.
4. **Given** a plugin is registered, **When** `getPlugin(stepType)` is called, **Then** it returns the plugin or `undefined` without side effects.

---

### User Story 3 - Runtime Compatibility (Priority: P1)

The SlashbotRunner module is importable and executable within the Node.js 20 runtime used by agent-service, without requiring changes to the agent-service build pipeline. The compatibility strategy (compiled bundle vs. embedded Bun) is decided and implemented as part of this feature.

**Why this priority**: A fundamental blocker. If the module cannot be imported, nothing works.

**Independent Test**: Can be tested by running a minimal Node.js 20 script that imports the compiled/packaged SlashbotRunner and calls `executeStep` with a stub payload, asserting no runtime errors.

**Acceptance Scenarios**:

1. **Given** slashbot is built with the chosen compatibility strategy (see FR-007), **When** a Node.js 20 process executes `import { SlashbotRunner } from './slashbot/runner'`, **Then** no import-time errors occur and `SlashbotRunner.executeStep` is a callable function.
2. **Given** the runtime compatibility strategy is "bun build --target=node", **When** the bundle is required in Node.js 20, **Then** Bun-specific APIs not available in Node.js (e.g., `Bun.serve`, `Bun.file`) are absent from the public interface of the runner module.
3. **Given** the runtime compatibility strategy is "embed Bun binary in agent-service container", **When** agent-service starts, **Then** it can spawn the Bun-based runner subprocess and communicate with it via the defined IPC interface within 500ms initialization window.
4. **Given** the runtime is resolved, **When** native dependencies (`node-pty`) are required by a plugin, **Then** they load correctly in the target runtime (Node.js 20 or Bun as applicable).

---

### Edge Cases

- What happens when `executeStep` is called before `SlashbotRunner` is initialized?
- How does the module behave when the DI container fails to initialize (missing required services)?
- What happens if a plugin's `execute()` method never yields `step_complete`? (timeout / dangling iterator)
- How is `stepType` matched — exact string match, case-insensitive, or configurable?

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User-Facing Message (RunnerEvent) | Recovery |
|----------------|-----------------------------------|----------|
| No plugin for step type | `error` event: "No plugin registered for step type: {type}" | Register a plugin or use default |
| Plugin execution throws | `error` event: "Plugin execution failed: {message}" | Check plugin implementation; error is non-fatal to module |
| DI container initialization failure | `error` event emitted on first `executeStep` call: "Runner initialization failed: {message}" | Fix container configuration; restart agent-service |
| Native dependency load failure (node-pty) | `error` event: "Native dependency unavailable: {dep}" | Ensure runtime-compatible build was used |
| `executeStep` called with missing required fields | `error` event: "Invalid payload: {field} is required" | Provide all required StepPayload fields |
| Iterator abandoned mid-stream | Plugin receives abort signal; cleanup runs | No user action needed; resources freed automatically |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SlashbotRunner MUST export an `executeStep(payload: StepPayload): AsyncGenerator<RunnerEvent>` function as its primary public API (`AsyncGenerator` extends `AsyncIterableIterator`; callers may treat it as an `AsyncIterator<RunnerEvent>`).
- **FR-002**: `StepPayload` MUST include at minimum: `stepType: string`, `prompt: string`, `model: string`, `workspacePath: string`, and `credentials: Record<string, string>`.
- **FR-003**: `RunnerEvent` MUST be a discriminated union type with `type` discriminant field covering: `output_chunk`, `ask_user`, `step_complete`, and `error`.
- **FR-004**: SlashbotRunner MUST expose a `PluginRegistry` with `register(stepType: string, plugin: RunnerPlugin): void`, `registerDefault(plugin: RunnerPlugin): void`, and `getPlugin(stepType: string): RunnerPlugin | undefined` methods.
- **FR-005**: When no plugin is registered for a given `stepType` and no default plugin is set, `executeStep` MUST yield an `error` event (never throw).
- **FR-006**: Plugin execution errors MUST be caught and emitted as `error` RunnerEvents; they MUST NOT propagate as uncaught exceptions to the caller.
- **FR-007**: The runtime compatibility strategy MUST be one of: (A) `bun build --target=node` producing a CommonJS/ESM bundle importable by Node.js 20, or (B) Bun binary embedded in the agent-service Docker container with IPC bridge. Strategy A is preferred; strategy B is the fallback if strategy A fails due to native dependency constraints.
- **FR-008**: The shim entry point in agent-service MUST be a single file: `src/slashbot/runner.ts`. No major restructuring of agent-service is permitted.
- **FR-009**: `StepPayload.credentials` MUST be forwarded to plugins via environment variable injection or equivalent, not stored in slashbot module state.
- **FR-010**: SlashbotRunner initialization (DI container bootstrap, plugin registry setup) MUST complete within 2 seconds of first call.
- **FR-011**: The `RunnerEvent.output_chunk` type MUST carry a `content: string` field; `RunnerEvent.step_complete` MUST carry a `result: string` field; `RunnerEvent.error` MUST carry a `message: string` and optional `code?: string` field; `RunnerEvent.ask_user` MUST carry a `question: string` and `callbackId: string` field.
- **FR-012**: Concurrent `executeStep` calls MUST be isolated — events from one step MUST NOT appear in another step's iterator.

### Key Entities

- **StepPayload**: Input to `executeStep`. Fields: `stepType`, `prompt`, `model`, `workspacePath`, `credentials`, optional `metadata`.
- **RunnerEvent**: Discriminated union output from the iterator. Subtypes: `OutputChunkEvent`, `AskUserEvent`, `StepCompleteEvent`, `ErrorEvent`.
- **RunnerPlugin**: Interface for step executors. Fields: `stepTypes: string[]`, `execute(payload: StepPayload): AsyncIterator<RunnerEvent>`.
- **PluginRegistry**: Registry mapping step types to plugins. Methods: `register`, `registerDefault`, `getPlugin`.
- **SlashbotRunner**: Top-level module export. Methods: `executeStep`, `registry` (PluginRegistry accessor), `init` (optional explicit initialization).

## Performance Requirements

| Metric | Target | Justification |
|--------|--------|---------------|
| Runner initialization time | < 2s | Constitution default for plugin init; module bootstraps DI container once |
| First event latency | < 200ms from plugin start | Constitution default for streaming; plugin execution startup overhead |
| `executeStep` call overhead (excluding plugin execution) | < 10ms | Internal routing and iterator setup must not add perceptible lag |
| Concurrent steps supported | ≥ 10 simultaneously | agent-service can handle parallel workflow nodes |

## Security Considerations

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Credential leakage | `credentials` injected per-call; never stored in module state | Plugins receive credentials as parameter, not via shared state |
| Credential logging | `credentials` values MUST NOT appear in any log output | Mask or omit credential fields in all logging paths |
| Shell injection via prompt | Plugin implementations (Feature 02) validate prompt before shell invocation | Runner module enforces Zod validation on `StepPayload` at boundary |
| Cross-step data leakage | Per-call iterator isolation; no shared mutable state between concurrent steps | Each `executeStep` creates a new generator context |
| Host process crash | Plugin errors caught and converted to RunnerEvents; no uncaught exceptions | Try/catch wraps all plugin `execute()` calls |

## Data & State

- **Stateless module design**: SlashbotRunner is stateless between calls. No step results, no conversation history, no session persistence in this module.
- **Initialization state**: A single DI container instance is created on first use (lazy initialization) and reused across calls. This is module-scoped, not call-scoped.
- **Plugin registry**: Module-scoped. Populated once at agent-service startup. Not modified at runtime.
- **Step execution state**: Each `executeStep` call is a self-contained generator. State lives only for the duration of the iterator's lifetime.
- **Credentials**: Passed per-call, used within plugin execution scope, never persisted.
- **Data ownership**: agent-service owns session state; slashbot owns nothing.
- **Retention policy**: No data retained by the runner module. agent-service is responsible for persistence.
- **Concurrent modification**: Plugin registry is write-once (at startup). Read-only during execution. No locks needed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An existing Atelier workflow executes via slashbot-backed agent-service without modification to the agent-service ↔ Spring Boot protocol.
- **SC-002**: `executeStep` returns the first `RunnerEvent` within 200ms of plugin execution starting (excluding plugin's own LLM round-trip time).
- **SC-003**: SlashbotRunner module imports without error in a Node.js 20 environment using the chosen runtime compatibility strategy.
- **SC-004**: 10 concurrent `executeStep` calls complete without cross-contamination of events (verified by integration test).
- **SC-005**: Plugin registration and step routing adds < 10ms overhead per call (measured without plugin execution).
- **SC-006**: An unknown `stepType` returns an `error` RunnerEvent with descriptive message within 5ms (no async work needed).
