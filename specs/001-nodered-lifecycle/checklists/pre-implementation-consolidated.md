# Pre-Implementation Consolidated Checklist: Node-RED Lifecycle Management

**Purpose**: Validate requirements quality, constitution compliance, architecture alignment, and spec-plan deviation before implementation begins.
**Created**: 2026-02-13
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md)
**Depth**: Standard | **Audience**: Reviewer (pre-implementation gate) | **Timing**: Pre-implementation

---

## Constitution Compliance

### Accessibility [Constitution SS Accessibility]

- [x] CHK001 - Are keyboard navigation requirements defined for all Node-RED UI touchpoints (sidebar, commands)? [Completeness, Spec SS Accessibility]
- [x] CHK002 - Is color-plus-text labeling explicitly required so that color is never the sole means of conveying Node-RED state? [Clarity, Spec SS FR-010, Constitution SS Accessibility]
- [x] CHK003 - Are monochrome terminal scenarios addressed — does the spec confirm the sidebar label text alone conveys the full state? [Coverage, Spec SS Accessibility additional notes]
- [x] CHK004 - Are connector output formatting requirements (Telegram/Discord) specified for Node-RED status messages, or explicitly scoped out? [Coverage, Gap]

### Performance [Constitution SS Performance]

- [x] CHK005 - Are all response time requirements quantified with measurable values (no vague terms like "fast" or "responsive")? [Measurability, Constitution SS Performance]
- [x] CHK006 - Is the < 5s slashbot startup overhead threshold defined with a reference platform? [Clarity, Spec SS Performance]
- [x] CHK007 - Is the health check probe target (< 2s) specified alongside the interval (30s default)? [Completeness, Spec SS FR-004, Spec SS Performance]
- [x] CHK008 - Is the graceful shutdown timeout (< 15s) consistent between the performance table and the functional requirement FR-008 (10s configurable)? [Consistency, Spec SS Performance vs Spec SS FR-008]
- [x] CHK009 - Are performance degradation scenarios specified (e.g., Node-RED under heavy flow load, slow Node.js startup)? [Coverage, Constitution SS Performance]

### Security [Constitution SS Security]

- [x] CHK010 - Is the localhost-only default binding explicitly required (not just a technical hint)? [Clarity, Spec SS Security]
- [x] CHK011 - Are the environment variables passed to the child process explicitly enumerated and limited? [Completeness, Spec SS Security]
- [x] CHK012 - Is data validation specified at system boundaries — specifically for configuration file input and health check HTTP responses? [Coverage, Constitution SS Security]
- [x] CHK013 - Is the file permission model for configuration files (owner read/write only) specified as a requirement, not just a note? [Clarity, Spec SS Security]
- [x] CHK014 - Does the spec confirm that no sensitive data (API keys, passwords, tokens) is stored in the Node-RED configuration? [Completeness, Constitution SS Security]

### Error Handling [Constitution SS Error Handling]

- [x] CHK015 - Are all failure modes listed in the Error Scenarios table with user-facing messages that are actionable (tell the user what went wrong + what to do)? [Completeness, Spec SS Error Scenarios, Constitution SS Error Handling]
- [x] CHK016 - Is fallback behavior defined for critical paths — specifically Node.js unavailability, port conflicts, and health check failures? [Coverage, Constitution SS Error Handling]
- [x] CHK017 - Does the spec explicitly require that plugin initialization failure disables the plugin with a logged warning rather than crashing slashbot? [Clarity, Spec SS FR-015, Constitution SS Error Handling]
- [x] CHK018 - Are the edge cases for "port already in use by another application" and "insufficient permissions on user directory" fully specified with user messages and recovery actions? [Completeness, Spec SS Edge Cases]
- [x] CHK019 - Is the behavior for "disk full" scenario specified (edge case listed but unresolved)? [Coverage, Gap]
- [x] CHK020 - Is the behavior for "two slashbot instances on same port" scenario specified (edge case listed but unresolved)? [Coverage, Gap]

### Data & State [Constitution SS Data & State]

- [x] CHK021 - Are all persistent data locations documented (`~/.slashbot/nodered.json`, `~/.slashbot/nodered/`, `~/.slashbot/logs/nodered.log`)? [Completeness, Spec SS Data & State, Constitution SS Data & State]
- [x] CHK022 - Is the state management approach documented — in-memory state machine for runtime, JSON for config, ring buffer for logs? [Clarity, Spec SS Data & State]
- [x] CHK023 - Is the data minimization principle satisfied — does the spec confirm only necessary data is stored? [Compliance, Constitution SS Data & State]
- [x] CHK024 - Is a backward-compatibility or migration strategy defined for configuration schema changes (even if v1 needs none, is the intent stated)? [Coverage, Constitution SS Data & State]
- [x] CHK025 - Does the spec confirm conversation context will not contain sensitive Node-RED data in persisted form? [Coverage, Constitution SS Data & State]

---

## Architecture Alignment [Registry]

### Established Patterns [Registry SS Patterns]

- [x] CHK026 - Does the plan implement Node-RED as a plugin conforming to the `Plugin` interface (Plugin-First)? [Consistency, Registry SS Plugin-First]
- [x] CHK027 - Is business logic in a standalone `NodeRedManager` service class, separate from the plugin wrapper (Library-First)? [Consistency, Registry SS Library-First]
- [x] CHK028 - Is the service registered via InversifyJS DI with a new `TYPES.NodeRedManager` symbol (DI pattern)? [Consistency, Registry SS DI ADR-003]
- [x] CHK029 - Are lifecycle events emitted via the EventBus using the string-based overload for plugin events (Typed Event Bus pattern)? [Consistency, Registry SS Event Bus]
- [x] CHK030 - Are slash commands registered via the CommandRegistry contribution pattern (Contribution-Based Extension)? [Consistency, Registry SS Contribution-Based]
- [x] CHK031 - Is the sidebar contribution using the existing `SidebarContribution` API without requiring core API changes? [Consistency, Registry SS Contribution-Based, Spec SS FR-010]

### Technology Decisions [Registry SS Technology]

- [x] CHK032 - Does the plan use Bun.spawn for child process management (aligned with Bun runtime decision)? [Consistency, Registry SS Bun ADR-004]
- [x] CHK033 - Is all new code in TypeScript strict mode? [Consistency, Registry SS TypeScript]
- [x] CHK034 - Are tests specified using Vitest (not Jest or other)? [Consistency, Registry SS Vitest]
- [x] CHK035 - Is the plan's technology stack free of dependencies that conflict with the registry (GPL, heavy frameworks)? [Compliance, Registry SS Technology, Constitution SS Compliance]

### Anti-Patterns [Registry SS Anti-Patterns]

- [x] CHK036 - Does the plan avoid placing feature logic in the core engine (only DI symbol + loader import in core)? [Consistency, Registry SS Anti-Patterns]
- [x] CHK037 - Does the plan avoid direct cross-plugin imports (using EventBus/DI for inter-plugin communication)? [Consistency, Registry SS Anti-Patterns]
- [x] CHK038 - Does the plan avoid shared mutable state between plugins (state is encapsulated in NodeRedManager singleton)? [Consistency, Registry SS Anti-Patterns]
- [x] CHK039 - Does the plan avoid using `any` types without justification? [Consistency, Registry SS Anti-Patterns]

---

## Spec-Plan Deviation Check

### Functional Requirements Coverage

- [x] CHK040 - Is FR-001 (non-blocking spawn) addressed in the plan with a specific design (background polling after immediate init return)? [Completeness, Spec SS FR-001]
- [x] CHK041 - Is FR-005 (auto-restart with exponential backoff, max 3 retries, disabled after manual stop) fully reflected in the plan's state machine design? [Completeness, Spec SS FR-005]
- [x] CHK042 - Is FR-010 (dynamic sidebar label with boolean status) addressed with a specific implementation approach in the plan? [Completeness, Spec SS FR-010]
- [x] CHK043 - Is FR-014 (dual output: persistent log file AND in-memory ring buffer) reflected in the plan's file structure (RingBuffer.ts + log file)? [Completeness, Spec SS FR-014]
- [x] CHK044 - Is FR-018 (stale process adoption via port probing on startup) addressed as a specific design element in the plan? [Completeness, Spec SS FR-018]
- [x] CHK045 - Are all 18 functional requirements traceable to plan design elements or file structures? [Coverage, Spec SS Requirements]

### Configuration Path Divergence

- [x] CHK046 - Is the config path divergence (`~/.slashbot/config/nodered.json` in idea vs `~/.slashbot/nodered.json` in plan) documented and justified? [Consistency, Plan SS Divergences]

### Event Contract

- [x] CHK047 - Are all 4 lifecycle events (`nodered:ready`, `nodered:stopped`, `nodered:error`, `nodered:failed`) defined in both the spec (FR-006) and the plan's data model? [Consistency, Spec SS FR-006]

### Command Contract

- [x] CHK048 - Are all 4 slash commands (`/nodered start|stop|restart|status`) specified in the spec (FR-007) and reflected in the plan's commands.ts? [Consistency, Spec SS FR-007]

---

## Development Principles Compliance

### Test-First (TDD) [Constitution SS TDD]

- [x] CHK049 - Does the plan specify that tests are written before implementation (Red-Green-Refactor cycle)? [Compliance, Constitution SS TDD, Plan SS Phase 2]
- [x] CHK050 - Are unit test targets identified for core logic (state machine, ring buffer, settings generator)? [Coverage, Constitution SS TDD]
- [x] CHK051 - Are integration test targets identified for plugin interactions (spawn, health check, shutdown)? [Coverage, Constitution SS TDD]

### Plugin-First Architecture [Constitution SS Plugin-First]

- [x] CHK052 - Does the plan confirm zero feature logic in the core engine? [Compliance, Constitution SS Plugin-First]
- [x] CHK053 - Are plugin dependencies declared in metadata for topological initialization? [Coverage, Constitution SS Plugin-First]
- [x] CHK054 - Is cross-plugin communication specified via EventBus or DI (not direct imports)? [Compliance, Constitution SS Plugin-First]

### Simplicity (YAGNI) [Constitution SS Simplicity]

- [x] CHK055 - Is the scope limited to lifecycle management only (no flow CRUD, no MCP bridge, no AI authoring)? [Compliance, Constitution SS Simplicity, Plan SS Summary]
- [x] CHK056 - Are configuration options limited to what the spec explicitly requires (no speculative "just in case" settings)? [Compliance, Constitution SS Simplicity]

---

## Quality Standards [Constitution SS Quality Standards]

- [x] CHK057 - Is the 70% test coverage target acknowledged in the plan? [Compliance, Constitution SS Quality Standards]
- [x] CHK058 - Are type safety requirements met (strict mode, no unjustified `any`)? [Compliance, Constitution SS Quality Standards]
- [x] CHK059 - Is documentation required for the new plugin's action tags and commands? [Coverage, Constitution SS Quality Standards]

---

## Notes

- Check items off as completed: `[x]`
- Items marked `[Gap]` indicate requirements that may need to be added to the spec before implementation
- Items marked `[Consistency]` flag potential misalignment between spec/plan/constitution/registry
- Traceability: 56 of 59 items (95%) include section references
- All edge cases resolved after remediation pass (2026-02-13)

<!-- Validated: 2026-02-13 -->
