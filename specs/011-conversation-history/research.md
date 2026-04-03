# Research: Conversation History

**Feature**: 011-conversation-history
**Date**: 2026-03-17

## Existing Codebase Analysis

### Reusable Components

| Component | Path | Reuse Decision | Notes |
|-----------|------|---------------|-------|
| SSE utilities | `src/plugins/webui/sse.ts` | REUSE | `writeEvent()`, `writeSseHeaders()`, `startKeepalive()` — used as-is for new endpoints |
| Stream event types | `src/plugins/webui/types.ts` | EXTEND | Add new event types for conversation metadata |
| Chat handler | `src/plugins/webui/handlers/chat.ts` | EXTEND | Modify to use persistent storage instead of in-memory Map |
| Plugin registration | `src/plugins/webui/index.ts` | EXTEND | Add new HTTP routes for conversation CRUD |
| Frontend chat component | `frontend/public/js/chat.js` | EXTEND | Add sidebar, conversation switching, load/save logic |
| Frontend HTML layout | `frontend/public/index.html` | EXTEND | Add sidebar panel, conversation list UI |
| RichMessage type | `src/core/agentic/llm/types.ts` | REUSE | `RichMessage = AgentMessage | ToolCallMessage | ToolResultMessage` — perfect for storing tool chains |
| AgentLoopCallbacks | `src/core/agentic/llm/types.ts` | REUSE | Already provides onToolStart/onToolEnd for capturing tool calls |
| AgentLoopResult | `src/core/agentic/llm/types.ts` | REUSE | `.messages` field contains `RichMessage[]` with full tool chain |
| Gateway auth middleware | `src/core/gateway/server.ts` | REUSE | Bearer token auth for all API routes |
| KernelLlmAdapter | `src/core/agentic/llm/adapter.ts` | REUSE | `complete()` accepts messages array — pass loaded history |
| ChatRequestSchema | `src/plugins/webui/types.ts` | EXTEND | Already has optional `sessionId` — maps to conversation ID |

### Existing Patterns to Follow

| Pattern | Source | Application |
|---------|--------|-------------|
| HTTP route registration | `context.registerHttpRoute()` | Register GET/POST/DELETE /api/conversations/* routes |
| Service registration | `context.registerService()` | Register ConversationStore as shared service |
| JSONL file persistence | `~/.slashbot/graph.jsonl` (AssociationGraph) | Same append-friendly JSONL pattern for conversation files |
| In-memory + deferred flush | AssociationGraph pattern | Keep conversation in memory, flush to disk async |
| Zod request validation | `ChatRequestSchema` | Validate conversation API request bodies |

### Potential Conflicts

| Area | Conflict | Resolution |
|------|----------|------------|
| Session ID semantics | Currently `sessionId` is ephemeral in-memory Map key | Redefine as persistent conversation ID; backward-compatible since format stays UUID |
| Chat handler sessions Map | Stores ephemeral history | Replace with ConversationStore lookups; keep Map as write-through cache |
| Frontend state | `messages` array and `sessionId` are ephemeral | Add conversation list state; persist via API calls |

## Technical Decisions

### Decision 1: JSONL Storage Format

- **Decision**: One `.jsonl` file per conversation + separate `index.json` metadata file
- **Existing code considered**: `FileChatHistoryStore` (single JSON file, 40-msg limit), `AssociationGraph` (JSONL with deferred flush)
- **Reuse approach**: NEW — inspired by AssociationGraph JSONL pattern but per-conversation files
- **Rationale**: FileChatHistoryStore uses single flat JSON with message limits — doesn't fit unlimited per-conversation history. Per-file JSONL allows append without rewriting, and per-conversation files avoid monolithic growth.
- **Alternatives considered**: SQLite (rejected per idea — adds dependency), single JSONL (rejected — can't efficiently load single conversation)

### Decision 2: Title Generation via LLM

- **Decision**: Use existing `KernelLlmAdapter.complete()` with `noTools: true` and a short system prompt to generate 5-8 word titles
- **Existing code considered**: `LlmAdapter` interface, `LlmCompletionInput` with `noTools` and `maxTokens` options
- **Reuse approach**: REUSE — same adapter, pinned to fast model with low token limit
- **Rationale**: LLM summary produces better titles than first-message truncation. `noTools` + `maxTokens` constraints keep it fast and cheap.

### Decision 3: Conversation Store as DI Service

- **Decision**: Create `ConversationStore` class, register as DI service via `context.registerService('webui.conversations')`
- **Existing code considered**: `memory.store` and `memory.graph` service registration pattern
- **Reuse approach**: NEW — follows Shared Service Registration pattern from architecture registry
- **Rationale**: Chat handler and new API handlers need shared access to conversation data. DI service is the established pattern.

### Decision 4: Frontend Sidebar Architecture

- **Decision**: Add sidebar as Alpine.js component alongside existing chat component, with shared state via Alpine.js `$store`
- **Existing code considered**: Existing `chat()` and `dashboard()` Alpine components, tab-based navigation in index.html
- **Reuse approach**: EXTEND — add sidebar within existing chat page layout
- **Rationale**: Sidebar is part of the chat experience, not a separate page. Alpine.js store provides reactive cross-component communication.
