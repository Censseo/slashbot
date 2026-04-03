# Research: Node-RED UI Access

**Feature**: 006-nodered-ui-access
**Date**: 2026-03-04

## Existing Codebase Analysis

### Reusable Components Found

| Component | Location | Reuse Decision | Notes |
|-----------|----------|---------------|-------|
| `NodeRedManager` | `src/plugins/nodered/services/NodeRedManager.ts` | EXTEND | Add credential config fields to `NodeRedConfig`, expose editor URL helper |
| `generateSettings()` | `src/plugins/nodered/services/settings.ts` | EXTEND | Add `adminAuth` block when credentials are configured; conditionally set `httpAdminRoot: false` when unconfigured |
| `/nodered config` command | `src/plugins/nodered/index.ts` | EXTEND | Add `editor.username` and `editor.password` subkeys |
| `FlowManager` | `src/plugins/nodered/services/FlowManager.ts` | EXTEND | Add `getFlowsRevisionHash()` for change detection polling |
| `McpBridgeService` | `src/plugins/nodered/services/McpBridgeService.ts` | EXTEND | Subscribe to new `flow:external-change` events from poller |
| Status indicator | `src/plugins/nodered/index.ts:104` | REUSE | Already tracks Node-RED state; no changes needed |
| `NodeRedConfig` type | `src/plugins/nodered/types.ts` | EXTEND | Add `editorUsername`, `editorPasswordHash` fields |
| Event system | `core/events` | REUSE | Existing `flow:created`, `flow:updated`, `flow:deleted` events |
| Context provider | Plugin SDK | REUSE | For editor URL display in TUI sidebar |

### Existing Patterns to Follow

| Pattern | Source | Application |
|---------|--------|-------------|
| Managed Child Process | NodeRedManager | Settings.js regeneration on start (adminAuth injected) |
| Config via `/nodered config` | index.ts command handler | Extend with `editor.username`, `editor.password` keys |
| Event-Driven Bridge Services | McpBridgeService | Poller emits events → McpBridge reacts |
| Typed Plugin Event Emission | `NodeRedEvent` union | Add `flow:external-change` event type |

### Potential Conflicts

| Conflict | Impact | Mitigation |
|----------|--------|-----------|
| `settings.js` overwritten on every start | adminAuth must come from `generateSettings()`, not manual edits | Store credentials in `NodeRedConfig`, inject into `generateSettings()` |
| No bcrypt in Bun ecosystem | Need bcrypt hashing for Node-RED adminAuth | Use `Bun.password.hash()` with bcrypt algorithm (built-in) |
| Flow change poller vs FlowManager CRUD | Poller must not re-emit events for bot-initiated changes | Use revision hash comparison; FlowManager updates hash after its own CRUD |

## Technical Decisions

### Decision 1: Password Hashing

- **Decision**: Use `Bun.password.hash(password, "bcrypt")` for bcrypt hash generation
- **Existing code considered**: No bcrypt usage exists in codebase
- **Reuse approach**: NEW (Bun built-in)
- **Rationale**: Bun natively supports bcrypt via `Bun.password.hash()` — no external dependency needed. Node-RED adminAuth requires bcrypt-hashed passwords.
- **Alternatives considered**: `bcryptjs` npm package (unnecessary dependency given Bun built-in support)

### Decision 2: Flow Change Detection

- **Decision**: Polling-based change detection using `GET /flows` revision hash comparison
- **Existing code considered**: `FlowManager.listFlows()` already calls `GET /flows`; no existing polling for external changes
- **Reuse approach**: EXTEND FlowManager with a `getFlowsHash()` method; NEW `FlowChangePoller` service
- **Rationale**: Polling is simpler than Node-RED WebSocket `/comms` and works with the standard Admin API. Spec requires < 30s detection. A 15-second poll interval gives comfortable margin.
- **Alternatives considered**: Node-RED `/comms` WebSocket (more complex, tighter coupling); `fs.watch` on `flows.json` (unreliable across platforms, race conditions with Node-RED writes)

### Decision 3: Editor URL in TUI

- **Decision**: Use context provider contribution to surface editor URL in the prompt/context
- **Existing code considered**: The `sidebar` kernel hook exists in type definitions but has no implementation anywhere. Status indicators exist but only show status dots, not URLs.
- **Reuse approach**: REUSE context provider pattern (already used by nodered plugin for state info)
- **Rationale**: Context providers are the established mechanism for adding dynamic info to the TUI. The sidebar hook has no rendering support. FR-014 says "display in TUI sidebar" — a context provider achieves this without building uncharted sidebar infrastructure.
- **Alternatives considered**: Implementing the sidebar hook from scratch (over-engineering for a single URL display)

### Decision 4: Editor Disable When No Credentials

- **Decision**: Set `httpAdminRoot: false` in `generateSettings()` when credentials are not configured
- **Existing code considered**: Current `generateSettings()` always sets `httpAdminRoot: '/'`
- **Reuse approach**: EXTEND `generateSettings()`
- **Rationale**: Node-RED respects `httpAdminRoot: false` to disable the editor entirely. This is the cleanest way to enforce FR-012.
- **Alternatives considered**: Leaving editor enabled without auth (security violation); always requiring credentials before first start (blocks existing features)

### Decision 5: Credential Storage

- **Decision**: Store `editorUsername` (plaintext) and `editorPasswordHash` (bcrypt hash) in `NodeRedConfig` persisted to `~/.slashbot/nodered.json`
- **Existing code considered**: `NodeRedManager.saveConfig()` already writes to this file with `chmod 0600`
- **Reuse approach**: EXTEND existing config
- **Rationale**: Consistent with existing config management. The hash is safe to store; plaintext password is never persisted. File permissions already restrict access.
- **Alternatives considered**: Separate credentials file (unnecessary complexity); encrypted storage via CryptoService (bcrypt hash is already one-way, username is not a secret)
