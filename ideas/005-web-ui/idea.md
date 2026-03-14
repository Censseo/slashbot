# Idea: Slashbot Web UI

**Created**: 2026-03-09
**Status**: Exploration
**Short Name**: web-ui

## Vision

A self-hosted web interface for slashbot that combines a real-time AI chat experience with an administration dashboard. Users interact with the bot through a streaming chat UI that exposes tool calls and skill execution in real time, while also being able to monitor and manage the bot's plugins, configuration, Node-RED flows, and association graph from the same interface.

## Problem Statement

### The Problem
Interacting with slashbot currently requires going through platform connectors (Discord, Telegram) or CLI. There's no unified interface to both chat with the bot and administer it. Debugging tool calls and understanding what the bot does under the hood requires reading logs.

### Current Situation
- Chat interactions happen through external platforms (Discord, Telegram)
- No visibility into tool calls, skill execution, or reasoning during conversations
- Administration requires direct config file editing or separate tools (Node-RED editor)
- No centralized dashboard to see system state

### Why Now?
Slashbot has matured with plugins, skills, Node-RED integration, and an association graph. A unified web interface would make the full system accessible and transparent from a single place.

## Target Users

### Primary Users
- **Self-hosted operator (solo)**: The developer/owner running slashbot on their own server. Technically proficient, wants full visibility and control. Needs both a convenient chat interface and admin capabilities.

### Secondary Stakeholders
- None — single-user self-hosted deployment.

## Goals & Success Metrics

### Primary Goals
1. Provide a streaming chat interface with real-time tool call visibility
2. Offer an admin dashboard for monitoring and managing slashbot components
3. Keep the stack lightweight and easy to self-host (no heavy build pipeline)

### Success Indicators
- Can have a full conversation with streaming responses and visible tool calls
- Can view plugin status, logs, config, and Node-RED flows from the dashboard
- Page loads fast, no npm build step required for development

### MVP Definition
A working chat interface with streaming responses and tool call display, plus a basic dashboard showing plugin status and logs. Admin features can be minimal in v1.

## Scope

### In Scope (MVP)
- Chat page with streaming responses (SSE or WebSocket)
- Tool call / skill execution visibility in real time during chat
- Basic admin dashboard: plugin list + status, live logs
- Gateway mode API for the web frontend to communicate with slashbot
- Lightweight frontend: PenguinUI (Alpine.js + Tailwind CSS)

### In Scope (Future)
- Multi-conversation history and persistence
- Node-RED flow management from the dashboard
- Association graph visualization
- Configuration editing from the UI
- Dark mode / theming

### Explicitly Out of Scope
- Multi-user support, authentication beyond basic self-hosted protection
- Mobile-first design (desktop-first, responsive is nice-to-have)
- Replacing existing platform connectors (Discord, Telegram remain separate)
- Hosting/deployment automation (user manages their own server)

## Key Use Cases (Sketches)

### Use Case 1: Chat with Streaming & Tool Visibility
**Actor**: Self-hosted operator
**Goal**: Have a conversation with slashbot and see what it's doing
**Flow**:
1. Open the web UI in a browser
2. Type a message in the chat input
3. See the bot's response stream in real time
4. See tool calls appear as they execute (collapsible panels showing tool name, input, output)
5. Final response renders with markdown formatting

### Use Case 2: Monitor System Status
**Actor**: Self-hosted operator
**Goal**: Check that everything is running correctly
**Flow**:
1. Navigate to the admin dashboard
2. See a list of loaded plugins with their status (active, error, disabled)
3. View live log stream
4. Check Node-RED connection status

### Use Case 3: Inspect a Past Conversation
**Actor**: Self-hosted operator
**Goal**: Review what happened in a previous chat
**Flow**:
1. Open conversation history sidebar
2. Select a past conversation
3. See full message history including tool calls and their results

## Constraints & Assumptions

### Known Constraints
- **Technical**: Must work with slashbot's existing InversifyJS DI architecture and plugin system. Frontend must be lightweight (no React/Vue/Svelte build pipeline).
- **Business**: Single developer, self-hosted only.
- **User**: Desktop browser primary target.

### Assumptions
- PenguinUI (Alpine.js + Tailwind CSS) provides sufficient components for a chat UI and dashboard
- The existing SlashbotGateway (`src/core/gateway/server.ts`) can be extended with HTTP routes and RPC methods for the web UI — no new server needed
- SSE or WebSocket can be used for streaming from the existing Vercel AI SDK integration (gateway already supports both HTTP routes and WebSocket)
- Static HTML + Alpine.js can be served directly by the existing gateway server (no separate frontend server)
- Existing bearer token auth is sufficient for self-hosted single-user access

## Features Overview

**Complexity Score**: 7/10 - Complex

(2 user types × 0 = 0) + (4 capabilities × 1.5 = 6) + (1 phase × 1 = 1) + (1 domain × 2 = 2) + (2 integrations × 1 = 2) + (3 entities × 0.5 = 1.5) = **12.5** → Very Complex

### Feature Breakdown

| # | Feature | Description | Priority | Dependencies | Status |
|---|---------|-------------|----------|--------------|--------|
| 01 | gateway-api | HTTP gateway API exposing slashbot chat and admin endpoints with streaming support | P1/MVP | None | 📝 Specified |
| 02 | chat-ui | Streaming chat interface with tool call visibility using PenguinUI/Alpine.js | P1/MVP | 01 | 📝 Specified |
| 03 | admin-dashboard | Dashboard showing plugin status, live logs, and system health | P1/MVP | 01 | 📝 Specified |
| 04 | conversation-history | Persistent conversation storage and browsing | P2 | 01, 02 | 🔲 Not specified |
| 05 | nodered-management | Node-RED flow viewing and management from the web UI | P2 | 01, 03 | 🔲 Not specified |
| 06 | graph-visualization | Association graph visualization and exploration | P3 | 01, 03 | 🔲 Not specified |

**Status Legend**: 🔲 Not specified → 📝 Specified → ✅ Implemented

### Feature Dependencies Graph

```text
[01-gateway-api]
    ├── [02-chat-ui]
    │       └── [04-conversation-history]
    └── [03-admin-dashboard]
            ├── [05-nodered-management]
            └── [06-graph-visualization]
```

### Implementation Order

1. **Phase 1 (MVP)**: 01-gateway-api, 02-chat-ui, 03-admin-dashboard
2. **Phase 2**: 04-conversation-history, 05-nodered-management
3. **Phase 3**: 06-graph-visualization

## Open Questions & Risks

### Questions to Resolve
- SSE vs WebSocket for streaming? (SSE simpler, WS allows cancellation)
- How to serve the frontend? (static files from slashbot process, or separate?)
- Basic auth or token-based protection for self-hosted access?

### Identified Risks
- **Alpine.js limitations**: Complex real-time UI (streaming tokens, collapsible tool calls) may push Alpine.js boundaries → Mitigation: prototype the chat component early
- **Gateway API design**: Needs to cleanly expose internal slashbot capabilities without tight coupling → Mitigation: design API contract in spec phase

## Discovery Notes

### Session 2026-03-09
- Q: What problem does this solve? → A: Both a standalone chat AI interface (B) and an admin dashboard (C)
- Q: Who are the users? → A: Self-hosted, personal use only (A)
- Q: What admin features? → A: Plugins, logs, config, Node-RED flows, association graph
- Q: Chat UX level? → A: Advanced with visible tool calls in real time (C)
- Q: Frontend tech? → A: PenguinUI (Alpine.js + Tailwind CSS) — lightweight, copy-paste components with AI chatbot support

## Technical Hints

### Required Tools & Versions

- **PenguinUI**: latest - Alpine.js + Tailwind CSS component library with AI chat components
- **Alpine.js**: 3.x - Reactive frontend framework (included via CDN)
- **Tailwind CSS**: 3.x or 4.x - Utility-first CSS (via CDN or build)

### Implementation Notes

- Frontend should be servable as static files from the slashbot process (no separate server)
- Streaming should leverage the existing Vercel AI SDK integration in slashbot
- Gateway API should be a slashbot plugin following existing plugin architecture
- Tool call visibility requires structured streaming (not just text tokens)
