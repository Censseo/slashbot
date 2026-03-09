# Feature Specification: Chat UI

**Feature Branch**: `009-chat-ui`
**Created**: 2026-03-09
**Status**: Draft
**Source**: [Feature 02](../../ideas/005-web-ui/features/02-chat-ui.md)
**Parent Idea**: [idea.md](../../ideas/005-web-ui/idea.md)


## Clarifications

### Session 2026-03-09

- Q: How are text segments and tool calls interleaved within a single assistant message? → A: A single assistant message contains an ordered list of "content parts" — each part is either a text segment or a tool call. Text arriving before a tool call is one segment; text arriving after is another. This preserves chronological ordering of the stream.
- Q: How does the operator initially provide the auth token when first loading the UI? → A: On first load (or upon receiving a 401 response), the UI displays a token input prompt. The entered token is saved to localStorage and used for all subsequent API requests.
- Q: How should the frontend handle SSE keepalive comments? → A: SSE comment lines (lines starting with `:`) are silently ignored per standard SSE protocol. The gateway sends `:keepalive` every 15 seconds to prevent connection timeout.
- Q: Does the spec need to account for server-side session capacity limits? → A: Yes. The server manages chat sessions in-memory with a capacity limit. If capacity is reached, the oldest sessions are evicted. The frontend handles a missing session gracefully by starting a new conversation if the server no longer recognizes the sessionId.
- Q: Should Markdown be rendered incrementally during streaming or only after stream completion? → A: Raw text is displayed during streaming for performance; Markdown formatting is applied once the stream completes or during natural pauses (e.g., after a tool call result). This avoids rendering artifacts from incomplete Markdown fragments.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Streaming Chat Conversation (Priority: P1)

The operator opens the web UI in a browser, types a message in the chat input, and receives a streaming response rendered token by token. The response is formatted as Markdown and appears progressively as the LLM generates it. The operator can send another message once the response is complete.

**Why this priority**: This is the core value — without streaming chat rendering, the UI has no purpose. Everything else builds on this foundation.

**Independent Test**: Can be fully tested by loading the chat page, sending a message, and verifying that the response streams in visually token by token with proper Markdown formatting.

**Acceptance Scenarios**:

1. **Given** the chat page is loaded and the operator is authenticated, **When** the operator types a message and presses Enter (or clicks send), **Then** the message appears in the chat as a user bubble and a streaming response begins rendering below it.
2. **Given** a response is streaming, **When** new text tokens arrive from the server, **Then** each token is appended to the response in real time without page reload or flicker.
3. **Given** a response contains Markdown (headings, bold, code blocks, lists), **When** the response finishes streaming, **Then** the Markdown is rendered with proper formatting (syntax highlighting for code blocks).
4. **Given** the response is still streaming, **When** the operator observes the chat, **Then** a visual indicator (e.g., pulsing cursor or typing animation) signals that the response is in progress.
5. **Given** no response is being generated, **When** the operator views the chat input, **Then** the input is enabled, focused, and ready for the next message.

---

### User Story 2 - Tool Call Visibility (Priority: P1)

When the bot invokes tools during response generation, each tool call appears inline within the message flow as a collapsible panel. The panel shows the tool name, parameters, execution status (running/done/error), and the result. Tool calls are interleaved with text content in the order they occur.

**Why this priority**: Tool call transparency is the key differentiator of this chat UI — it shows not just what the bot says but what it does. This is equally critical to streaming text.

**Independent Test**: Can be tested by sending a message that triggers a tool call and verifying the tool call panel appears with correct information and is collapsible.

**Acceptance Scenarios**:

1. **Given** the bot invokes a tool during response generation, **When** the tool-call-start event arrives, **Then** a tool call panel appears inline in the message flow showing the tool name and its parameters.
2. **Given** a tool call panel is displayed with "running" status, **When** the tool-call-result event arrives, **Then** the panel updates to show the result and its status changes to "done" (or "error" if the tool failed).
3. **Given** a tool call panel is visible, **When** the operator clicks on it, **Then** the panel collapses or expands to show/hide the parameters and result details.
4. **Given** the bot invokes multiple tools during a single response, **When** all tool calls complete, **Then** each tool call is shown as a separate inline panel in chronological order, interleaved with any text that appeared between them.
5. **Given** a tool call fails, **When** the error result arrives, **Then** the panel shows an error state with the error message visually distinguished from successful results.

---

### User Story 3 - Chat Input & Interaction (Priority: P2)

The chat input area provides a comfortable text entry experience with keyboard shortcuts and visual feedback. The operator can send messages with Enter, use Shift+Enter for newlines, and the input is disabled while a response is streaming.

**Why this priority**: Good input UX is important but secondary to the output rendering — the operator needs a functional input to use the chat at all, but refinements are lower priority.

**Independent Test**: Can be tested by interacting with the chat input — typing, sending with Enter, verifying Shift+Enter creates newlines, and confirming the input disables during streaming.

**Acceptance Scenarios**:

1. **Given** the chat input is focused, **When** the operator presses Enter (without Shift), **Then** the message is sent and the input is cleared.
2. **Given** the chat input is focused, **When** the operator presses Shift+Enter, **Then** a newline is inserted in the input without sending the message.
3. **Given** a response is currently streaming, **When** the operator views the chat input, **Then** the input and send button are visually disabled until the response completes.
4. **Given** the operator types a message, **When** the message is empty or whitespace-only, **Then** the send button is disabled and pressing Enter does nothing.

---

### User Story 4 - Thinking/Loading Indicator (Priority: P2)

After the operator sends a message, a thinking indicator appears immediately to signal that the system is processing. This indicator persists until the first text token or tool call event arrives.

**Why this priority**: Provides essential feedback that the system is working, reducing uncertainty during the latency gap between sending and first response.

**Independent Test**: Can be tested by sending a message and verifying a thinking indicator appears before any response content.

**Acceptance Scenarios**:

1. **Given** the operator sends a message, **When** the message is dispatched to the server, **Then** a thinking/loading indicator appears in the chat area within 100ms of sending.
2. **Given** a thinking indicator is displayed, **When** the first streaming event (text-delta or tool-call-start) arrives, **Then** the thinking indicator is replaced by the actual response content.

---

### User Story 5 - Responsive Layout (Priority: P3)

The chat interface adapts to different screen sizes, optimized for desktop but usable on tablet and mobile browsers. The message area fills available vertical space, and the input stays anchored at the bottom.

**Why this priority**: Desktop-first design covers the primary use case; responsive behavior is nice-to-have for occasional mobile access.

**Independent Test**: Can be tested by resizing the browser window and verifying the layout adapts without breaking — messages remain readable, input stays accessible.

**Acceptance Scenarios**:

1. **Given** the chat page is open on a desktop browser (≥1024px wide), **When** the operator views the layout, **Then** the chat occupies a comfortable centered column with appropriate margins.
2. **Given** the chat page is open on a narrow viewport (<768px), **When** the operator views the layout, **Then** the chat fills the full width, messages are still readable, and the input remains anchored at the bottom.
3. **Given** a long conversation with many messages, **When** a new message or response appears, **Then** the chat area auto-scrolls to show the latest content.

---

### Edge Cases

- What happens when the server connection is lost mid-stream? The partial response remains visible, an error message appears, and the input re-enables.
- What happens when the operator sends a very long message? The input area expands vertically (up to a maximum height) to accommodate the text.
- What happens when a tool call result is very large (e.g., long JSON)? Results exceeding 1000 characters are truncated with a "show more" toggle, preventing the panel from dominating the view.
- What happens when the operator rapidly sends multiple messages? Only one message is sent at a time; the input is disabled while a response is streaming.
- What happens when the page is refreshed? The conversation is lost (no persistence in this feature); the chat starts fresh.
- Should there be a cancel button for in-progress responses? Not in this feature — the gateway does not currently support stream cancellation. The operator waits for the response to complete.
- What happens when the server evicts the current session due to capacity? The server creates a new session transparently; the frontend updates its stored session ID from the next `done` event. Previous conversation context on the server is lost.

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Server connection lost during streaming | "Connection lost. Response may be incomplete." | Partial response preserved, input re-enabled, retry possible |
| Server returns 401 Unauthorized | "Authentication required. Please enter your access token." | Display token input prompt; save entered token to localStorage for future use |
| Server returns 500 Internal Error | "Something went wrong. Please try again." | Input re-enabled, retry button available |
| Empty response from server (stream closes with no content) | "No response received. The bot may be unavailable." | Input re-enabled, retry possible |
| Network timeout (no response within 30s) | "Request timed out. Please try again." | Input re-enabled, retry possible |
| Malformed SSE event received | Error silently logged; streaming continues with remaining events | No user action needed |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a chat interface with a scrollable message area and a fixed-position input area at the bottom.
- **FR-002**: System MUST send the operator's message to the chat API endpoint and consume the SSE streaming response.
- **FR-003**: System MUST render incoming `text-delta` events by appending text tokens to the current response in real time.
- **FR-004**: System MUST render incoming `tool-call-start` events as inline collapsible panels showing tool name and parameters displayed as formatted JSON. Parameters exceeding 500 characters MUST be truncated with a "show more" toggle.
- **FR-005**: System MUST update tool call panels when `tool-call-result` events arrive, displaying the result and updating the status indicator.
- **FR-006**: System MUST display raw text during streaming and apply Markdown formatting (headings, bold, italic, code blocks, lists, links) once the stream completes or after a tool-call-result event is received (re-rendering the preceding text segment).
- **FR-007**: System MUST display a thinking/loading indicator between message send and first response event.
- **FR-008**: System MUST disable the chat input and send button while a response is streaming.
- **FR-009**: System MUST support sending messages via Enter key and inserting newlines via Shift+Enter.
- **FR-010**: System MUST auto-scroll the message area to the latest content when new messages or response tokens arrive, UNLESS the operator has manually scrolled up. Auto-scroll MUST resume when the operator scrolls back to the bottom.
- **FR-011**: System MUST display tool call panels as collapsible — expanded by default during streaming, collapsible after completion.
- **FR-012**: System MUST visually distinguish between user messages and bot responses (different alignment, styling, or color).
- **FR-013**: System MUST handle stream errors gracefully — display an error message, preserve any partial response, and re-enable the input.
- **FR-014**: System MUST include the session identifier from the `done` event in subsequent chat requests to maintain conversation continuity within a session.
- **FR-015**: System MUST authenticate API requests using a bearer token stored client-side in localStorage.
- **FR-016**: System MUST display a centered overlay with a token input field and submit button on first load (when no token exists in localStorage) or when a 401 response is received. The entered token MUST be saved to localStorage upon submission.
- **FR-017**: System MUST silently ignore SSE comment lines (keepalive signals) during stream processing.
- **FR-018**: System MUST start a new conversation gracefully if the server no longer recognizes the current session identifier (session evicted due to capacity).
- **FR-019**: System MUST validate incoming SSE event JSON before processing — malformed JSON MUST be silently discarded without interrupting the stream.
- **FR-020**: System MUST use appropriate ARIA landmarks (main for chat area, form for input) and aria-live="polite" regions for tool call status updates and error messages.

### Key Entities

- **Chat Message**: A single message in the conversation — has a role (user or assistant) and an ordered list of content parts. Each content part is either a text segment or a tool call reference. This ordered list preserves the chronological interleaving of text and tool calls as they occurred during streaming.
- **Tool Call**: A tool invocation that occurred during response generation — has a tool identifier, tool name, parameters, execution status (pending/running/done/error), and result.
- **Chat Session**: A conversation context identified by a session ID, maintained across multiple message exchanges within a single page session.

## Accessibility Requirements *(mandatory for UI features)*

| Requirement | Applies? | Acceptance Criteria |
|-------------|----------|---------------------|
| Keyboard navigation | Yes | Chat input focusable via Tab; Enter to send; Shift+Enter for newline; Tab to navigate tool call panels; Enter/Space to toggle collapse |
| Screen reader support | Yes | Messages announced with role (user/assistant); tool call status changes announced via aria-live region; input has proper label |
| Color contrast | Yes | 4.5:1 for message text, 3:1 for UI controls; status indicators not conveyed by color alone |
| Focus indicators | Yes | Visible focus ring on input, send button, and collapsible tool call panels |
| Reduced motion | Yes | Streaming text animation and thinking indicator respect `prefers-reduced-motion` |
| Touch targets | Yes | Send button and tool call collapse toggles minimum 44x44 CSS pixels |

**Additional accessibility notes**: Tool call status (running/done/error) conveyed through both icon and text label, not color alone.

## Performance Requirements *(include if performance-sensitive)*

| Metric | Target | Justification |
|--------|--------|---------------|
| Time from send to thinking indicator | < 100ms | Immediate feedback is critical for perceived responsiveness |
| Time from first SSE event to visible render | < 50ms | Streaming tokens must appear instantly |
| Markdown rendering after stream complete | < 200ms | Final formatting should feel instantaneous |
| Smooth scrolling during streaming | 60fps | No jank while appending tokens |
| Page initial load (LCP) | < 2s | Lightweight page with CDN assets |

### Degradation Scenarios

- With 100+ messages in a single session, rendering performance may degrade. The system SHOULD remain usable with up to 200 messages per session.
- Very large tool call results (>10KB) MAY be truncated in the default view to maintain rendering performance.

## Security Considerations *(mandatory — handles auth and external input)*

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Authentication | Bearer token required for all API calls | Token stored in browser localStorage; sent as Authorization header |
| XSS via bot responses | Sanitize Markdown output before rendering | Use a Markdown renderer that escapes HTML by default |
| XSS via tool call results | Escape tool call parameters and results before display | Render as preformatted text or escaped HTML |
| Token exposure | Token not logged or displayed in UI | Excluded from console logs and DOM attributes |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can send a message and see a streaming response rendered token by token, with the first token visible within 1 second of sending (network latency included).
- **SC-002**: Tool calls triggered during a response are visible as inline collapsible panels showing tool name, parameters, status, and result.
- **SC-003**: The chat supports multi-turn conversation within a session — subsequent messages maintain conversation context.
- **SC-004**: Markdown formatting (headings, bold, code blocks, lists) renders correctly in bot responses.
- **SC-005**: The interface is usable on desktop (≥1024px) and functional on mobile viewports (≥375px).

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [ideas/005-web-ui/idea.md](../../ideas/005-web-ui/idea.md)
- **Feature**: [ideas/005-web-ui/features/02-chat-ui.md](../../ideas/005-web-ui/features/02-chat-ui.md)

### Technical Constraints
- Must work with slashbot's existing InversifyJS DI architecture and plugin system
- Frontend must be lightweight (no React/Vue/Svelte build pipeline) — PenguinUI (Alpine.js + Tailwind CSS)
- Single developer, self-hosted only
- Desktop browser primary target
- Static HTML + Alpine.js served directly by the existing gateway server (no separate frontend server)

### Implementation Guidance
- Use PenguinUI's AI chatbot component as a starting point, extend for tool call panels
- Alpine.js `x-data` for chat state (messages array, streaming state, tool calls)
- `fetch()` with `ReadableStream` for consuming the SSE streaming API from POST /api/chat
- Tool calls should be inline within the message flow (not in a separate panel)
- Consider using `<template x-for>` for message list rendering
- Markdown rendering via `marked` or similar lightweight library
- Gateway API contract defined in specs/008-gateway-api/contracts/api.md — POST /api/chat returns SSE with text-delta, tool-call-start, tool-call-result, done events

### Discovery Decisions
- SSE via fetch (not EventSource) for chat since POST method is needed (EventSource is GET-only)
- PenguinUI has AI chatbot components that serve as starting point
- Tool call visibility is the main innovation — inline collapsible panels showing execution in real time
