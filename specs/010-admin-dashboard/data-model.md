# Data Model: Admin Dashboard

**Branch**: `010-admin-dashboard` | **Date**: 2026-03-09

## Entities

### PluginDiagnostic (EXISTING)

**Location**: `src/core/kernel/contracts.ts`

```typescript
interface PluginDiagnostic {
  pluginId: string;
  status: 'loaded' | 'disabled' | 'failed' | 'skipped';
  reason?: string;
  sourcePath?: string;
}
```

No changes needed. Consumed directly by frontend.

### LogEntry (EXISTING)

**Location**: `src/core/kernel/logger.ts`

```typescript
interface LogEntry {
  ts: string;           // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, JsonValue>;
}
```

No changes needed. Streamed via SSE to frontend.

### StatusIndicatorContribution (EXISTING)

**Location**: `src/core/kernel/contracts.ts`

```typescript
interface StatusIndicatorContribution {
  id: string;
  pluginId: string;
  label: string;
  kind: 'connector' | 'service';
  priority?: number;
  statusEvent: string;
  messageEvent?: string;
  showActivity?: boolean;
  connectorName?: string;
  getInitialStatus: () => IndicatorStatus;
}

type IndicatorStatus = 'connected' | 'busy' | 'disconnected' | 'idle' | 'running' | 'error' | 'off';
```

No changes needed. Frontend receives serialized subset via new endpoint.

### SystemInfo (EXISTING)

**Location**: `src/plugins/webui/types.ts` (response shape from webui.systemInfo RPC)

```typescript
interface SystemInfo {
  version: string;
  uptime: number;           // seconds
  pluginsLoaded: number;
  pluginsFailed: number;
  connectorsActive: number;
  commandCount: number;
  toolCount: number;
}
```

No changes needed.

## Frontend-Only Entities (NEW)

### DashboardState (Alpine.js component state)

```typescript
// In dashboard.js — not a persisted entity
interface DashboardState {
  plugins: PluginDiagnostic[];
  logs: LogEntry[];              // capped at 1000
  health: SystemInfo | null;
  indicators: StatusIndicator[];
  logFilter: 'all' | 'error' | 'warn' | 'info' | 'debug';
  isLogConnected: boolean;
  isUserScrolledUp: boolean;
  healthLastUpdated: string | null;
  error: string | null;
}
```

### StatusIndicator (serialized for frontend)

```typescript
interface StatusIndicator {
  id: string;
  label: string;
  kind: 'connector' | 'service';
  status: IndicatorStatus;
}
```

## State Management

- **Plugin list**: Fetched once on dashboard load via GET /api/plugins; no real-time updates
- **Log entries**: SSE stream via EventSource to GET /api/logs; client-side array capped at 1000
- **Health metrics**: Polled every 30 seconds via RPC webui.systemInfo
- **Status indicators**: Fetched with health metrics via GET /api/status-indicators
- **No persistence**: Dashboard state is ephemeral; refreshing page resets everything
