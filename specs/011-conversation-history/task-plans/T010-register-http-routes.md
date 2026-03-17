# Task Plan: T010

## Task Description
Register new HTTP routes in `src/plugins/webui/index.ts`.
Phase: 3 | User Story: US1 | Parallel: No | Reuse Type: EXTEND

## Reuse Decision
Original: EXTEND | Validation: VALID. Pattern at lines 73-109.

## Codebase Impact
- Files to modify: `src/plugins/webui/index.ts`
- Dependencies: handler factories from `./handlers/conversations.js`

## Implementation Steps
1. Import `createListConversationsHandler, createGetConversationHandler` from handlers.
2. Add two `context.registerHttpRoute()` calls for GET /api/conversations and GET /api/conversations/:id.

Gotchas:
- Registration order: list route before :id route.

## Related Tasks
Depends on: T008, T011 | Blocks: T015

## Estimated Complexity
Simple | Risk: Low
