# Task Plan: T007

## Task Description
Write API integration tests in `tests/webui/conversations-api.test.ts` — test GET /api/conversations, GET /api/conversations/:id, POST /api/chat with sessionId persistence.
Phase: 3 | User Story: US1 | Parallel: No | Reuse Type: NEW

## Reuse Decision
Original: NEW | Validation: VALID. `tests/webui/` exists with setup helpers.

## Codebase Impact
- Files to create: `tests/webui/conversations-api.test.ts`
- Dependencies: ConversationStore, handler factories, vitest, test helpers from `./setup.js`

## Implementation Steps
1. Import helpers and ConversationStore. Test handler functions directly with mock req/res (no HTTP server needed).
2. GET /api/conversations: seed store, invoke handler, assert `{ conversations: [...] }` sorted by updatedAt desc.
3. GET /api/conversations/:id — happy path: seed + append, invoke handler, assert full message history returned.
4. GET /api/conversations/:id — 404: unknown UUID returns 404.
5. GET /api/conversations/:id — 400: non-UUID string returns 400.
6. POST /api/chat with sessionId: stub/mark as pending T009 completion.

Gotchas:
- Mock req/res objects need `writeHead`, `write`, `end`, `setHeader`, `writableEnded`.
- Parse `id` from `req.url` if GatewayCallContext doesn't expose path params.

## Related Tasks
Depends on: T011 | Blocks: T015 | Parallel with: T008

## Estimated Complexity
Moderate | Risk: Medium
