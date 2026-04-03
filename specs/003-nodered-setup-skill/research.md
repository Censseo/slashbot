# Research: Node-RED Setup Skill

**Feature**: 003-nodered-setup-skill
**Date**: 2026-02-19

## Existing Codebase Analysis

### Reusable Components

| Component | Location | Reuse Decision | Notes |
|-----------|----------|----------------|-------|
| `NodeRedManager` | `src/plugins/nodered/services/NodeRedManager.ts` | **REFACTOR** | Remove `ensureNodeRedInstalled()` and process spawn logic; keep heartbeat, state machine, config, events |
| `NodeRedState` union type | `src/plugins/nodered/types.ts` | **EXTEND** | Add `setup-needed` as 7th value |
| `VALID_TRANSITIONS` map | `NodeRedManager.ts:39-46` | **EXTEND** | Add transitions for `setup-needed` state |
| `STATE_LABELS` map | `src/plugins/nodered/index.ts:37-44` | **EXTEND** | Add `'setup-needed': 'NR: Setup Needed'` |
| `generateSettings()` | `src/plugins/nodered/services/settings.ts` | **REUSE** | Already generates settings.js from config; move call to `setup()` phase |
| `RingBuffer` | `src/plugins/nodered/services/RingBuffer.ts` | **REUSE** | No changes needed |
| `SkillManager` | `src/plugins/skills/manager.ts` | **EXTEND** | Update `resolveBundledSkillsDir()` to resolve from `src/plugins/skills/bundled/` |
| `resolveBundledSkillsDir()` | `src/plugins/skills/index.ts:15-18` | **REFACTOR** | Currently resolves to `<repo-root>/skills/`; must change to `src/plugins/skills/bundled/` |
| `AutomationService.addOnceJob()` | `src/plugins/automation/index.ts:289` | **REUSE** | Use for immediate autonomous skill invocation |
| Context provider pattern | `src/plugins/nodered/index.ts:114-122` | **EXTEND** | Enrich `nodered.context` to instruct bot to run skill when setup needed |
| `EventBus` | core | **REUSE** | Add `nodered:setup-needed` event |

### Existing Patterns to Follow

| Pattern | Source | Application |
|---------|--------|-------------|
| Factory plugin (`createXxxPlugin()`) | All plugins | Already used by nodered plugin |
| Soft dependency via `getService()` null guard | Plugin SDK | For automation service dependency |
| Status indicator with `contributeStatusIndicator()` | nodered plugin | Already in place |
| Dynamic context provider | nodered plugin | Extend to include skill invocation instruction |
| SKILL.md with YAML frontmatter | Skills plugin | Use for `nodered-setup` skill file |
| Three-tier skill discovery | `SkillManager` | Bundled tier for `nodered-setup` |
| `once` trigger for immediate execution | Automation plugin | Fire-and-forget skill invocation |

### Potential Conflicts

| Conflict | Impact | Resolution |
|----------|--------|------------|
| `ensureNodeRedInstalled()` runs in `init()` blocking startup | Plugin currently blocks on npm install | Remove entirely; delegate to skill |
| `start()` generates `settings.js` | Spec says generate eagerly in `setup()` | Move settings generation to `setup()` hook |
| Bundled skills path mismatch | Current: `<repo>/skills/`, new: `src/plugins/skills/bundled/` | Update `resolveBundledSkillsDir()` |
| `nodered.start`/`nodered.stop` tools call `manager.start()`/`stop()` directly | After refactor, process management via skill | Keep tools for adopted instances; skill for fresh install+start |

## Technical Decisions

### Decision 1: Plugin Retains Process Start/Stop Tools

- **Decision**: Keep `nodered.start`, `nodered.stop`, `nodered.restart` tools that call manager methods directly
- **Existing code considered**: Current tools work well for running instances
- **Reuse approach**: REUSE
- **Rationale**: The manager still owns heartbeat, state, adopted process shutdown. The skill handles *installation* and *initial start* (writing PID file, etc). For day-to-day operations on an already-installed Node-RED, direct tools remain the primary mechanism. The skill is the fallback for setup and crash recovery.

### Decision 2: Skill-Based Installation Replaces ensureNodeRedInstalled()

- **Decision**: Remove `ensureNodeRedInstalled()` from NodeRedManager; installation delegated to SKILL.md instructions executed by the bot
- **Existing code considered**: `ensureNodeRedInstalled()` at NodeRedManager.ts:198-250 — hardcoded `npm install node-red`
- **Reuse approach**: NEW (skill file) + REFACTOR (remove from manager)
- **Rationale**: Spec FR-012 mandates plugin MUST NOT depend on npm/npx at code level. Skill instructions are more flexible (detect npm/bun, install bun if needed).

### Decision 3: Bundled Skills Path Change

- **Decision**: Change `resolveBundledSkillsDir()` from `<repo>/skills/` to `src/plugins/skills/bundled/`
- **Existing code considered**: `resolveBundledSkillsDir()` in `src/plugins/skills/index.ts:15-18`
- **Reuse approach**: REFACTOR
- **Rationale**: Spec FR-001 requires bundled skills at `src/plugins/skills/bundled/<name>/SKILL.md`. Current path has no existing skills (empty). Clean migration.

### Decision 4: Dual Signal Mechanism (Context Provider + Automation Once Job)

- **Decision**: Use both enriched context provider AND one-shot automation job for autonomous setup
- **Existing code considered**: Context provider at index.ts:114-122; AutomationService.addOnceJob() at automation/index.ts:289
- **Reuse approach**: EXTEND (context provider) + REUSE (automation once job)
- **Rationale**: Per FR-003. Context provider ensures the instruction is visible on every LLM turn. One-shot job triggers immediate autonomous execution without waiting for user interaction. Soft dependency on automation plugin.

### Decision 5: PID File for Skill-Started Processes

- **Decision**: Skill writes PID to `~/.slashbot/nodered/nodered.pid`; plugin reads it for stop/restart
- **Existing code considered**: Current manager tracks PID in-memory via `runtimeState.pid` from `Bun.spawn()`
- **Reuse approach**: EXTEND
- **Rationale**: Per FR-005/FR-006. When the skill starts Node-RED (not the manager), the PID must persist across process boundaries. The manager should also check PID file during stale process adoption.

### Decision 6: settings.js Eager Generation

- **Decision**: Generate settings.js during plugin `setup()` phase, not during `start()`
- **Existing code considered**: Currently generated in `start()` method (NodeRedManager.ts:278-289)
- **Reuse approach**: REFACTOR
- **Rationale**: Per FR-014. Settings file must be ready before any skill invocation. The skill's start instructions reference `settings.js` as pre-existing.

### Decision 7: setup-needed State

- **Decision**: Add `setup-needed` as 7th formal state in `NodeRedState` union type
- **Existing code considered**: Current 6-state machine: disabled, unavailable, stopped, starting, running, failed
- **Reuse approach**: EXTEND
- **Rationale**: Per FR-008. Distinguishes "Node-RED not installed" from "unavailable (no Node.js)". Triggers skill invocation flow.

## Dependencies & Best Practices

### Node-RED Installation via Skill
- npm and bun are both valid package managers for installing Node-RED
- `npx` is NOT needed; local install + direct `node red.js` invocation is the pattern
- Install location: `~/.slashbot/nodered/node_modules/node-red/`
- Start command: `node ~/.slashbot/nodered/node_modules/node-red/red.js -s ~/.slashbot/nodered/settings.js`

### PID File Management
- Write PID immediately after `node` process starts: `echo $! > nodered.pid`
- Read PID for stop: `kill -TERM $(cat nodered.pid)`, wait, then `kill -9` if needed
- Remove PID file after successful stop
- Check for stale PID file on startup (process may have died)

### Skill Frontmatter Best Practices
- `requires.bins: [node]` — only hard prerequisite
- `userInvocable: true` — allow `/skill run nodered-setup`
- `disableModelInvocation: false` — allow autonomous invocation
