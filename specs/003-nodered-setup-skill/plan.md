# Implementation Plan: Node-RED Setup Skill

**Branch**: `003-nodered-setup-skill` | **Date**: 2026-02-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-nodered-setup-skill/spec.md`

## Summary

Extract Node-RED installation and process lifecycle management from the nodered plugin into a bundled skill (`nodered-setup`). The plugin becomes a thin availability monitor + event emitter. The bot (LLM) autonomously handles installation, start, stop, and crash recovery by following skill instructions. The plugin signals the need for setup via an enriched context provider and a one-shot automation job.

## Technical Context

**Language/Version**: TypeScript (strict mode), Bun 1.0+
**Primary Dependencies**: Existing slashbot plugin SDK, Skills plugin (SkillManager), Automation plugin (soft dependency)
**Storage**: PID file at `~/.slashbot/nodered/nodered.pid`; config at `~/.slashbot/nodered.json`; settings at `~/.slashbot/nodered/settings.js`
**Testing**: Vitest (`bun run test`)
**Target Platform**: Linux (primary), macOS (secondary)
**Project Type**: Plugin within monorepo
**Performance Goals**: Plugin init < 2s; heartbeat probe < 2s; crash-to-skill invocation < 35s
**Constraints**: Plugin MUST NOT reference npm/npx/bun in TypeScript code (FR-012); skill is markdown-only
**Scale/Scope**: Single plugin + single skill file; ~6 files modified, 1 new file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Accessibility | PASS | Sidebar labels use text (not color-only); TUI keyboard-navigable |
| Performance | PASS | Plugin init < 2s (no npm install blocking); heartbeat < 2s; quantified in spec |
| Security | PASS | Skill is bundled (not user-modifiable at runtime); localhost-only binding; no secrets in skill |
| Error Handling | PASS | All failure modes specified in spec with user-facing messages and recovery actions |
| Data & State | PASS | PID file at documented location; config at `~/.slashbot/nodered.json`; no new sensitive data |
| Test-First (TDD) | PASS | Tests for state machine changes, skill discovery, context provider behavior |
| Plugin-First | PASS | All logic via plugin contributions; skill via skills plugin |
| Library-First | PASS | NodeRedManager is standalone service; plugin is thin wrapper |
| Simplicity (YAGNI) | PASS | Minimal changes; no new abstractions; skill is flat markdown |
| Business Constraints | PASS | Node-RED is Apache 2.0 (MIT-compatible); no telemetry; user data in `~/.slashbot/` |

## Architecture Alignment

### Patterns Applied

| Pattern | Source | Status |
|---------|--------|--------|
| Plugin-First Architecture | Registry | ALIGNED — all changes via plugin contributions |
| Contribution-Based Extension | Registry | ALIGNED — context provider, status indicator, tools |
| Library-First Development | Registry | ALIGNED — NodeRedManager is injectable service |
| Typed Event Bus | Registry | ALIGNED — new `nodered:setup-needed` event with type declaration |
| Dynamic Sidebar Label | Registry | ALIGNED — add `setup-needed` label |
| Stale Process Adoption | Registry | ALIGNED — port probe + PID file check |
| Typed Plugin Event Emission | Registry | ALIGNED — extend event union |

### New Patterns Introduced

| Pattern | Justification | Registry Update? |
|---------|---------------|------------------|
| Skill-Delegated Lifecycle | Plugin detects state, skill executes action (install/start/stop). Separates "what to detect" from "how to act". | YES — new pattern for skill-driven setup |
| Dual Signal (Context + Automation) | Context provider for persistent visibility; one-shot automation for immediate action. Ensures both passive and active channels. | YES — reusable for other skill-trigger scenarios |

### Divergences

None. All changes align with established patterns.

## Project Structure

### Documentation (this feature)

```text
specs/003-nodered-setup-skill/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── nodered-events.md
│   └── skill-frontmatter.md
└── tasks.md             # Phase 2 output (/specforge.tasks)
```

### Source Code (repository root)

```text
src/plugins/nodered/
├── index.ts                    # MODIFIED — setup-needed label, context provider, automation job, eager settings.js
├── types.ts                    # MODIFIED — add setup-needed state
├── prompt.ts                   # MODIFIED — add skill invocation guidance
├── services/
│   ├── NodeRedManager.ts       # MODIFIED — remove ensureNodeRedInstalled(), add setup-needed logic, PID file
│   ├── settings.ts             # UNCHANGED
│   ├── RingBuffer.ts           # UNCHANGED
│   ├── FlowManager.ts          # UNCHANGED
│   └── FlowValidator.ts        # UNCHANGED (if exists)
├── flow-types.ts               # UNCHANGED
└── flow-validator.ts           # UNCHANGED

src/plugins/skills/
├── index.ts                    # MODIFIED — update resolveBundledSkillsDir()
├── manager.ts                  # UNCHANGED
├── bundled/
│   └── nodered-setup/
│       └── SKILL.md            # NEW — bundled skill with frontmatter + instructions
└── ...

tests/
├── unit/
│   └── plugins/nodered/
│       └── NodeRedManager.test.ts  # MODIFIED — test setup-needed state, removed install logic
└── ...
```

**Structure Decision**: Existing plugin structure. Single new file (`SKILL.md`) added in new `bundled/` directory under skills plugin. No new TypeScript modules needed.

## Complexity Tracking

No violations to justify. All changes are minimal extensions of existing patterns.

## Implementation Approach (Phase 2 — Describe Only)

### Work Packages

1. **WP1: State Machine Extension** — Add `setup-needed` to `NodeRedState`, update `VALID_TRANSITIONS`, `STATE_LABELS`, event declarations. Update `NodeRedManager.init()` to detect missing Node-RED and transition to `setup-needed` instead of calling `ensureNodeRedInstalled()`.

2. **WP2: Remove ensureNodeRedInstalled()** — Delete the `ensureNodeRedInstalled()` method from `NodeRedManager`. Remove the npm install call and the blocking behavior during `init()`. The init path now transitions to `setup-needed` (from WP1) instead of calling install. Plugin init must complete in < 2s.

3. **WP3: Eager settings.js Generation** — Move `generateSettings()` call from `start()` to the plugin's startup hook (or `init()`). Ensure `~/.slashbot/nodered/` directory is created (FR-015) and `settings.js` exists before any skill invocation.

4. **WP4: Context Provider Enrichment** — Update `nodered.context` provider to return skill invocation instruction when state is `setup-needed` or when crash recovery is needed. Message: "Node-RED requires setup. Use `skill.run` with name `nodered-setup` to install and start it."

5. **WP5: Automation One-Shot Integration** — In the plugin startup hook, when state is `setup-needed`, get `automation.service` via `context.getService()` with null guard. If available, fire `addOnceJob()` with prompt instructing the bot to run the nodered-setup skill. Same pattern for crash recovery.

6. **WP6: PID File Support** — Add PID file read logic to `NodeRedManager` for stale process adoption. When heartbeat detects Node-RED running (started by skill), read PID from `nodered.pid` to track the process.

7. **WP7: Create SKILL.md** — Write `src/plugins/skills/bundled/nodered-setup/SKILL.md` with frontmatter and instruction sections (detect, install, start, stop, restart, verify, troubleshoot). The skill is invocable both autonomously and by user via `/skill run nodered-setup` (FR-013).

8. **WP8: Update Skill Loader Path** — Change `resolveBundledSkillsDir()` in `src/plugins/skills/index.ts` to resolve to `src/plugins/skills/bundled/`.

9. **WP9: Tests** — Unit tests for: state machine with `setup-needed`, context provider messages, PID file handling, skill frontmatter parsing. Integration test: skill discovery from bundled path.

### Dependencies Between Work Packages

```
WP1 (state machine) ─┬─→ WP2 (remove install) ──→ WP3 (eager settings)
                      ├─→ WP4 (context provider)
                      └─→ WP5 (automation integration)
WP6 (PID file) ─────────→ standalone
WP7 (SKILL.md) ─────────→ WP8 (skill loader path)
WP9 (tests) ─────────────→ after WP1-WP8
```

## Source Idea Alignment

**Source**: `ideas/002-nodered-plugin/idea.md` + `ideas/002-nodered-plugin/features/01-nodered-lifecycle.md`

| Constraint from Idea | Plan Status | Notes |
|---------------------|-------------|-------|
| Node-RED as child process of slashbot | ALIGNED | Skill starts process; plugin monitors via heartbeat |
| Health check via HTTP GET | ALIGNED | Unchanged from feature 001 |
| Auto-restart on crash | ALIGNED | Dual signal triggers skill for restart |
| Node.js required on host | ALIGNED | Skill frontmatter `requires.bins: [node]` |
| Settings.js for custom config | ALIGNED | Eagerly generated in setup() |
| Events: ready, stopped, error, failed | ALIGNED | Extended with setup-needed |
| `npm install node-red` in userDir | DIVERGENT | Skill detects npm OR bun; installs bun if neither available. **Justified**: spec explicitly requires npm-independence (FR-012) |
| Port 1880 default, configurable | ALIGNED | Unchanged |
| Graceful shutdown SIGTERM→SIGKILL | ALIGNED | Skill instructions include this sequence |

**Critical divergence**: The idea says `npm install -g node-red` or `npx node-red`. The plan uses local install in `~/.slashbot/nodered/` with npm/bun detection. This is explicitly required by the spec (FR-004, FR-012) and is an improvement over the idea's approach.

## Reuse Summary

| Category | Count | Details |
|----------|-------|---------|
| REUSE (as-is) | 4 | RingBuffer, settings.ts, AutomationService.addOnceJob(), EventBus |
| EXTEND | 5 | NodeRedState, VALID_TRANSITIONS, STATE_LABELS, context provider, EventMap |
| REFACTOR | 3 | NodeRedManager (remove install), resolveBundledSkillsDir(), settings.js timing |
| NEW | 1 | SKILL.md file |

## Registry Updates Needed

After implementation and merge, update architecture-registry.md:

1. **New pattern**: "Skill-Delegated Lifecycle" — Plugin detects state, delegates action execution to a bundled skill invoked by the bot
2. **New pattern**: "Dual Signal (Context + Automation)" — Context provider for passive LLM visibility + one-shot automation job for active triggering
3. **Update**: "Managed Child Process" — Note that process can also be started by skill (via PID file) not just by manager directly

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
- [x] Complexity deviations documented (none)
