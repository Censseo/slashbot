# Implementation Plan: Node-RED UI Access

**Branch**: `006-nodered-ui-access` | **Date**: 2026-03-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-nodered-ui-access/spec.md`

## Summary

Enable administrator access to the Node-RED visual editor with authentication, and detect flow changes made through the editor to keep the MCP Bridge in sync. Extends the existing nodered plugin with credential configuration (`/nodered config editor.username/password`), a `/nodered ui` command, `adminAuth` injection into `settings.js`, and a polling-based flow change detector that reconciles editor changes with the MCP tool registry.

## Technical Context

**Language/Version**: TypeScript (strict mode), Bun 1.0+
**Primary Dependencies**: InversifyJS (DI), EventBus (core), native `fetch` (HTTP), Node-RED Admin API v3.x, `Bun.password.hash()` for bcrypt
**Storage**: JSON file (`~/.slashbot/nodered.json` extended with `editorUsername`, `editorPasswordHash`)
**Testing**: Vitest (`bun run test`)
**Target Platform**: Linux (Bun runtime)
**Project Type**: Single project (plugin extension)
**Performance Goals**: Flow change detection < 30s (15s poll interval), `/nodered ui` < 1s
**Constraints**: Editor must bind to `127.0.0.1` by default; passwords never stored in plaintext
**Scale/Scope**: Single admin user, single Node-RED instance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Accessibility | PASS | N/A — Node-RED editor is third-party UI; slashbot only controls access |
| Performance | PASS | Measurable targets defined: poll interval 15s, command response < 1s |
| Security | PASS | Passwords bcrypt-hashed, never stored plaintext, never logged; local-only bind; editor disabled without credentials |
| Error Handling | PASS | All failure modes specified with actionable user messages (spec table) |
| Data & State | PASS | Credentials in `~/.slashbot/nodered.json` (chmod 0600); poller state ephemeral |
| Test-First (TDD) | PASS | Tests for settings generation, credential config, poller, command handlers |
| Plugin-First Architecture | PASS | All changes within existing nodered plugin |
| Library-First | PASS | FlowChangePoller is standalone testable service; credential logic in NodeRedManager |
| Simplicity (YAGNI) | PASS | No multi-user, no HTTPS, no custom UI — only what spec requires |
| MIT License | PASS | No new dependencies — uses Bun built-in bcrypt |

**Post-Design Re-check**: PASS — no new violations introduced.

## Architecture Alignment

| Aspect | Registry Pattern | Plan Approach | Status |
|--------|-----------------|---------------|--------|
| Plugin extension | Plugin-First Architecture | All code in `src/plugins/nodered/` | ALIGNED |
| Service design | Library-First Development | `FlowChangePoller` as injectable service | ALIGNED |
| Events | Typed Plugin Event Emission | New `flow:external-change` in `NodeRedEvent` union | ALIGNED |
| Config management | NodeRedManager config pattern | Extend `NodeRedConfig` with optional fields | ALIGNED |
| Settings generation | Managed Child Process | Extend `generateSettings()` with adminAuth | ALIGNED |
| Tool sync | Event-Driven Bridge Services | McpBridge subscribes to poller events | ALIGNED |
| No new dependencies | Technology Stack | Uses `Bun.password.hash()` built-in | ALIGNED |

**New patterns**: None. All changes follow established patterns.
**Divergences**: None.

## Project Structure

### Documentation (this feature)

```text
specs/006-nodered-ui-access/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── nodered-ui-commands.md
└── tasks.md              # Phase 2 output (/specforge.tasks)
```

### Source Code (repository root)

```text
src/plugins/nodered/
├── index.ts                    # MODIFY: add /nodered ui command, extend /nodered config
├── types.ts                    # MODIFY: add editorUsername, editorPasswordHash to NodeRedConfig
├── services/
│   ├── NodeRedManager.ts       # MODIFY: getEditorUrl() helper, credential-aware init
│   ├── settings.ts             # MODIFY: conditional adminAuth + httpAdminRoot in generateSettings()
│   ├── FlowManager.ts          # MODIFY: add getFlowsHash() method, hash update after CRUD
│   ├── FlowChangePoller.ts     # NEW: polling service for editor change detection
│   ├── FlowChangePoller.test.ts # NEW: unit tests
│   └── settings.test.ts        # MODIFY: test adminAuth generation
├── index.test.ts               # MODIFY: test /nodered ui and config commands
└── flow-validator.test.ts      # UNCHANGED
```

**Structure Decision**: Extends existing nodered plugin structure. One new service file (`FlowChangePoller.ts`) and its test.

## Idea Alignment

**Source idea**: `ideas/002-nodered-plugin/features/05-nodered-ui-access.md`

| Constraint from Idea | Plan Approach | Status |
|---------------------|---------------|--------|
| Enable editor via `httpAdminRoot: '/'` in settings.js | `generateSettings()` sets `httpAdminRoot: '/'` when credentials configured, `false` otherwise | ALIGNED |
| Configure `adminAuth` with bcrypt-hashed credentials | `adminAuth` block injected by `generateSettings()` from `NodeRedConfig` fields | ALIGNED |
| Polling `GET /flows` for change detection (MVP) | `FlowChangePoller` polls every 15s, compares revision hash | ALIGNED |
| Bind address `127.0.0.1` default | Existing `localhostOnly: true` config — unchanged | ALIGNED |
| Add editor URL to TUI sidebar | Context provider enrichment when Node-RED running + credentials configured | ALIGNED |
| No custom UI — native Node-RED editor | No custom UI built | ALIGNED |
| No remote access (HTTPS, tunnel) | Not implemented | ALIGNED |
| No multi-user | Single admin account in adminAuth | ALIGNED |

**Divergences**: None. Plan fully aligns with source idea.

## Edge Case Coverage

| Edge Case (spec.md) | Handling Component | Notes |
|---------------------|--------------------|-------|
| Simultaneous bot + human edit (last-write-wins) | FlowChangePoller + FlowManager | Poller compares revision hash after each poll; bot CRUD updates the hash immediately, so poller only emits `flow:external-change` for true external changes |
| Bot-relied flow deleted in editor | FlowChangePoller → McpBridge | Poller detects deletion via hash diff; McpBridge unregisters the tool |
| Node-RED restart while editing | Existing lifecycle (NodeRedManager) | Editor session is lost (browser-side); poller auto-recovers on next successful poll after restart |
| Port already in use | Existing lifecycle error handling | Node-RED child process exits with error; NodeRedManager reports to user via existing error path |
| Editor access before credentials configured | generateSettings() + `/nodered ui` | `httpAdminRoot: false` when credentials absent; `/nodered ui` displays configuration instructions |

## Reuse Summary

| Category | Count | Details |
|----------|-------|---------|
| REUSE (as-is) | 3 | Status indicator, event system, context provider pattern |
| EXTEND | 6 | NodeRedConfig, generateSettings(), /nodered config, FlowManager, McpBridgeService, NodeRedEvent type |
| NEW | 1 | FlowChangePoller service |

## Phase 2: Task Planning Approach

Implementation should proceed in this order:

1. **Config & types**: Extend `NodeRedConfig` with credential fields, update defaults
2. **Credential commands**: Add `editor.username` and `editor.password` to `/nodered config`
3. **Settings generation**: Extend `generateSettings()` with conditional `adminAuth` and `httpAdminRoot`
4. **UI command**: Implement `/nodered ui` subcommand with state-aware messaging
5. **Flow change poller**: Build `FlowChangePoller` service with hash-based detection
6. **MCP Bridge integration**: Subscribe McpBridge to `flow:external-change` events
7. **Context provider**: Enrich context provider with editor URL when available
8. **Tests**: Unit tests for each component (TDD — for each step, write the failing test first, then implement to make it pass per Red-Green-Refactor)

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete (/specforge.plan command)
- [x] Phase 1: Design complete (/specforge.plan command)
- [x] Phase 2: Task planning complete (/specforge.plan command - describe approach only)
- [x] Phase 3: Tasks generated (/specforge.tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none needed)
