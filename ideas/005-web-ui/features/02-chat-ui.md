# Feature: Chat UI

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 02
**Priority**: P1/MVP
**Status**: Specified

## Summary

A streaming chat interface built with PenguinUI (Alpine.js + Tailwind CSS) that displays bot responses in real time with full visibility into tool calls and skill execution. The UI renders streaming text tokens as they arrive and shows tool calls as collapsible panels with their inputs and outputs.

## User Value

**Who benefits**: Self-hosted operator
**What they gain**: A transparent, real-time chat experience that shows not just what the bot says but what it does
**Success metric**: Can hold a conversation with streaming responses; tool calls are visible and inspectable during execution

## Scope

### This Feature Includes
- Chat message input with send button and keyboard shortcut (Enter)
- Streaming response rendering (token by token)
- Tool call panels: collapsible, showing tool name, parameters, status (running/done/error), and result
- Markdown rendering for bot responses
- Single conversation per session (no history browsing yet)
- Responsive layout (desktop-first)
- Loading/thinking indicators

### This Feature Does NOT Include
- Conversation history / persistence (feature 04)
- Multi-conversation sidebar (feature 04)
- Admin dashboard panels (feature 03)
- File upload or image support
- Voice input

## Key Use Cases

### Use Case 1: Chat with Tool Visibility
**Actor**: Self-hosted operator
**Goal**: Ask the bot something that triggers tools and see everything
**Flow**:
1. Type "What's the weather in Tokyo?" in the chat input
2. See a "thinking" indicator
3. See a tool call panel appear: `weather-lookup` with params `{city: "Tokyo"}`
4. Panel shows "running..." then updates with the result
5. Bot's text response streams in below/after the tool call
6. Tool call panel is collapsible (click to expand/collapse)

### Use Case 2: Simple Chat
**Actor**: Self-hosted operator
**Goal**: Quick question without tools
**Flow**:
1. Type a question
2. Response streams in token by token with markdown rendering
3. No tool panels appear

## Dependencies

### Requires
- Feature 01 (gateway-api): provides the streaming chat endpoint

### Enables
- Feature 04 (conversation-history): builds on this chat UI with persistence

## Technical Hints

### Required Tools & Versions

- **PenguinUI**: latest - chat component as starting point
- **Alpine.js**: 3.x - reactivity for streaming state management
- **marked** or similar: lightweight markdown parser for response rendering

### Implementation Notes

- Use PenguinUI's AI chatbot component as a starting point, extend for tool call panels
- Alpine.js `x-data` for chat state (messages array, streaming state, tool calls)
- EventSource (SSE) or fetch with ReadableStream for consuming the streaming API
- Tool calls should be inline within the message flow (not in a separate panel)
- Consider using `<template x-for>` for message list rendering

## Open Questions

- How to render tool calls inline with streaming text? (interleaved events)
- Should tool call results be syntax-highlighted (JSON)?
- Cancel button for in-progress responses?

## Notes

PenguinUI has AI chatbot components that can serve as a starting point. The main innovation here is the tool call visibility — most chat UIs don't show this. Think of it like Claude's "thinking" blocks but for tool execution.
