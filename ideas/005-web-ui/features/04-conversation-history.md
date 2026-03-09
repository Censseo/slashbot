# Feature: Conversation History

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 04
**Priority**: P2
**Status**: Not Specified

## Summary

Persistent conversation storage with a sidebar for browsing and resuming past conversations. Conversations include full message history with tool call records.

## User Value

**Who benefits**: Self-hosted operator
**What they gain**: Ability to review past interactions, resume conversations, and keep context across sessions
**Success metric**: Past conversations are persisted and can be loaded with full tool call history

## Scope

### This Feature Includes
- Conversation persistence (JSONL or SQLite)
- Sidebar with conversation list (title, date, preview)
- Load and resume past conversations
- New conversation button
- Conversation title auto-generation

### This Feature Does NOT Include
- Search across conversations
- Export/import conversations
- Sharing conversations

## Dependencies

### Requires
- Feature 01 (gateway-api): storage and retrieval endpoints
- Feature 02 (chat-ui): chat interface to extend

### Enables
- Nothing directly

## Technical Hints

### Implementation Notes

- JSONL storage per conversation in `~/.slashbot/web-ui/conversations/`
- Conversation metadata index for fast sidebar loading
- Tool call results should be stored alongside messages

## Open Questions

- JSONL vs SQLite for conversation storage?
- How to generate conversation titles? (LLM summary or first message?)
