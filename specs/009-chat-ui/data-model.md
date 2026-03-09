# Data Model: Chat UI

**Branch**: `009-chat-ui` | **Date**: 2026-03-09

## Entities

All entities are **frontend-only** (Alpine.js reactive state). No backend changes needed.

### ChatMessage (NEW — frontend only)

Represents a single message in the conversation.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique message ID (generated client-side) |
| role | 'user' \| 'assistant' | Who sent the message |
| parts | ContentPart[] | Ordered list of content parts (text segments and tool calls) |
| isStreaming | boolean | Whether this message is currently being streamed |
| error | string \| null | Error message if stream failed |

### ContentPart (NEW — frontend only)

A single part within an assistant message. Preserves chronological interleaving of text and tool calls.

| Variant | Fields | Description |
|---------|--------|-------------|
| text | { type: 'text', text: string } | A text segment (raw during streaming, Markdown-rendered after) |
| tool-call | { type: 'tool-call', toolId: string, toolName: string, args: object, status: 'running' \| 'done' \| 'error', result: string \| null, success: boolean \| null } | A tool invocation with lifecycle state |

### ChatState (NEW — frontend only)

Top-level Alpine.js reactive state for the chat component.

| Field | Type | Description |
|-------|------|-------------|
| messages | ChatMessage[] | All messages in current session |
| sessionId | string \| null | Current session ID (from server `done` event) |
| isStreaming | boolean | Whether a response is currently streaming |
| token | string \| null | Bearer auth token (persisted in localStorage) |
| showTokenPrompt | boolean | Whether to show the token input overlay |
| inputText | string | Current text in the input field |
| error | string \| null | Global error message |

## Entity Relationships

```text
ChatState
  ├── messages: ChatMessage[]
  │     └── parts: ContentPart[]
  │           ├── TextPart (text segments)
  │           └── ToolCallPart (tool invocations)
  ├── sessionId (from server done event)
  └── token (from localStorage)
```

## State Transitions

### ChatMessage Lifecycle

```
[created as user message] → displayed immediately
[created as assistant message with isStreaming=true] → accumulates parts from SSE events → [isStreaming=false on done/error]
```

### ToolCallPart Lifecycle

```
[created on tool-call-start with status='running'] → [updated on tool-call-result with status='done'|'error']
```

### ChatState.showTokenPrompt

```
[true on first load if no token in localStorage] → [false after token entered]
[true on 401 response] → [false after new token entered]
```
