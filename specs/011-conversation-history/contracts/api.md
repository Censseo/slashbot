# API Contracts: Conversation History

**Feature**: 011-conversation-history
**Date**: 2026-03-17

## Endpoints

### GET /api/conversations (NEW)

List all conversations for the sidebar.

**Request**: None (query params: none)

**Response** (200):
```json
{
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Debugging the auth middleware",
      "createdAt": "2026-03-17T10:00:00Z",
      "updatedAt": "2026-03-17T10:30:00Z",
      "preview": "I found the issue in the bearer token validation...",
      "messageCount": 12
    }
  ]
}
```

**Auth**: Bearer token required

---

### GET /api/conversations/:id (NEW)

Load full conversation history.

**Request**: Path param `id` (UUID v4)

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Debugging the auth middleware",
  "createdAt": "2026-03-17T10:00:00Z",
  "updatedAt": "2026-03-17T10:30:00Z",
  "messages": [
    { "ts": "2026-03-17T10:00:00Z", "msg": { "role": "user", "content": "Help me debug..." } },
    { "ts": "2026-03-17T10:00:05Z", "msg": { "role": "assistant", "content": "Let me look..." } },
    { "ts": "2026-03-17T10:00:06Z", "msg": { "role": "assistant", "content": "", "toolCalls": [{ "id": "tc_1", "name": "bash", "args": { "command": "cat src/auth.ts" } }] } },
    { "ts": "2026-03-17T10:00:07Z", "msg": { "role": "tool", "toolCallId": "tc_1", "content": "export class AuthMiddleware..." } }
  ]
}
```

**Response** (404): `{ "error": "Conversation not found" }`

**Response** (400): `{ "error": "Invalid conversation ID" }`

**Auth**: Bearer token required

---

### DELETE /api/conversations/:id (NEW)

Delete a single conversation.

**Request**: Path param `id` (UUID v4)

**Response** (200): `{ "deleted": true }`

**Response** (404): `{ "error": "Conversation not found" }`

**Auth**: Bearer token required

---

### POST /api/chat (MODIFIED — existing endpoint)

Extended to support persistent conversations.

**Request body** (unchanged):
```json
{
  "message": "Hello",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Behavior changes**:
- If `sessionId` provided: load conversation from disk, append new messages, persist after response
- If `sessionId` omitted: create new conversation, persist after first exchange
- New SSE event added to stream:

```json
{ "type": "conversation-update", "payload": { "id": "...", "title": "...", "preview": "..." } }
```

This event is emitted after:
1. A new conversation is created (with generated title)
2. The title is generated for the first time

**Done event** (unchanged): `{ "type": "done", "payload": { "sessionId": "..." } }`

---

## Zod Schemas

```typescript
// Request validation
const ConversationIdSchema = z.string().uuid();

// Conversation metadata (for index)
const ConversationMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(100).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  preview: z.string().max(100).nullable(),
  messageCount: z.number().int().min(0),
});

// Conversation message (JSONL line)
const ConversationMessageSchema = z.object({
  ts: z.string().datetime(),
  msg: z.union([
    z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.any() }),
    z.object({ role: z.literal('assistant'), content: z.any(), toolCalls: z.array(z.any()) }),
    z.object({ role: z.literal('tool'), toolCallId: z.string(), content: z.string() }),
  ]),
});

// Index file
const ConversationIndexSchema = z.object({
  conversations: z.array(ConversationMetadataSchema),
});
```
