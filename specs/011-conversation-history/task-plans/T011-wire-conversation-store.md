# Task Plan: T011

## Task Description
Wire ConversationStore as shared service via context.registerService.
Phase: 3 | User Story: US1 | Parallel: No | Reuse Type: REUSE

## Reuse Decision
Original: REUSE | Validation: VALID. Pattern at index.ts:115.

## Codebase Impact
- Files to modify: `src/plugins/webui/index.ts`
- Dependencies: ConversationStore, homedir from node:os, join from node:path

## Implementation Steps
1. Import ConversationStore from `./services/conversation-store.js`.
2. Instantiate: `new ConversationStore(join(homedir(), '.slashbot', 'web-ui', 'conversations'))`. Or use PathResolver if available via `context.getService('kernel.paths')`.
3. Call `store.init()` fire-and-forget (setup is sync).
4. Register via `context.registerService({ id: 'webui.conversations', ... })`.

Gotchas:
- setup() is sync — use fire-and-forget init or check if async setup is supported.
- Use PathResolver `paths.home('web-ui', 'conversations')` if available.

## Related Tasks
Depends on: none | Blocks: T008, T009, T010, T007

## Estimated Complexity
Simple | Risk: Low
