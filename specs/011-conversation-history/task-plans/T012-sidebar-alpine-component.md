# Task Plan: T012

## Task Description
Create sidebar Alpine.js component in `frontend/public/js/conversations.js`.
Phase: 3 | User Story: US1 | Parallel: Yes | Reuse Type: NEW

## Reuse Decision
Original: NEW | Validation: VALID. Pattern from chat.js.

## Codebase Impact
- Files to create: `frontend/public/js/conversations.js`
- Dependencies: global fetch, Alpine.js

## Implementation Steps
1. Define `function conversations()` returning Alpine reactive object.
2. State: `items: []`, `activeId: null`, `isLoading: false`, `error: null`, `token: ''`.
3. `init()`: read token from localStorage, call `load()`, listen for `conversation-updated` window events.
4. `async load()`: fetch GET /api/conversations with auth header, populate items.
5. `selectConversation(id)`: set activeId, dispatch `load-conversation` window event.
6. `newConversation()`: reset activeId, dispatch `new-conversation` event.
7. `formatDate(iso)`: relative date formatting.
8. `getTitle(item)`: return title or 'New conversation'.

Gotchas:
- Use `window.dispatchEvent(new CustomEvent(...))` for cross-component events.
- Handle 401 by dispatching show-token-prompt.

## Related Tasks
Depends on: T008, T010, T011 | Blocks: T013, T014, T015

## Estimated Complexity
Moderate | Risk: Low
