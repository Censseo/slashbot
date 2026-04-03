# Quickstart: Conversation History

## Prerequisites
- Slashbot running with webui plugin enabled
- Bearer token configured for API access

## Key Files to Modify

### Backend (EXTEND)
- `src/plugins/webui/index.ts` — register new routes
- `src/plugins/webui/handlers/chat.ts` — integrate ConversationStore
- `src/plugins/webui/types.ts` — add conversation types and schemas

### Backend (NEW)
- `src/plugins/webui/services/conversation-store.ts` — JSONL persistence service
- `src/plugins/webui/handlers/conversations.ts` — CRUD API handlers

### Frontend (EXTEND)
- `frontend/public/index.html` — add sidebar layout
- `frontend/public/js/chat.js` — conversation switching, sidebar state

### Frontend (NEW)
- `frontend/public/js/conversations.js` — sidebar Alpine.js component

### Tests (NEW)
- `tests/webui/conversation-store.test.ts` — storage service unit tests
- `tests/webui/conversations-api.test.ts` — API endpoint tests

## Development Flow

1. Create ConversationStore service (library-first)
2. Write unit tests for store
3. Create API handlers
4. Modify chat handler to use store
5. Register new routes in plugin
6. Build sidebar frontend component
7. Integrate sidebar with chat component
8. Test end-to-end flow
