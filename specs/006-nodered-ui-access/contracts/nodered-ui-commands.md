# Contract: Node-RED UI Commands

**Feature**: 006-nodered-ui-access

## Command Extensions

### `/nodered ui` (NEW)

**Trigger**: User types `/nodered ui`
**Behavior**:
- If credentials not configured → display credential setup instructions
- If Node-RED not running → display "not running" message with start suggestion
- If running + credentials configured → display editor URL

**Response format**:
```
# Success
Node-RED Editor: http://localhost:{port}

# Not running
Node-RED is not running. Use `/nodered start` to start it.

# No credentials
Editor authentication is not configured. Use `/nodered config editor.username <user>` and `/nodered config editor.password <pass>` to set credentials.
```

### `/nodered config editor.username <user>` (NEW)

**Trigger**: User types `/nodered config editor.username admin`
**Behavior**: Stores username in `NodeRedConfig.editorUsername`, saves config
**Response**: `Editor username set to "admin". Restart Node-RED to apply.`

### `/nodered config editor.password <pass>` (NEW)

**Trigger**: User types `/nodered config editor.password mysecret`
**Behavior**: Hashes password with `Bun.password.hash(pass, "bcrypt")`, stores hash in `NodeRedConfig.editorPasswordHash`, saves config
**Response**: `Editor password configured. Restart Node-RED to apply.`
**Security**: Plaintext password is never stored or logged.

## Internal Service Contracts

### FlowChangePoller

**Interface**:
```typescript
class FlowChangePoller {
  constructor(
    flowManager: FlowManager,
    eventBus: EventBus,
    interval: number  // default 15000ms
  )
  start(): void       // Begin polling
  stop(): void        // Stop polling
  getLastHash(): string | null
  updateHash(hash: string): void  // Called by FlowManager after CRUD
}
```

**Polling contract**:
1. Every `interval` ms: call `FlowManager.listFlows()`
2. Compute SHA-256 hash of sorted flow IDs + their node counts
3. If hash differs from last known AND change was not from FlowManager CRUD → emit `flow:external-change`
4. McpBridgeService handles re-scan on `flow:external-change`

### generateSettings() Extension

**Current signature**: `generateSettings(config: NodeRedConfig): string`
**Change**: No signature change. Function reads `editorUsername` and `editorPasswordHash` from config.

**Behavior**:
- If both `editorUsername` and `editorPasswordHash` are set:
  - `httpAdminRoot: '/'` (editor enabled)
  - `adminAuth` block with credentials
- If either is missing:
  - `httpAdminRoot: false` (editor disabled)
  - No `adminAuth` block
