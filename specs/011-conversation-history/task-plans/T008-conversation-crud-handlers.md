# Task Plan: T008

## Task Description
Create conversation CRUD handlers in `src/plugins/webui/handlers/conversations.ts` — listConversations, getConversation.
Phase: 3 | User Story: US1 | Parallel: Yes | Reuse Type: NEW

## Reuse Decision
Original: NEW | Validation: VALID. Handler pattern from `handlers/plugins.ts`.

## Codebase Impact
- Files to create: `src/plugins/webui/handlers/conversations.ts`
- Dependencies: ConversationStore via context.getService, types from node:http

## Implementation Steps
1. `createListConversationsHandler(context)`: get store via `context.getService('webui.conversations')`, call `store.list()`, return `{ conversations }` as JSON 200.
2. `createGetConversationHandler(context)`: extract `id` from req.url (parse last segment), validate UUID, call `store.get(id)`, return 404 if null, 400 if invalid UUID, 200 with `{ id, title, createdAt, updatedAt, messages }`.
3. Export both factories.

Gotchas:
- Extract `id` from `req.url` manually — parse `/api/conversations/:id` by splitting on `/`.
- Import ConversationStore as type only to avoid circular deps.

## Related Tasks
Depends on: T011 | Blocks: T010, T007, T015

## Estimated Complexity
Simple | Risk: Low
