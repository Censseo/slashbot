# Tasks: Conversation History

**Input**: Design documents from `/specs/011-conversation-history/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per constitution TDD requirement.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Reuse markers: [REUSE], [EXTEND], [NEW]

---

## Phase 1: Setup

**Purpose**: Project initialization and directory structure

- [X] T001 [EXTEND] Create `src/plugins/webui/services/` directory and add conversation store types + `conversation-update` SSE event type to `src/plugins/webui/types.ts`
- [X] T002 [P] [NEW] Create `tests/webui/` directory with test setup

**Checkpoint**: Directory structure and types ready for implementation.

---

## Phase 2: Foundational (ConversationStore Service)

**Purpose**: Core persistence service — all user stories depend on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests

- [X] T003 [NEW] Write unit tests for ConversationStore in `tests/webui/conversation-store.test.ts` — test create, list, get, append, delete, index rebuild, corrupted file handling

### Implementation

- [X] T004 [NEW] Implement ConversationStore service in `src/plugins/webui/services/conversation-store.ts` — JSONL per-conversation files + index.json, with create/list/get/append/delete/generateTitle methods
- [X] T005 [EXTEND] Add Zod schemas for ConversationMetadata, ConversationMessage, ConversationIndex to `src/plugins/webui/types.ts`
- [X] T006 Verify T003 tests pass against T004 implementation

**Checkpoint**: ConversationStore is standalone, testable, and all unit tests pass.

---

## Phase 3: User Story 1 — Resume a Past Conversation (Priority: P1) 🎯 MVP

**Goal**: Operator can browse past conversations in a sidebar, select one, and continue chatting with full history.

**Independent Test**: Send messages, refresh the browser, verify conversation appears in sidebar and loads with full history including tool calls.

### Tests

- [X] T007 [P] [US1] [NEW] Write API integration tests in `tests/webui/conversations-api.test.ts` — test GET /api/conversations, GET /api/conversations/:id, POST /api/chat with sessionId persistence

### Backend Implementation

- [X] T008 [US1] [NEW] Create conversation CRUD handlers in `src/plugins/webui/handlers/conversations.ts` — listConversations, getConversation (returns full message history with RichMessage[])
- [X] T009 [US1] [EXTEND] Modify chat handler in `src/plugins/webui/handlers/chat.ts` — replace in-memory sessions Map with ConversationStore; load history from disk on resume; persist messages after each exchange using AgentLoopResult.messages (RichMessage[])
- [X] T010 [US1] [EXTEND] Register new HTTP routes in `src/plugins/webui/index.ts` — GET /api/conversations, GET /api/conversations/:id
- [X] T011 [US1] [REUSE] Wire ConversationStore as shared service via `context.registerService('webui.conversations')`

### Frontend Implementation

- [X] T012 [US1] [NEW] Create sidebar Alpine.js component in `frontend/public/js/conversations.js` — conversation list with title, date, preview; click to load; active conversation highlight
- [X] T013 [US1] [EXTEND] Add sidebar layout to `frontend/public/index.html` — collapsible sidebar panel on the left side of the chat view, conversation list with empty state
- [X] T014 [US1] [EXTEND] Modify chat component in `frontend/public/js/chat.js` — add loadConversation(id) method to fetch and render full history (text parts + tool call parts); wire sidebar selection to load; use Alpine.js $store for cross-component sessionId sharing

### Verification

- [X] T015 [US1] Verify T007 API tests pass; manually test end-to-end: send messages → refresh → sidebar shows conversation → click loads full history with tool calls → send new message continues conversation

**Checkpoint**: US1 complete — conversations persist, sidebar lists them, clicking loads full history, sending continues the conversation.

---

## Phase 4: User Story 2 — Start a New Conversation (Priority: P1)

**Goal**: Operator can start a fresh conversation from any state via a "New Conversation" button.

**Independent Test**: Click "New Conversation", verify empty chat appears, send a message, verify it persists.

### Implementation

- [X] T016 [US2] [EXTEND] Add "New Conversation" button to sidebar in `frontend/public/index.html` — always visible at top of sidebar
- [X] T017 [US2] [EXTEND] Add newConversation() method to chat component in `frontend/public/js/chat.js` — clears messages array, resets sessionId to null, focuses input textarea
- [X] T018 [US2] [EXTEND] Ensure chat handler in `src/plugins/webui/handlers/chat.ts` creates a new conversation when no sessionId is provided (auto-generates UUID, persists on first exchange, emits `conversation-update` SSE event)

**Checkpoint**: US2 complete — "New Conversation" clears chat, first message creates persistent conversation.

---

## Phase 5: User Story 3 — Auto-Generated Conversation Titles (Priority: P2)

**Goal**: Conversations receive descriptive titles after the first assistant response.

**Independent Test**: Start a new conversation, send a message, verify a meaningful title appears in the sidebar within 5 seconds.

### Tests

- [X] T019 [US3] [NEW] Write unit test for title generation in `tests/webui/conversation-store.test.ts` — test generateTitle method with mock LLM adapter

### Implementation

- [X] T020 [US3] [REUSE] Implement title generation in ConversationStore using existing KernelLlmAdapter with `noTools: true`, `maxTokens: 30`, `maxSteps: 1` — system prompt: "Generate a concise 5-8 word title for this conversation"
- [X] T021 [US3] [EXTEND] Trigger title generation in chat handler (`src/plugins/webui/handlers/chat.ts`) after first assistant response — fire-and-forget async; emit `conversation-update` SSE event with generated title
- [X] T022 [US3] [EXTEND] Handle `conversation-update` SSE event in frontend `frontend/public/js/chat.js` — update sidebar entry title reactively

**Checkpoint**: US3 complete — titles auto-generate and appear in sidebar after first exchange.

---

## Phase 6: User Story 4 — Conversation List with Metadata (Priority: P2)

**Goal**: Sidebar shows rich metadata (title, relative date, message preview) for each conversation.

**Independent Test**: Verify sidebar entries show title, human-readable relative date, and preview text.

### Implementation

- [X] T023 [US4] [EXTEND] Add relative date formatting to sidebar component in `frontend/public/js/conversations.js` — "just now", "5 minutes ago", "yesterday", "Mar 15"
- [X] T024 [US4] [EXTEND] Add message preview extraction to ConversationStore in `src/plugins/webui/services/conversation-store.ts` — truncate last assistant text to 100 chars, update index on append
- [X] T025 [US4] [EXTEND] Add progressive loading to sidebar in `frontend/public/js/conversations.js` — show loading state, handle 50+ conversations without blocking UI

**Checkpoint**: US4 complete — sidebar shows rich metadata with relative dates and previews.

---

## Phase 7: Conversation Deletion (FR-011)

**Purpose**: Operator can delete conversations from sidebar and API.

### Implementation

- [X] T026 [EXTEND] Add DELETE /api/conversations/:id handler to `src/plugins/webui/handlers/conversations.ts` and register route in `src/plugins/webui/index.ts`
- [X] T027 [EXTEND] Add delete button/action to sidebar conversation entries in `frontend/public/js/conversations.js` with confirmation prompt
- [X] T028 [EXTEND] Add API test for DELETE endpoint in `tests/webui/conversations-api.test.ts`

**Checkpoint**: Conversations can be deleted from UI and API.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, error handling, and final refinements

- [X] T029 [P] Add keyboard navigation (arrow keys, Enter, Escape) to sidebar in `frontend/public/js/conversations.js`
- [X] T030 [P] Add ARIA landmarks, accessible labels, and aria-live regions to sidebar in `frontend/public/index.html`
- [X] T031 [P] Add `prefers-reduced-motion` support for sidebar slide animation in `frontend/public/index.html`
- [X] T032 Add error handling for API failures in frontend — retry logic, error banners, "Connection lost" state per spec error scenarios
- [X] T033 Add warning logging for corrupted conversation files in ConversationStore
- [X] T034 Run full end-to-end validation per quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 3 (extends chat handler modifications from US1)
- **Phase 5 (US3)**: Depends on Phase 3 (needs ConversationStore and chat handler wiring)
- **Phase 6 (US4)**: Depends on Phase 3 (extends sidebar component)
- **Phase 7 (Delete)**: Depends on Phase 3 (needs CRUD handlers)
- **Phase 8 (Polish)**: Depends on all previous phases

### Within Each Phase

- Tests written first (TDD), then implementation, then verification
- Backend before frontend (API must exist before UI consumes it)

### Parallel Opportunities

- **Phase 5 (US3) and Phase 6 (US4)** can run in parallel after Phase 4
- **Phase 7 (Delete)** can run in parallel with Phase 5/6
- **T029, T030, T031** in Phase 8 can all run in parallel

---

## Parallel Example: After Phase 4 Completes

```text
# These three phases can proceed in parallel:
Phase 5 (US3 - Title Generation): T019 → T020 → T021 → T022
Phase 6 (US4 - Rich Metadata):    T023, T024 (parallel) → T025
Phase 7 (Delete):                  T026 → T027, T028 (parallel)
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1: Setup (T001-T002)
2. Phase 2: ConversationStore (T003-T006)
3. Phase 3: Resume conversations (T007-T015)
4. Phase 4: New conversations (T016-T018)
5. **STOP and VALIDATE**: Full persistence and browsing works

### Full Feature

6. Phase 5: Title generation (T019-T022)
7. Phase 6: Rich metadata (T023-T025)
8. Phase 7: Deletion (T026-T028)
9. Phase 8: Polish (T029-T034)

---

## Idea Technical Traceability

**Source Idea**: [idea.md](../../ideas/005-web-ui/idea.md) + [features/04-conversation-history.md](../../ideas/005-web-ui/features/04-conversation-history.md)

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| JSONL storage per conversation in `~/.slashbot/web-ui/conversations/` | T004 | Mapped |
| Conversation metadata index for fast sidebar loading | T004, T005 | Mapped |
| Tool call results stored alongside messages | T009 (uses RichMessage[]) | Mapped |
| Sidebar with conversation list (title, date, preview) | T012, T013, T023 | Mapped |
| Load and resume past conversations | T008, T009, T014 | Mapped |
| New conversation button | T016, T017 | Mapped |
| Conversation title auto-generation | T020, T021, T022 | Mapped |
| LLM summary for titles (not first-message truncation) | T020 | Mapped |

### Divergences from Idea

None — all idea requirements are implemented as specified.

---

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 2 | T011, T020 |
| EXTEND | 17 | T001, T005, T009, T010, T013, T014, T016, T017, T018, T021, T022, T023, T024, T025, T026, T027, T028 |
| NEW | 7 | T002, T003, T004, T007, T008, T012, T019 |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| SSE utilities (sse.ts) | REUSE | T011 (via handler) | writeEvent(), writeSseHeaders() used as-is |
| KernelLlmAdapter | REUSE | T020 | complete() with noTools for title generation |
| Chat handler (chat.ts) | EXTEND | T009 | Replace in-memory Map with ConversationStore |
| Plugin index (index.ts) | EXTEND | T010 | Add new HTTP routes |
| Frontend chat.js | EXTEND | T014, T017, T022 | Add conversation switching and store integration |
| Frontend index.html | EXTEND | T013, T016 | Add sidebar layout |
| Types (types.ts) | EXTEND | T001, T005 | Add conversation schemas |
| ConversationStore | NEW | T004 | No existing per-conversation JSONL store; FileChatHistoryStore uses single-file flat JSON with 40-msg limit |
| Conversations handler | NEW | T008 | New CRUD endpoints for conversation management |
| Sidebar component | NEW | T012 | New UI component; nothing similar exists |

**Reuse ratio**: 19 REUSE+EXTEND vs 7 NEW (73% reuse) — healthy code reuse.
