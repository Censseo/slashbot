# Data Model: Conversation History

**Feature**: 011-conversation-history
**Date**: 2026-03-17

## Entities

### Conversation (NEW)

Represents a persistent conversation between the operator and the assistant.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID v4) | Yes | Unique identifier, same as sessionId |
| title | string | No | Auto-generated descriptive title (null until first exchange) |
| createdAt | string (ISO 8601) | Yes | Creation timestamp |
| updatedAt | string (ISO 8601) | Yes | Last activity timestamp |
| preview | string | No | Truncated last assistant message text (max 100 chars) |
| messageCount | number | Yes | Total messages in conversation |

**Storage**: `~/.slashbot/web-ui/conversations/index.json` (metadata index)

**Validation**:
- `id` must be valid UUID v4
- `title` max length 100 characters
- `preview` max length 100 characters

### ConversationMessage (NEW)

A single line in a conversation JSONL file. Uses existing `RichMessage` union type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ts | string (ISO 8601) | Yes | Message timestamp |
| msg | RichMessage | Yes | The message (AgentMessage, ToolCallMessage, or ToolResultMessage) |

**Storage**: `~/.slashbot/web-ui/conversations/{id}.jsonl` (one JSON line per message)

### RichMessage (EXISTING — reused from `src/core/agentic/llm/types.ts`)

Union type: `AgentMessage | ToolCallMessage | ToolResultMessage`

- **AgentMessage**: `{ role: 'system' | 'user' | 'assistant', content: string | ContentPart[] }`
- **ToolCallMessage**: `{ role: 'assistant', content: AgentMessageContent, toolCalls: ToolCallInfo[] }`
- **ToolResultMessage**: `{ role: 'tool', toolCallId: string, content: string }`

### ConversationIndex (NEW)

The metadata index file containing an array of Conversation entries for fast sidebar loading.

| Field | Type | Description |
|-------|------|-------------|
| conversations | Conversation[] | Array of conversation metadata sorted by updatedAt desc |

**Storage**: `~/.slashbot/web-ui/conversations/index.json`

## Entity Relationships

```text
ConversationIndex (index.json)
  └── Conversation[] (metadata entries)
        └── ConversationMessage[] (per {id}.jsonl file)
              └── RichMessage (existing type: AgentMessage | ToolCallMessage | ToolResultMessage)
```

## State Transitions

### Conversation Lifecycle

```text
[created] → [active] → [idle] → [resumed] → [active] → ...
                                                ↓
                                           [deleted]
```

| From | To | Trigger |
|------|----|---------|
| — | created | New conversation button clicked + first message sent |
| created | active | First message exchange completes |
| active | idle | No further messages (browser closed, session expired) |
| idle | resumed | Operator selects conversation from sidebar |
| resumed | active | New message sent in resumed conversation |
| any | deleted | Operator deletes conversation |

## File Layout

```text
~/.slashbot/web-ui/conversations/
├── index.json                    # Conversation metadata index
├── {uuid-1}.jsonl                # Messages for conversation 1
├── {uuid-2}.jsonl                # Messages for conversation 2
└── ...
```
