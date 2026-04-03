# Research: Slashbot Runner Module

**Branch**: `013-slashbot-runner-module`
**Date**: 2026-04-03
**Phase**: Phase 0 — Research

---

## 1. Slashbot Plugin Architecture (Current State)

### Plugin Interface

**File**: `src/core/kernel/contracts.ts`

```typescript
export interface SlashbotPlugin {
  manifest: PluginManifest;
  setup: (context: PluginRegistrationContext) => Promise<void> | void;
  activate?: () => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
}
```

Key findings:
- **No InversifyJS in the plugin initialization path**: The kernel uses a manual `ServiceRegistry` (via `src/core/kernel/registries.ts`) and exposes services via `PluginRegistrationContext.getService()`. InversifyJS may exist in `src/core/di/` as a legacy or experimental module, but the active plugin system does not use it.
- **Plugins register capabilities** (tools, commands, hooks, providers, routes, gateway methods, services) via `PluginRegistrationContext`.
- **Plugin lifecycle**: `setup()` → `activate()` → (runtime) → `deactivate()`.
- **Topological ordering**: `sortPlugins()` uses Kahn's algorithm + `manifest.priority` + lexicographic tiebreaker.

### Kernel Initialization

**File**: `src/core/kernel/kernel.ts`

```typescript
export interface KernelCreateOptions {
  workspaceRoot: string;
  flags?: RuntimeFlags;
  bundledPlugins?: Record<string, BundledPluginFactory>;
  bundledDiscovered?: DiscoveredPlugin[];
}
```

The kernel is initialized via `SlashbotKernel.create(options)` and then `bootKernel()`. Currently this implies:
- Full plugin discovery (`discoverPlugins()`)
- Full provider catalog setup (`fetchGatewayCatalog()`)
- TUI / CLI init happens in the CLI layer (`src/ui/cli.ts`), not in the kernel itself

**Key insight**: The kernel can theoretically be initialized in a headless context if plugin discovery is limited to only the required plugins. There is no TUI/connector-specific code in the kernel bootstrap itself.

### No Existing "Runner" Concept

There is no existing `runner`, `executor`, or `step` abstraction in the slashbot codebase. The closest concept is the `AgentLoopResult` in `src/core/agentic/` (agent loop for LLM interactions) — but this is the LLM orchestration layer, not a step routing layer.

The `RunnerPlugin` and `PluginRegistry` interfaces for this feature are **new additions** — they are not part of the existing plugin system. They live in a separate module (`src/runner/`) rather than replacing or extending `SlashbotPlugin`.

---

## 2. Runtime Compatibility Analysis

### The Problem

Slashbot is built for Bun runtime (Bun 1.0+). Agent-service runs on Node.js 20. The two runtimes are incompatible in subtle ways:

| Area | Bun | Node.js 20 |
|------|-----|------------|
| Module system | ESM + CJS | ESM + CJS (compatible) |
| Built-in APIs | `Bun.*` namespace | Not available |
| Native bindings | Bun FFI / native | N-API (node-gyp) |
| `node-pty` | Works via Bun spawn | Works via node-gyp |
| `bun build --target=node` | Outputs CJS/ESM bundle | Compatible with Node.js |

### Strategy A: `bun build --target=node`

Slashbot's runner module is compiled to a Node.js-compatible bundle using `bun build --target=node`. This produces a standard CJS/ESM bundle.

**Feasibility**:
- Works if the runner module does NOT use `Bun.*` namespace APIs directly
- `node-pty` (used by Feature 02, not this feature) requires N-API binding — this is compatible with both Node.js and can work if built for Node.js target
- Risk: Any transitive Bun-specific API usage in slashbot's core would fail at runtime
- The runner module itself (routing only, no PTY) has no Bun-specific APIs → Strategy A is viable for this feature

**Verdict**: **Strategy A is the primary approach** for the runner module. The compiled bundle exposes `SlashbotRunner` as a CJS/ESM module.

### Strategy B: Bun Binary Embedded in Container

Agent-service's Docker container includes the Bun binary alongside Node.js. The runner module is invoked via a Bun subprocess, communicating over IPC (stdin/stdout NDJSON or Unix socket).

**Feasibility**:
- Definitely works (Bun and Node.js coexist in a container)
- Adds IPC overhead (~10ms round-trip for local IPC)
- More complex architecture (process management, graceful shutdown)
- Required if Strategy A fails due to native bindings (node-pty) in Feature 02

**Verdict**: **Strategy B is the fallback**. Not needed for this feature (no PTY) but the shim should be designed to support either strategy transparently.

### Decision for This Feature

**Strategy A** for the runner module core (no native deps at this level). The shim in `src/slashbot/runner.ts` abstracts the strategy so Feature 02 can switch to Strategy B without changing the interface.

---

## 3. Agent-Service Protocol (Referenced Knowledge)

Based on idea.md and feature spec, agent-service currently:
1. Receives `POST /sessions/start` with step payload from Spring Boot
2. Invokes `orchestratorExecutor.ts` which spawns `claude cli` directly via `node-pty`
3. Parses PTY output through `orchestratorOutputParser.ts` (NDJSON format)
4. Forwards parsed events to Redis → WebSocket → UI

The shim (`src/slashbot/runner.ts` in agent-service) will:
1. Import `SlashbotRunner` from the compiled slashbot bundle
2. Call `executeStep(payload)` where payload maps from the existing agent-service payload
3. Receive `RunnerEvent` objects and convert them to the existing NDJSON format
4. Feed converted events to the existing downstream pipeline (Redis/WebSocket)

**NDJSON event types in the existing protocol** (inferred from context):
- `output_chunk` → maps to PTY output lines
- `step_complete` → maps to process exit event
- `ask_user` → maps to existing callback mechanism (Feature 04 scope)
- `error` → maps to process error / non-zero exit

This feature does NOT implement the actual conversion — that's the agent-service shim (Feature 03 scope). This feature defines the `RunnerEvent` types so the shim can be implemented.

---

## 4. Existing Spec Patterns (For Reference)

Looking at specs 001–012, all features follow slashbot's plugin-first architecture. This feature is unique in that:
- It adds new infrastructure to slashbot that is NOT a plugin (it's a module export)
- It bridges slashbot to an external system (agent-service)
- The "user" is a machine (agent-service), not a human operator

This means:
- No TUI/UI changes needed
- No connector contributions needed
- No prompt contributions needed
- The feature ships as: new types in `src/runner/`, new exports in `src/index.ts` or a dedicated `src/runner/index.ts`

---

## 5. Key Files to Create / Modify

### New files (slashbot)

| Path | Purpose |
|------|---------|
| `src/runner/types.ts` | `StepPayload`, `RunnerEvent` union, `RunnerPlugin` interface |
| `src/runner/registry.ts` | `PluginRegistry` class |
| `src/runner/runner.ts` | `SlashbotRunner` class with `executeStep()` |
| `src/runner/index.ts` | Public module exports |
| `tests/runner/runner.test.ts` | Unit tests |
| `tests/runner/registry.test.ts` | Unit tests |

### Modified files (slashbot)

| Path | Change |
|------|--------|
| `package.json` | Add build target for Node.js compatible bundle |
| `src/index.ts` | Optionally re-export runner module |

### New file (agent-service — out of scope for this feature, referenced for context)

| Path | Purpose |
|------|---------|
| `src/slashbot/runner.ts` | Shim: imports SlashbotRunner, adapts payload/events |

---

## 6. Open Technical Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Runtime strategy | Strategy A (bun build --target=node) first | No native deps at runner level; simpler |
| DI container in runner? | No — runner is stateless; no DI needed | Runner doesn't need SlashbotKernel |
| Lazy vs eager init | Lazy on first `executeStep` call | Module import should have zero cost |
| CJS vs ESM for bundle | CJS for agent-service compat | Node.js 20 supports both; CJS is safer default |
| Concurrent isolation | AsyncGenerator per call | Standard TypeScript pattern, no shared state |
