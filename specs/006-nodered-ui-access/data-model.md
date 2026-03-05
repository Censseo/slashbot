# Data Model: Node-RED UI Access

**Feature**: 006-nodered-ui-access
**Date**: 2026-03-04

## Entities

### NodeRedConfig (EXTENDED)

**Location**: `src/plugins/nodered/types.ts`
**Status**: Existing entity — two new fields added.

```typescript
interface NodeRedConfig {
  // ... existing fields unchanged ...
  enabled: boolean;
  port: number;
  userDir: string;
  healthCheckInterval: number;
  shutdownTimeout: number;
  maxRestartAttempts: number;
  localhostOnly: boolean;

  // NEW fields for 006-nodered-ui-access
  editorUsername?: string;         // Admin username for editor login
  editorPasswordHash?: string;    // bcrypt hash of editor password
}
```

**Validation rules**:
- `editorUsername`: Non-empty string when provided, alphanumeric + basic punctuation
- `editorPasswordHash`: Must be a valid bcrypt hash (starts with `$2b$` or `$2a$`)

**State transitions**: N/A (configuration entity, not stateful)

**Persistence**: `~/.slashbot/nodered.json` (existing file, extended schema)

**Migration**: New fields are optional — existing configs without them work unchanged. Editor is disabled when fields are absent (FR-012).

---

### FlowChangeEvent (NEW)

**Purpose**: Represents a detected modification to flows made through the Node-RED editor (not via FlowManager CRUD).

```typescript
interface FlowChangeEvent {
  type: 'flow:external-change';
  changes: FlowChange[];
  detectedAt: number;            // Unix timestamp
  previousHash: string;          // SHA-256 of previous flows state
  currentHash: string;           // SHA-256 of current flows state
}

interface FlowChange {
  flowId: string;
  changeType: 'created' | 'modified' | 'deleted';
  label?: string;                // Flow tab label if available
}
```

**Persistence**: Ephemeral (in-memory only). The `currentHash` is kept in memory by `FlowChangePoller` to compare against the next poll.

---

### EditorState (derived, not persisted)

**Purpose**: Runtime-only derived state for determining editor availability.

```typescript
type EditorState =
  | 'disabled'          // No credentials configured
  | 'unavailable'       // Node-RED not running
  | 'available';        // Running + credentials configured

function getEditorState(config: NodeRedConfig, managerState: NodeRedState): EditorState {
  if (!config.editorUsername || !config.editorPasswordHash) return 'disabled';
  if (managerState !== 'running') return 'unavailable';
  return 'available';
}
```

## Relationships

```
NodeRedConfig --[extends]--> existing config schema
FlowChangePoller --[reads]--> Node-RED Admin API (GET /flows)
FlowChangePoller --[emits]--> FlowChangeEvent
McpBridgeService --[subscribes]--> FlowChangeEvent
FlowManager --[updates]--> revision hash (after CRUD ops)
```
