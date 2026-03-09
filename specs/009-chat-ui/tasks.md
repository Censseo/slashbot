# Tasks: Chat UI

**Input**: Design documents from `/specs/009-chat-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create project structure and base HTML page with CDN imports

- [X] T001 Create frontend directory structure: `frontend/public/`, `frontend/public/css/`, `frontend/public/js/`
- [X] T002 [NEW] Create `frontend/public/index.html` with Alpine.js 3.x, Tailwind CSS (Play CDN), marked, and highlight.js CDN imports. Include basic HTML skeleton with `<main>` landmark, empty `<div x-data="chat()">` container, and meta viewport tag
- [X] T003 [P] [NEW] Create `frontend/public/css/app.css` with base styles: full-height layout, message bubble styles (user right-aligned, assistant left-aligned), scrollable message area, fixed-bottom input area, responsive breakpoints (desktop centered column, mobile full-width)

**Checkpoint**: Browser loads index.html via gateway at `http://localhost:7680/` with styled empty layout

---

## Phase 2: Foundational (SSE Client)

**Purpose**: SSE stream parser utility — blocking prerequisite for all chat functionality

- [X] T004 [NEW] Create `frontend/public/js/sse-client.js` — SSE stream consumer utility:
  - Export `streamChat(url, token, body)` function that POSTs to `/api/chat` with Bearer token
  - Parse SSE `data:` lines from `ReadableStream` via `response.body.getReader()`
  - Ignore SSE comment lines (starting with `:`) per FR-017
  - Validate JSON before parsing per FR-019 — discard malformed lines silently
  - Handle partial chunks (SSE events split across reads) with line buffer
  - Call event callbacks: `onTextDelta(text)`, `onToolCallStart(payload)`, `onToolCallResult(payload)`, `onDone(sessionId)`, `onError(message)`
  - Handle HTTP errors (401, 500) before stream starts
  - Return abort controller for future cancellation support
- [X] T005 [NEW] Create `tests/frontend/sse-client.test.ts` — Unit tests for SSE parser:
  - Test: parses text-delta events correctly
  - Test: parses tool-call-start and tool-call-result events
  - Test: ignores keepalive comment lines
  - Test: discards malformed JSON without throwing
  - Test: handles partial chunk buffering
  - Test: calls onError for HTTP 401/500

**Checkpoint**: SSE client passes all unit tests

---

## Phase 3: User Story 1 — Streaming Chat Conversation (Priority: P1) 🎯 MVP

**Goal**: Operator sends a message and sees a streaming response rendered token by token with Markdown formatting

**Independent Test**: Load chat page, type a message, press Enter — response streams in with Markdown formatting after completion

### Implementation for User Story 1

- [X] T006 [US1] [NEW] Create `frontend/public/js/chat.js` — Alpine.js chat component with ChatState:
  - `messages[]` array (ChatMessage objects with `id`, `role`, `parts[]`, `isStreaming`, `error`)
  - `sessionId` (null initially, set from `done` event)
  - `isStreaming` boolean
  - `inputText` string
  - `token` (loaded from localStorage on init)
  - `showTokenPrompt` (true if no token in localStorage)
  - `error` global error message (string|null) — per data-model.md ChatState
  - `isUserScrolledUp` boolean (for FR-010 auto-scroll exception)
  - `sendMessage()` method: creates user ChatMessage, creates assistant ChatMessage with `isStreaming:true`, calls `streamChat()` with callbacks
  - SSE callbacks: `onTextDelta` appends text ContentPart to current assistant message, `onDone` sets `isStreaming=false` and stores `sessionId`
- [X] T007 [US1] [REUSE] Wire chat component to gateway API — integrate `streamChat()` from sse-client.js with `sendMessage()`, passing `token` and `sessionId` from ChatState
- [X] T008 [US1] [NEW] Build message rendering in `frontend/public/index.html`:
  - `<template x-for="msg in messages">` loop rendering messages
  - User messages: right-aligned bubble with `msg.parts[0].text`
  - Assistant messages: left-aligned bubble iterating `msg.parts` — render text parts as `<div>` elements
  - Streaming indicator: pulsing cursor when `msg.isStreaming` is true (respects `prefers-reduced-motion`)
  - Visual distinction between user (e.g., blue bg) and assistant (e.g., gray bg) per FR-012
- [X] T009 [US1] [NEW] Add Markdown rendering to assistant messages in `frontend/public/js/chat.js`:
  - On stream completion (`isStreaming → false`) or after `tool-call-result`, apply `marked.parse()` to text ContentParts
  - Configure `marked` with `{ breaks: true, gfm: true }` and HTML escaping enabled (XSS mitigation per spec §Security)
  - Integrate highlight.js for code block syntax highlighting via `marked` renderer hook
  - Store both raw text and rendered HTML in ContentPart for toggling during streaming

**Checkpoint**: Can send a message and see streaming response with Markdown formatting

---

## Phase 4: User Story 2 — Tool Call Visibility (Priority: P1)

**Goal**: Tool calls appear as inline collapsible panels showing name, parameters, status, and result

**Independent Test**: Send a message that triggers a tool, verify tool call panel appears inline with status updates

### Implementation for User Story 2

- [X] T010 [US2] [NEW] Add tool call ContentPart handling to `frontend/public/js/chat.js`:
  - `onToolCallStart` callback: append tool-call ContentPart to current assistant message with `status:'running'`, `toolId`, `toolName`, `args`
  - `onToolCallResult` callback: find matching tool-call part by `toolId`, update `status` to `'done'`/`'error'`, set `result` and `success`
  - Tool calls interleave with text: new text after a tool call creates a new text ContentPart
- [X] T011 [US2] [NEW] Build tool call panel UI in `frontend/public/index.html`:
  - Collapsible panel component within message parts loop (when `part.type === 'tool-call'`)
  - Header: tool name icon + `part.toolName` + status badge (running=yellow spinner, done=green check, error=red x) — status conveyed by icon AND text label per accessibility
  - Body (collapsible): parameters as formatted JSON (truncated at 500 chars with "show more" per FR-004), result display (truncated at 1000 chars per edge case)
  - Expanded by default during streaming (`msg.isStreaming`), collapsed by default after completion per FR-011
  - Alpine.js `x-show` with transition for collapse/expand, `@click` toggle
  - Keyboard accessible: focusable via Tab, toggle via Enter/Space
- [X] T012 [US2] [NEW] Add JSON formatting and truncation utilities to `frontend/public/js/chat.js`:
  - `formatJson(obj)`: pretty-print JSON with 2-space indentation
  - `truncateText(text, maxLen)`: truncate with "..." and return `{text, isTruncated}` for "show more" toggle
  - `escapeHtml(str)`: escape `<>&"'` for safe display in tool call panels (XSS mitigation)

**Checkpoint**: Tool calls visible inline with collapsible panels, status updates, and formatted parameters

---

## Phase 5: User Story 3 — Chat Input & Interaction (Priority: P2)

**Goal**: Comfortable text input with Enter to send, Shift+Enter for newlines, disabled during streaming

**Independent Test**: Type message, press Enter to send, verify Shift+Enter inserts newline, input disables during stream

### Implementation for User Story 3

- [X] T013 [US3] [NEW] Build chat input area in `frontend/public/index.html`:
  - `<textarea>` with `x-model="inputText"`, auto-expanding height (up to max-height per edge case)
  - Send button with send icon, `@click="sendMessage()"`, `:disabled="isStreaming || !inputText.trim()"`
  - `@keydown.enter` handler: if `!event.shiftKey` → `event.preventDefault()` + `sendMessage()`; else allow newline per FR-009
  - Both textarea and send button disabled (`:disabled`) when `isStreaming` per FR-008
  - Minimum 44x44px touch target on send button per accessibility
  - `<form>` landmark wrapper with `aria-label="Chat input"` per FR-020
- [X] T014 [US3] Add empty-message guard in `frontend/public/js/chat.js`:
  - `sendMessage()` returns early if `inputText.trim()` is empty per FR-009 acceptance scenario 4

**Checkpoint**: Input works with keyboard shortcuts, disables during streaming

---

## Phase 6: User Story 4 — Thinking/Loading Indicator (Priority: P2)

**Goal**: Thinking indicator appears immediately after send, disappears on first SSE event

**Independent Test**: Send message, verify thinking indicator appears, then disappears when response starts

### Implementation for User Story 4

- [X] T015 [US4] [NEW] Add thinking indicator to `frontend/public/index.html`:
  - Show when `isStreaming && currentMessage.parts.length === 0` (no content yet)
  - Animated dots or pulsing indicator with `prefers-reduced-motion` fallback (static "Thinking..." text)
  - Positioned as assistant message bubble placeholder
  - Announced to screen readers via `aria-live="polite"` region per FR-020

**Checkpoint**: Thinking indicator appears within 100ms of send, disappears on first event

---

## Phase 7: User Story 5 — Responsive Layout (Priority: P3)

**Goal**: Chat adapts to desktop and mobile viewports

**Independent Test**: Resize browser — layout adapts, messages readable, input anchored at bottom

### Implementation for User Story 5

- [X] T016 [US5] [NEW] Refine responsive styles in `frontend/public/css/app.css`:
  - Desktop (≥1024px): centered column with `max-width` and side margins
  - Tablet (768-1023px): wider column, reduced margins
  - Mobile (<768px): full-width, no margins
  - Message area: `flex-grow` to fill viewport, `overflow-y: auto`
  - Input area: `position: sticky; bottom: 0` or flex-shrink-0
- [X] T017 [P] [US5] [NEW] Add auto-scroll behavior to `frontend/public/js/chat.js`:
  - Track scroll position: `isUserScrolledUp` flag set when user scrolls up from bottom
  - Auto-scroll to bottom on new content UNLESS `isUserScrolledUp` per FR-010
  - Reset `isUserScrolledUp` when user scrolls back to bottom (within 50px threshold)
  - Use `scrollIntoView({ behavior: 'smooth' })` or `scrollTop` assignment

**Checkpoint**: Layout responsive across viewports, auto-scroll works correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Auth flow, error handling, session management, accessibility

- [X] T018 [NEW] Add token input overlay to `frontend/public/index.html`:
  - Centered overlay with backdrop, shown when `showTokenPrompt` is true per FR-016
  - Token input field (`<input type="password">`) + submit button
  - On submit: save token to localStorage, set `token` in state, hide overlay
  - Shown on initial load if no token in localStorage, and on 401 response
- [X] T019 [P] [NEW] Add error handling to `frontend/public/js/chat.js`:
  - `onError` callback: set `error` on current assistant message, set `isStreaming=false`, re-enable input per FR-013
  - HTTP 401 handler: set `showTokenPrompt=true`, clear stored token per error scenario
  - HTTP 500 / network error: display error message in chat area per error scenarios
  - Session eviction: if server returns new sessionId (different from stored), update stored sessionId per FR-018
  - Error messages in `aria-live="polite"` region per FR-020
- [X] T020 [P] [NEW] Add session continuity to `frontend/public/js/chat.js`:
  - Store `sessionId` from `done` event payload
  - Include `sessionId` in subsequent `streamChat()` calls per FR-014
  - On page load: `sessionId = null` (fresh conversation, no persistence per edge case)
- [X] T021 Run quickstart.md validation — manually test full flow:
  - Start gateway, load page, enter token, send message, verify streaming + tool calls + Markdown

---

## Phase 9: Corrections (from review-001)

**Purpose**: Fix CRITICAL and HIGH issues identified in code review. Reference: `specs/009-chat-ui/reviews/review-001.md`

### HIGH priority — must fix before merge

- [X] T022 [H-001] Fix XSS vulnerability in Markdown rendering in `frontend/public/js/chat.js` and `frontend/public/index.html`:
  - Add DOMPurify CDN import to `frontend/public/index.html` (after `marked` script tag)
  - In `chat.js` `renderMarkdown()`, wrap `marked.parse(text)` output with `DOMPurify.sanitize(html)` before returning
  - Fallback: if `DOMPurify` is undefined, return `this.escapeHtml(text)` (plain text, no HTML)
  - Verify: LLM response containing `<script>alert(1)</script>` is stripped to plain text after rendering

- [X] T023 [H-002] Add `error` SSE event type handler in `frontend/public/js/sse-client.js`:
  - Add `case 'error':` branch to the switch in `_processLine()` that calls `onError(event.message || 'Server stream error')`
  - Add test in `tests/frontend/sse-client.test.ts`: verify `onError` is called with the message from an `error` event
  - Verify: when server sends `{"type":"error","message":"quota exceeded"}`, the error is surfaced to the user and streaming stops

### MEDIUM priority — should fix before merge

- [X] T024 [M-001] Replace `Date.now()` message IDs with a monotonic counter in `frontend/public/js/chat.js`:
  - Add a module-level `let _msgIdCounter = 0` variable
  - Replace `id: Date.now()` and `Date.now() + 1` with `id: ++_msgIdCounter`

- [X] T025 [M-002] Move `marked.use()` and `marked.setOptions()` out of `renderMarkdown()` in `frontend/public/js/chat.js`:
  - Call both once in `init()` after confirming `marked` is defined
  - `renderMarkdown()` should only call `marked.parse(text)` (and DOMPurify from T022)

- [X] T026 [M-004] Guard against empty token in `saveToken()` in `frontend/public/js/chat.js`:
  - If `newToken.trim()` is empty, do not close the overlay and do not write to localStorage
  - Optionally show a brief inline validation message in the token form

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (SSE Client)**: Depends on Phase 1 (needs directory structure)
- **Phase 3 (US1 Streaming)**: Depends on Phase 2 (needs SSE client)
- **Phase 4 (US2 Tool Calls)**: Depends on Phase 3 (needs base chat component)
- **Phase 5 (US3 Input)**: Depends on Phase 3 (needs chat component and sendMessage)
- **Phase 6 (US4 Thinking)**: Depends on Phase 3 (needs chat component)
- **Phase 7 (US5 Layout)**: Can start after Phase 1 (CSS independent), JS after Phase 3
- **Phase 8 (Polish)**: Depends on Phase 3 minimum; applies across all stories

### User Story Dependencies

- **US1 (Streaming Chat)**: Foundation — all other stories depend on this
- **US2 (Tool Calls)**: Depends on US1 (extends message rendering)
- **US3 (Input)**: Depends on US1 (uses sendMessage)
- **US4 (Thinking)**: Depends on US1 (uses isStreaming state)
- **US5 (Responsive)**: CSS independent; JS depends on US1

### Parallel Opportunities

- T001, T002, T003 can run in parallel (Phase 1)
- T004, T005 are sequential (implementation then tests)
- T016 (CSS) can run in parallel with Phase 3-6
- T018, T019, T020 can run in parallel (Phase 8)

---

## Parallel Example: Phase 1

```bash
# All setup tasks in parallel:
Task T001: "Create directory structure"
Task T002: "Create index.html with CDN imports"
Task T003: "Create app.css with base styles"
```

## Parallel Example: Phase 8

```bash
# All polish tasks in parallel:
Task T018: "Add token input overlay"
Task T019: "Add error handling"
Task T020: "Add session continuity"
```

---

## Implementation Strategy

### MVP First (US1 Only — Phases 1-3)

1. Phase 1: Setup (T001-T003)
2. Phase 2: SSE Client (T004-T005)
3. Phase 3: Streaming Chat (T006-T009)
4. **STOP and VALIDATE**: Send message → see streaming Markdown response

### Full Feature (All Phases)

1. MVP (Phases 1-3) → streaming chat works
2. Phase 4: Tool call visibility → inline panels
3. Phase 5: Input polish → keyboard shortcuts
4. Phase 6: Thinking indicator → loading feedback
5. Phase 7: Responsive layout → mobile support
6. Phase 8: Polish → auth flow, errors, session

---

## Idea Technical Traceability

**Source Idea**: [ideas/005-web-ui/features/02-chat-ui.md](../../ideas/005-web-ui/features/02-chat-ui.md)

| Idea Requirement | Task(s) | Status |
|------------------|---------|--------|
| PenguinUI (Alpine.js + Tailwind CSS) starting point | T002 (CDN imports) | Mapped |
| Alpine.js `x-data` for chat state | T006 (chat component) | Mapped |
| `fetch()` with `ReadableStream` for SSE | T004 (sse-client.js) | Mapped |
| Tool calls inline within message flow | T010, T011 (tool call parts + panel UI) | Mapped |
| `<template x-for>` for message list | T008 (message rendering) | Mapped |
| Markdown rendering via `marked` | T009 (marked integration) | Mapped |
| SSE via fetch (not EventSource) for POST | T004 (POST-based SSE) | Mapped |
| Gateway API contract (text-delta, tool-call-start, tool-call-result, done) | T004 (event parsing), T006-T010 (event handling) | Mapped |

### Divergences from Idea

None — plan fully aligned with idea's technical approach.

## Reuse Traceability

**Source**: research.md (Existing Codebase Analysis)

| Type | Count | Tasks |
|------|-------|-------|
| REUSE | 1 | T007 |
| NEW | 17 | T001-T006, T008-T021 |

| Component | Decision | Task | Justification |
|-----------|----------|------|---------------|
| Gateway API (POST /api/chat) | REUSE | T007 | Existing backend, frontend consumes as-is |
| Static file handler | REUSE | (implicit) | Files served from frontend/public/ by existing handler |
| Bearer token auth | REUSE | T018 | Existing auth mechanism, frontend sends token |
| Chat page (index.html) | NEW | T002 | No existing frontend — first chat UI in project |
| SSE client (sse-client.js) | NEW | T004 | No existing SSE consumer — new frontend utility |
| Chat component (chat.js) | NEW | T006 | No existing Alpine.js components — first frontend feature |
| CSS styles (app.css) | NEW | T003 | No existing frontend styles |

**Note**: High NEW ratio (17/18) is expected — this is the project's first frontend feature. All backend infrastructure is reused as-is from 008-gateway-api.
