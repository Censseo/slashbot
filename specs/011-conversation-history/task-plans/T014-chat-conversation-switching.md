# Task Plan: T014

## Task Description
Modify chat.js — add loadConversation(id) and Alpine.js $store for cross-component sessionId sharing.
Phase: 3 | User Story: US1 | Parallel: No | Reuse Type: EXTEND

## Reuse Decision
Original: EXTEND | Validation: VALID. chat() has sessionId at line 14.

## Codebase Impact
- Files to modify: `frontend/public/js/chat.js`
- Dependencies: Alpine.js $store

## Implementation Steps
1. Add `Alpine.store('session', { sessionId: null })` in `alpine:init` event.
2. In `init()`: listen for `load-conversation` and `new-conversation` window events.
3. `async loadConversation(id)`: fetch GET /api/conversations/:id, map messages to internal format, set this.messages, scroll to bottom.
4. `resetConversation()`: clear messages, reset sessionId.
5. In `onDone`: sync sessionId to Alpine store, dispatch `conversation-updated` event.

Gotchas:
- Map ConversationMessage.msg to internal message format (role, parts, isStreaming).
- Handle tool call messages in history (toolCalls array).
- Use arrow functions in addEventListener for correct `this` context.

## Related Tasks
Depends on: T012, T013, T008/T010 | Blocks: T015

## Estimated Complexity
Moderate | Risk: Medium
