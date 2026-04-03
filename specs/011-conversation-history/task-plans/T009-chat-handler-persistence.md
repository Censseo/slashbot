# Task Plan: T009

## Task Description
Modify chat handler — replace in-memory sessions Map with ConversationStore.
Phase: 3 | User Story: US1 | Parallel: No | Reuse Type: EXTEND

## Reuse Decision
Original: EXTEND | Validation: VALID. `sessions` Map at line 23, eviction at 167-172.

## Codebase Impact
- Files to modify: `src/plugins/webui/handlers/chat.ts`
- Dependencies: ConversationStore via context.getService, ConversationMessage type

## Implementation Steps
1. Remove module-scoped `sessions` Map.
2. In `createChatHandler(context)`: get store via `context.getService('webui.conversations')`.
3. For existing sessionId: `store.get(id)` to load history, reconstruct AgentMessage[] from result.messages.
4. For new conversations: `store.create()` and use returned `metadata.id` as sessionId.
5. Remove eviction logic (lines 167-172).
6. After llm.complete: build ConversationMessage[] from user input + result, call `store.append(sessionId, messages)`.
7. Emit `conversation-update` SSE event after persist.

Gotchas:
- `store.create()` generates its own UUID — use `metadata.id` as sessionId.
- If `store.get(requestedSessionId)` returns null, create new conversation.
- Title generation wrapper: ConversationStore.generateTitle expects `{ complete(prompt): Promise<string> }`.

## Related Tasks
Depends on: T011 | Blocks: T015

## Estimated Complexity
Moderate | Risk: Medium
