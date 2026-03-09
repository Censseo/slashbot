# Data Model: Gateway API Extensions

**Branch**: `008-gateway-api` | **Date**: 2026-03-09

## Entities

### ChatRequest (NEW)

Incoming HTTP request body for the chat streaming endpoint.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | Yes | User message text |
| sessionId | string | No | Existing session ID to continue conversation |

**Validation**: `message` must be non-empty string. `sessionId` if provided must be a valid UUID.

### StreamEvent (NEW)

Structured event emitted during SSE chat streaming.

| Event Type | Payload Fields | Description |
|-----------|---------------|-------------|
| `text-delta` | `{ text: string }` | Incremental text content from LLM |
| `tool-call-start` | `{ toolId: string, toolName: string, args: Record<string, unknown> }` | Tool invocation started |
| `tool-call-result` | `{ toolId: string, toolName: string, result: string, success: boolean }` | Tool execution completed |
| `error` | `{ message: string }` | Error during processing |
| `done` | `{ sessionId: string }` | Stream complete |

**SSE Format**: `data: {"type":"<event-type>","payload":{...}}\n\n`

### PluginStatusEntry (EXISTING — maps from PluginDiagnostic)

Uses existing `PluginDiagnostic` from `src/core/kernel/contracts.ts`.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| pluginId | string | PluginDiagnostic.pluginId | Unique plugin identifier |
| status | string | PluginDiagnostic.status | `'loaded' | 'disabled' | 'failed' | 'skipped'` |
| reason | string? | PluginDiagnostic.reason | Error/skip reason |

**Note**: Spec US2 mentions "version" — PluginDiagnostic does not include version. The handler should source version from plugin metadata if available, or omit the field.

### LogEntry (EXISTING — from KernelLogger)

Uses existing `LogEntry` from `src/core/kernel/logger.ts`.

| Field | Type | Description |
|-------|------|-------------|
| ts | string | ISO timestamp |
| level | string | `'debug' | 'info' | 'warn' | 'error'` |
| message | string | Log message |
| fields | Record<string, JsonValue>? | Structured context |

### SystemInfo (NEW)

Response for the `webui.systemInfo` RPC method.

| Field | Type | Description |
|-------|------|-------------|
| version | string | Slashbot version |
| uptime | number | Process uptime in seconds |
| pluginsLoaded | number | Number of loaded plugins |
| pluginsFailed | number | Number of failed plugins |
| connectorsActive | number | Number of active connectors |
| commandCount | number | Number of registered commands |
| toolCount | number | Number of registered tools |

## Entity Relationships

```text
ChatRequest --creates/reuses--> ConversationSession (EXISTING)
ChatRequest --triggers--> AgentLoop --emits--> StreamEvent[]
PluginStatusEntry --derived-from--> PluginDiagnostic (EXISTING)
LogEntry --streamed-via--> KernelLogger.subscribe() (EXISTING)
SystemInfo --derived-from--> HealthStatus (EXISTING)
```
