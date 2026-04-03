# Implementation Plan: Node-RED Lifecycle Management

**Branch**: `001-nodered-lifecycle` | **Date**: 2026-02-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-nodered-lifecycle/spec.md`

## Summary

Implement a `NodeRedPlugin` that manages a Node-RED instance as a child process of slashbot. The plugin handles automatic startup, periodic health monitoring, crash detection with auto-restart (exponential backoff, max 3 retries), manual lifecycle commands (`/nodered start|stop|restart|status`), graceful shutdown, and TUI sidebar status display. The implementation follows the established Plugin-First + Library-First architecture: a `NodeRedManager` service class encapsulates all business logic (process spawn, health probing, state machine, configuration, logging), and the plugin class is a thin wrapper that wires the service into DI, commands, sidebar contributions, and event emissions.

## Technical Context

**Language/Version**: TypeScript (strict mode), Bun 1.0+ runtime
**Primary Dependencies**: InversifyJS (DI), Bun.spawn (child process), native fetch (health probes)
**Storage**: JSON files (`~/.slashbot/nodered.json` for config), generated JS (`settings.js`), log file (`~/.slashbot/logs/nodered.log`)
**Testing**: Vitest (unit tests co-located, integration tests for spawn/health)
**Target Platform**: Linux (primary), macOS (secondary), Bun 1.0+
**Project Type**: Single project (existing plugin within slashbot monolith)
**Performance Goals**: < 5s slashbot startup overhead, < 2s health check probe, < 15s graceful shutdown
**Constraints**: Node-RED runs as Node.js child process (NOT in Bun runtime), localhost-only binding by default
**Scale/Scope**: Single Node-RED instance per slashbot, single-user operation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Pre-Research)

| Principle | Status | Evidence |
|-----------|--------|----------|
| **Accessibility** | PASS | Sidebar uses both color AND dynamic text label (FR-010). Commands accessible via keyboard. No color-only information. |
| **Performance** | PASS | Quantified thresholds: < 5s startup, < 2s probe, < 15s shutdown, 30s health interval. No vague terms. |
| **Security** | PASS | Localhost-only binding (default). Limited env vars passed to child process. Config in user home dir with standard permissions. No sensitive data in config (no API keys). |
| **Error Handling** | PASS | All failure modes specified with user-facing messages (spec Error Scenarios table). Plugin init failure disables plugin, doesn't crash slashbot. |
| **Data & State** | PASS | User data minimized (config only). Storage documented (`~/.slashbot/nodered.json`, `~/.slashbot/nodered/`). State management documented (in-memory + JSON config). No schema migration needed (v1). |
| **Test-First (TDD)** | PASS | Tests specified: unit (state machine, ring buffer, settings gen), integration (spawn, health). Vitest via `bun run test`. |
| **Plugin-First** | PASS | New `NodeRedPlugin` class implementing `Plugin` interface. No core engine changes except adding `TYPES.NodeRedManager` symbol. |
| **Library-First** | PASS | `NodeRedManager` service injectable via DI, testable without plugin framework. Plugin is thin wrapper. |
| **Simplicity (YAGNI)** | PASS | Only lifecycle management. No flow CRUD, no MCP bridge, no AI authoring (those are separate features). Config options limited to what spec requires. |
| **Compliance** | PASS | Node-RED is Apache 2.0 (MIT-compatible). No new runtime dependencies added to slashbot itself. |

### Post-Design Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **Accessibility** | PASS | Dynamic label pattern confirmed (Object.defineProperty getter). Text conveys state independently of color. |
| **Performance** | PASS | Non-blocking init (start returns immediately). Health check via lightweight HTTP fetch. No blocking I/O in hot path. |
| **Security** | PASS | `NODE_PATH` + `HOME` only in child env. settings.js generated (not user-editable). Localhost binding enforced. |
| **Error Handling** | PASS | 6-state machine with explicit transitions. Invalid transitions rejected. All error paths emit events + update sidebar. |
| **Data & State** | PASS | Config: `~/.slashbot/nodered.json`. Logs: `~/.slashbot/logs/nodered.log`. Runtime state: in-memory only (rebuilt on startup). Ring buffer: in-memory. |
| **Plugin-First** | PASS | Zero core engine changes besides adding 1 DI symbol + 1 loader import. |
| **Library-First** | PASS | NodeRedManager is a standalone class with constructor injection (EventBus). Fully testable via mocks. |
| **Simplicity** | PASS | 3 new files in services/ (NodeRedManager, RingBuffer, settings). 4 plugin files (index, types, commands, prompt). No unnecessary abstractions. |

## Project Structure

### Documentation (this feature)

```text
specs/001-nodered-lifecycle/
├── plan.md              # This file
├── research.md          # Phase 0: Codebase analysis + technical decisions
├── data-model.md        # Phase 1: Entities, state machine, DI tokens, events
├── quickstart.md        # Phase 1: Developer setup and testing guide
├── contracts/           # Phase 1: Service and integration contracts
│   ├── nodered-manager.ts    # INodeRedManager service interface
│   ├── nodered-commands.ts   # /nodered command specs
│   └── nodered-plugin.ts     # Plugin integration contract
└── tasks.md             # Phase 2: Generated by /specforge.tasks
```

### Source Code (repository root)

```text
src/
├── core/
│   └── di/
│       └── types.ts           # EXTEND: Add TYPES.NodeRedManager symbol
└── plugins/
    ├── loader.ts              # EXTEND: Add NodeRedPlugin import + instantiation
    └── nodered/               # NEW: Entire directory
        ├── index.ts           # NodeRedPlugin class (thin wrapper)
        ├── types.ts           # NodeRedConfig, NodeRedState, NodeRedStatus types
        ├── commands.ts        # /nodered command handler (start/stop/restart/status/config)
        ├── prompt.ts          # NODERED_PROMPT constant for LLM context
        └── services/
            ├── NodeRedManager.ts  # Core service: process lifecycle, health, config, state
            ├── RingBuffer.ts      # Fixed-size circular log buffer
            └── settings.ts        # settings.js generator from NodeRedConfig
```

**Structure Decision**: Follows the canonical plugin structure established by BashPlugin and HeartbeatPlugin. Services directory for Library-First business logic. Co-located tests (`*.test.ts` alongside source).

## Architecture Alignment

### Patterns Applied

| Pattern | Source | Status | Notes |
|---------|--------|--------|-------|
| Plugin-First Architecture | registry ADR-001 | ALIGNED | New `feature.nodered` plugin, no core logic changes |
| Library-First Development | registry | ALIGNED | NodeRedManager service class, plugin as thin wrapper |
| Dependency Injection (InversifyJS) | registry ADR-003 | ALIGNED | New `TYPES.NodeRedManager` symbol, singleton binding |
| Typed Event Bus | registry | ALIGNED | Plugin events via untyped overload (`nodered:*`), `prompt:redraw` via typed |
| Contribution-Based Extension | registry | ALIGNED | Commands, sidebar, prompt contributions |
| Service Self-Registration | HeartbeatPlugin | ALIGNED | `container.bind(TYPES.NodeRedManager).toConstantValue(service)` in init() |
| Plugin Dependency Declaration | registry | ALIGNED | NodeRedPlugin has no plugin dependencies (empty `metadata.dependencies`) — standalone lifecycle feature |
| Plugin-Specific Config Files | HeartbeatService | ALIGNED | `~/.slashbot/nodered.json` following established pattern |

### Technology Alignment

| Technology | Registry Decision | Plan Usage | Status |
|------------|-------------------|------------|--------|
| Bun 1.0+ | Runtime (ADR-004) | Bun.spawn for child process | ALIGNED |
| TypeScript strict | Language | All new code | ALIGNED |
| InversifyJS | DI (ADR-003) | Service registration | ALIGNED |
| Vitest | Testing | Unit + integration tests | ALIGNED |
| Zod v4 | Validation | Not needed for lifecycle (no tool schemas) | N/A |

### New Patterns Introduced

| Pattern | Justification | Registry Update Needed |
|---------|---------------|----------------------|
| Dynamic Sidebar Label | FR-010 requires state-dependent labels. Existing SidebarContribution only has static `label`. Solved with `Object.defineProperty` getter — no API change needed. | YES — document this pattern for future plugins |
| Managed Child Process | Unlike ProcessManager's fire-and-forget detached processes, NodeRedManager keeps the child process attached with exit/error monitoring. Different use case, different pattern. | YES — document as alternative to ProcessManager for long-lived managed processes |
| Stale Process Adoption | FR-018 port-probing before spawn to adopt existing instances. Novel pattern in this codebase. | YES — document for other managed-process plugins |

### Divergences

None. All decisions align with established patterns.

## Source Idea Alignment

### Source

- **Idea**: [ideas/002-nodered-plugin/idea.md](../../ideas/002-nodered-plugin/idea.md)
- **Feature**: [ideas/002-nodered-plugin/features/01-nodered-lifecycle.md](../../ideas/002-nodered-plugin/features/01-nodered-lifecycle.md)

### Constraint Alignment

| Constraint (from idea/feature) | Plan Approach | Status |
|-------------------------------|---------------|--------|
| Use `child_process.spawn` (via Bun) to launch Node-RED | `Bun.spawn()` (Bun's native API, equivalent) | ALIGNED |
| Launch: `node node_modules/node-red/red.js -s settings.js` | Spawn `node` with args `[red.js path, '-s', 'settings.js']` | ALIGNED |
| Port configurable (default 1880) in `~/.slashbot/config/nodered.json` | Config at `~/.slashbot/nodered.json` (simplified path, follows HeartbeatService pattern) | ALIGNED (minor path difference: `config/` omitted to match plugin convention) |
| Health check via `fetch('http://localhost:{port}/')` | HTTP fetch with configurable interval (default 30s) | ALIGNED |
| Set `NODE_PATH` for Node-RED modules | Passed in spawn env | ALIGNED |
| Register in DI as `TYPES.NodeRedManager` | `context.container.bind(TYPES.NodeRedManager).toConstantValue(service)` | ALIGNED |
| Follow BashPlugin (ProcessManager) pattern | ProcessManager pattern studied. New NodeRedManager created (different spawn semantics). Escalation pattern (SIGTERM→SIGKILL) reused. | ALIGNED (adapted, not directly reused — justified in research.md) |
| Follow MCPPlugin pattern for health checks | MCPPlugin studied (passive checks only). HeartbeatService timer pattern used instead (active polling). | ALIGNED (better fit, justified in research.md) |
| Follow ConfigManager pattern | Plugin-specific config file pattern from HeartbeatService | ALIGNED |
| Events: `nodered:ready`, `nodered:stopped`, `nodered:error`, `nodered:failed` | All 4 events defined in data-model.md | ALIGNED |
| Node-RED runs as Node.js child, not Bun | Spawn command uses `node` binary, not `bun` | ALIGNED |
| settings.js must configure httpAdminRoot, httpNodeRoot, userDir, flowFile, functionGlobalContext | settings.ts generator produces all required fields | ALIGNED |
| Node-RED installed in `~/.slashbot/nodered/node_modules/node-red` | Config `userDir` default: `~/.slashbot/nodered`. Launch from this dir. | ALIGNED |
| Hybrid usage: bot + human manage Node-RED | Commands accessible to admin. LLM informed via prompt contribution. | ALIGNED |
| Same trust model as slashbot (bash/filesystem) | No additional security layers. Runs with slashbot's privileges. | ALIGNED |

### Divergences from Source Idea

| Divergence | Idea Says | Plan Says | Justification |
|-----------|-----------|-----------|---------------|
| Config path | `~/.slashbot/config/nodered.json` | `~/.slashbot/nodered.json` | Follows established HeartbeatService pattern where feature plugins store config directly in HOME_SLASHBOT_DIR, not in `config/` subdirectory. The `config/` subdirectory is only used by the central ConfigManager for `config.json`. |

This is a minor path convention difference, not a functional divergence.

## Reuse Summary

| Category | Count | Details |
|----------|-------|---------|
| REUSE (as-is) | 6 | EventBus, ConfigManager pattern, SidebarContribution API, Plugin scaffold, CommandRegistry, display service |
| EXTEND | 2 | TYPES registry (+1 symbol), loader.ts (+1 import) |
| NEW | 7 | NodeRedManager, RingBuffer, settings.ts generator, plugin index, types, commands, prompt |

## Registry Updates Needed (post-implementation)

After this feature is implemented and merged, the architecture registry should be updated with:

1. **Dynamic Sidebar Label pattern** — `Object.defineProperty` getter on `SidebarContribution.label`
2. **Managed Child Process pattern** — Non-detached child process with exit monitoring (vs. ProcessManager's detached fire-and-forget)
3. **Stale Process Adoption pattern** — Port probing before spawn to adopt existing instances
4. **Cross-Module Dependencies** — Add `NodeRedManager` to the table (owner: plugins/nodered, used by: future nodered features)

## Phase 2: Task Planning Approach

Tasks will be organized in dependency order following TDD:

1. **Foundation**: RingBuffer (standalone, no deps) — test first
2. **Types**: NodeRedConfig, NodeRedState, NodeRedStatus type definitions
3. **Settings generator**: settings.ts (depends on types) — test first
4. **Core service**: NodeRedManager (depends on RingBuffer, types, settings, EventBus) — test first
5. **Plugin wiring**: NodeRedPlugin index.ts (depends on NodeRedManager) + DI token + loader registration
6. **Commands**: /nodered command handler (depends on NodeRedManager in DI)
7. **Prompt**: NODERED_PROMPT constant
8. **Integration testing**: End-to-end spawn + health + stop cycle
9. **Documentation**: Plugin commands (`/nodered start|stop|restart|status`) documented via CommandRegistry help text and NODERED_PROMPT constant for LLM context

Each task will have tests written before implementation (Red-Green-Refactor per constitution TDD principle).

Test coverage target: 70% minimum (per constitution Quality Standards), enforced in CI.

## Complexity Tracking

> No complexity violations detected. All patterns align with established architecture.

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete (/specforge.plan command)
- [x] Phase 1: Design complete (/specforge.plan command)
- [x] Phase 2: Task planning complete (/specforge.plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/specforge.tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none needed)
