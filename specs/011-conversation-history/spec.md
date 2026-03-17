# Feature Specification: Conversation History

**Feature Branch**: `011-conversation-history`
**Created**: 2026-03-17
**Status**: Draft
**Source**: [Feature 04](../../ideas/005-web-ui/features/04-conversation-history.md)
**Parent Idea**: [idea.md](../../ideas/005-web-ui/idea.md)
**Input**: Persistent conversation storage with sidebar for browsing and resuming past conversations

## Clarifications

### Session 2026-03-17

- Q: What format should conversation IDs use? → A: UUID v4, matching existing `sessionId` pattern in the gateway chat handler.
- Q: How should conversation history be loaded into the agent loop on resume? → A: Load messages from JSONL file into the existing in-memory `sessions` Map, then pass to `llm.complete()` as usual.
- Q: Should this reuse the existing `FileChatHistoryStore` from connector history? → A: No — new JSONL-per-conversation store. The connector store uses a single flat JSON file per chat ID with 40-message limits, which doesn't fit the conversation history use case (unlimited messages, per-conversation files, append-friendly).
- Q: How should tool call records be stored? → A: Use `RichMessage[]` from `AgentLoopResult.messages` which already captures tool call chains with full metadata (`AgentToolAction` with id, name, args, status, result).
- Q: Should conversation deletion be supported? → A: Yes — add FR-011 for single conversation deletion via API and sidebar UI action.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resume a Past Conversation (Priority: P1)

The operator opens the web UI and wants to continue a conversation they had earlier. They open the sidebar, see a list of past conversations with titles and dates, select one, and the full message history loads — including tool call records — allowing them to continue where they left off.

**Why this priority**: Core value proposition — without persistence, conversations are lost on page reload.

**Independent Test**: Can be tested by sending messages, refreshing the page, and verifying the conversation appears in the sidebar and loads with full history.

**Acceptance Scenarios**:

1. **Given** the operator has had previous conversations, **When** they open the conversation sidebar, **Then** they see a list of conversations sorted by most recent, each showing a title and last activity date.
2. **Given** a conversation is selected from the sidebar, **When** the conversation loads, **Then** all messages (user and assistant) and tool call records are displayed in chronological order.
3. **Given** a past conversation is loaded, **When** the operator sends a new message, **Then** the conversation continues with full prior context available to the assistant.

---

### User Story 2 - Start a New Conversation (Priority: P1)

The operator wants to start a fresh conversation without prior context. They click a "New Conversation" button and get an empty chat ready for input.

**Why this priority**: Equal to resuming — operators need to both start fresh and resume.

**Independent Test**: Can be tested by clicking the new conversation button and verifying an empty chat appears and messages are persisted.

**Acceptance Scenarios**:

1. **Given** the operator is viewing a past conversation, **When** they click "New Conversation", **Then** the chat area clears and a new empty conversation begins.
2. **Given** a new conversation is started, **When** the operator sends the first message and receives a response, **Then** the conversation appears in the sidebar with an auto-generated title.

---

### User Story 3 - Auto-Generated Conversation Titles (Priority: P2)

Conversations automatically receive a descriptive title so the operator can identify them in the sidebar without reading full content.

**Why this priority**: Important for usability but conversations are functional without titles.

**Independent Test**: Can be tested by starting a new conversation and verifying a meaningful title appears in the sidebar after the first exchange.

**Acceptance Scenarios**:

1. **Given** a new conversation has its first user message and assistant response, **When** the title is generated, **Then** the sidebar displays a concise, descriptive title derived from the conversation content.
2. **Given** a conversation exists, **When** it is displayed in the sidebar, **Then** the title is shown alongside a timestamp of the last activity.

---

### User Story 4 - Conversation List with Metadata (Priority: P2)

The sidebar shows conversation metadata — title, date, and a short preview — to help the operator find specific past conversations.

**Why this priority**: Enhances navigation but core functionality works without previews.

**Independent Test**: Can be tested by verifying sidebar entries show title, date, and preview text for multiple conversations.

**Acceptance Scenarios**:

1. **Given** multiple conversations exist, **When** the operator views the sidebar, **Then** each entry shows the title, last activity date (human-readable relative format), and a short preview of the last message.
2. **Given** many conversations exist (50+), **When** the sidebar loads, **Then** conversations load progressively without blocking the UI.

---

### Edge Cases

- What happens when a conversation file is corrupted or missing? The sidebar skips it with no error visible to the user, and a warning is logged.
- What happens when the operator opens the UI with no prior conversations? The sidebar shows an empty state message encouraging the user to start a conversation.
- What happens when two browser tabs modify the same conversation? Last-write-wins — the most recent save takes precedence.
- What happens when disk storage is full? The system shows an error message when attempting to save and does not lose the current in-memory conversation state.

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Conversation file corrupted/unreadable | Conversation silently omitted from sidebar | Warning logged; other conversations unaffected |
| Failed to save conversation to disk | "Failed to save conversation. Your messages are preserved in memory." | Retry on next message; manual refresh |
| Failed to load conversation history | "Could not load this conversation." | Show sidebar with other conversations; retry button |
| API endpoint unreachable | "Connection lost. Retrying..." | Auto-retry with exponential backoff |
| Disk storage full | "Storage full. Cannot save new messages." | Operator frees disk space; messages preserved in memory |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist each conversation as an ordered sequence of messages with their associated tool call records.
- **FR-002**: System MUST provide a sidebar listing all persisted conversations, sorted by most recent activity.
- **FR-003**: System MUST allow the operator to select and load a past conversation with full message and tool call history.
- **FR-004**: System MUST allow the operator to start a new conversation that is immediately persisted upon first exchange.
- **FR-005**: System MUST auto-generate a descriptive title for each conversation after the first assistant response.
- **FR-006**: System MUST continue a loaded conversation with full prior context available to the assistant (sessionId reuse).
- **FR-007**: System MUST display conversation metadata in the sidebar: title, last activity date, and message preview.
- **FR-008**: System MUST store tool call records (tool name, parameters, status, result) alongside the messages that triggered them.
- **FR-009**: When a conversation file is corrupted, the system MUST skip it in the sidebar and log a warning, without affecting other conversations.
- **FR-010**: System MUST provide an API for creating, listing, retrieving, and appending to conversations.
- **FR-011**: System MUST allow the operator to delete a single conversation via the API and from the sidebar UI.

### Key Entities

- **Conversation**: A named sequence of exchanges between the operator and the assistant. Has an ID (UUID v4), title, creation date, last activity date, and an ordered list of messages.
- **Message**: A single turn in a conversation. Has a role (user or assistant), content (text and/or tool call records), and a timestamp. Stored as RichMessage format to preserve full tool call chains.
- **Tool Call Record**: A record of a tool invocation within an assistant message. Has a tool ID, tool name, input parameters, execution status (running/done/error), and result.
- **Conversation Index**: A lightweight summary of all conversations (ID, title, last activity date, preview) used for fast sidebar loading without reading full conversation files.

## Accessibility Requirements *(mandatory for UI features)*

| Requirement | Applies? | Acceptance Criteria |
|-------------|----------|---------------------|
| Keyboard navigation | Yes | Sidebar list navigable with arrow keys, Enter to select, Escape to close. New Conversation button focusable via Tab. |
| Screen reader support | Yes | Sidebar announced as navigation landmark, conversation items have accessible labels (title + date), loading states announced via aria-live. |
| Color contrast | Yes | 4.5:1 for conversation titles and dates, 3:1 for preview text. |
| Focus indicators | Yes | Visible focus ring on sidebar items, new conversation button, and active conversation highlight. |
| Reduced motion | Yes | Sidebar slide animation respects `prefers-reduced-motion`. |
| Touch targets | N/A | Desktop-first; not required. |

## Performance Requirements

| Metric | Target | Justification |
|--------|--------|---------------|
| Sidebar load (conversation list) | < 500ms for 100 conversations | Index file avoids reading all conversation files |
| Conversation load (full history) | < 1s for 500 messages | Acceptable for loading a full conversation |
| Message append (save) | < 100ms | Must not block the chat streaming experience |
| Title generation | < 3s | Background operation, non-blocking |

## Security Considerations

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Conversation data at rest | Stored in user's home directory with OS file permissions | Same security model as existing slashbot config files |
| API authentication | Bearer token required for all conversation endpoints | Reuses existing gateway auth middleware |
| Input validation | Validate conversation IDs, reject path traversal attempts | Conversation IDs must be valid UUID v4 format |
| XSS in stored messages | Messages rendered through existing markdown sanitization | Reuses chat UI's existing rendering pipeline |

## Data & State *(mandatory if feature involves persistence)*

- **Data ownership**: Self-hosted operator owns all conversation data.
- **Access control**: Single-user system; bearer token protects API access.
- **Retention policy**: Conversations persist indefinitely until manually deleted by the operator. No automatic cleanup.
- **Concurrent modification**: Last-write-wins for concurrent browser tabs. In-memory state preserved even if disk write fails.
- **Storage location**: `~/.slashbot/web-ui/conversations/` directory.
- **Storage format**: One JSONL file per conversation for append-friendly writes. Separate metadata index file for fast sidebar loading.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operator can close the browser, reopen it, and resume any past conversation with full message and tool call history intact.
- **SC-002**: Sidebar loads the conversation list within 500ms for up to 100 conversations.
- **SC-003**: Conversation title is auto-generated and visible in the sidebar within 5 seconds of the first assistant response.
- **SC-004**: Starting a new conversation takes fewer than 2 clicks from any state in the UI.
- **SC-005**: Tool call records in loaded conversations display identically to how they appeared during the original live conversation.

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [idea.md](../../ideas/005-web-ui/idea.md)
- **Feature**: [features/04-conversation-history.md](../../ideas/005-web-ui/features/04-conversation-history.md)

### Technical Constraints
- Must work with slashbot's existing InversifyJS DI architecture and plugin system
- Frontend must be lightweight (no React/Vue/Svelte build pipeline)
- Must integrate with existing gateway API and chat UI
- Static HTML + Alpine.js served by existing gateway server

### Implementation Guidance
- JSONL storage per conversation in `~/.slashbot/web-ui/conversations/`
- Conversation metadata index for fast sidebar loading
- Tool call results should be stored alongside messages
- Streaming should leverage the existing Vercel AI SDK integration
- Reuse existing `sessionId` mechanism for conversation continuity

### Discovery Decisions
- JSONL chosen over SQLite for simplicity and append-friendly writes (aligns with existing JSONL patterns in slashbot, e.g., `~/.slashbot/graph.jsonl`)
- Title generation via LLM summary (leverages existing LLM adapter) rather than first-message truncation
