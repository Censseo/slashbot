# Implementation Plan: Chat UI

**Branch**: `009-chat-ui` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-chat-ui/spec.md`

## Summary

Build a streaming chat interface using PenguinUI (Alpine.js + Tailwind CSS) that consumes the existing gateway API's SSE streaming endpoint. The UI renders text tokens in real time and shows tool calls as inline collapsible panels. This is a **frontend-only** feature — no backend changes needed. All API endpoints are already implemented by the webui plugin (008-gateway-api).

## Technical Context

**Language/Version**: HTML/CSS/JavaScript (ES2022+) — no build step, served as static files
**Primary Dependencies**: Alpine.js 3.x (CDN), Tailwind CSS (CDN), marked (CDN), highlight.js (CDN)
**Storage**: localStorage (auth token only)
**Testing**: Manual browser testing + Vitest for SSE parser unit tests
**Target Platform**: Modern desktop browsers (Chrome, Firefox, Safari); functional on mobile
**Project Type**: Frontend static files within existing monolith
**Performance Goals**: < 100ms thinking indicator, < 50ms per token render, < 2s initial page load
**Constraints**: No build pipeline; CDN-only dependencies; served by existing gateway static file handler

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Plugin-First Architecture | N/A | Frontend-only; backend already follows plugin pattern |
| Library-First Development | PASS | SSE client as standalone utility, chat logic as Alpine.js component |
| No feature logic in core | PASS | No core changes needed |
| Type safety (no `any`) | N/A | Vanilla JS frontend (no TypeScript in static files) |
| Test-First (TDD) | PASS | SSE parser tested with Vitest |
| Simplicity (YAGNI) | PASS | Minimal abstractions — single page, one Alpine component |
| Performance thresholds | PASS | Targets defined in spec |
| Security (input validation) | PASS | XSS mitigation via HTML-safe Markdown renderer; token in localStorage |

## Architecture Alignment

| Capability | Registry Pattern | Alignment | Notes |
|-----------|-----------------|-----------|-------|
| Static file serving | Gateway Static File Fallback | ALIGNED | Existing pattern from 008-gateway-api |
| SSE consumption | N/A (frontend-only) | NEW | New frontend pattern — consuming SSE from fetch() |
| Auth token management | Bearer Token Auth | ALIGNED | Reusing existing gateway auth mechanism |
| Alpine.js component | N/A | NEW | First frontend component in project |

### New Patterns Introduced

| Pattern | Description | Registry Update Needed |
|---------|-------------|----------------------|
| Alpine.js Chat Component | Reactive chat state management with x-data, message list rendering with x-for | Yes — first frontend pattern |
| Fetch-based SSE Client | POST request with ReadableStream parsing for SSE events | Yes — reusable for future SSE consumers |

### Source Idea Alignment

| Constraint (from idea) | Plan Status | Notes |
|------------------------|-------------|-------|
| PenguinUI (Alpine.js + Tailwind CSS) | ALIGNED | Using as specified |
| No React/Vue/Svelte build pipeline | ALIGNED | CDN-only, static files |
| Static files served by gateway | ALIGNED | Using existing static file handler |
| SSE via fetch (not EventSource) | ALIGNED | POST requires fetch, not EventSource |
| Tool calls inline within message flow | ALIGNED | Content parts model with interleaved text/tool-call |
| `marked` for Markdown | ALIGNED | Via CDN |
| Bearer token auth | ALIGNED | Reusing gateway auth |

## Project Structure

### Documentation (this feature)

```text
specs/009-chat-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
frontend/public/
├── index.html              # Main SPA page — layout, Alpine.js init, CDN imports
├── css/
│   └── app.css             # Custom styles beyond Tailwind utilities
└── js/
    ├── chat.js             # Alpine.js chat component (state, methods, event handlers)
    └── sse-client.js       # SSE stream parser utility (fetch + ReadableStream)

tests/
└── frontend/
    └── sse-client.test.ts  # Unit tests for SSE parser
```

**Structure Decision**: Frontend static files in `frontend/public/` matching the existing static file handler configuration. No build step — all dependencies via CDN.

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:

- [x] Phase 0: Research complete (/specforge.plan command)
- [x] Phase 1: Design complete (/specforge.plan command)
- [x] Phase 2: Task planning complete (/specforge.plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/specforge.tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none needed — simple frontend feature)

## Reuse Summary

| Category | Count | Details |
|----------|-------|---------|
| REUSE (as-is) | 4 | Gateway API (POST /api/chat), static file handler, bearer token auth, SSE event format |
| REUSE (pattern) | 1 | localStorage persistence (from root index.html) |
| NEW | 4 | index.html chat page, chat.js Alpine component, sse-client.js utility, app.css styles |

## Phase 2 Approach

Task planning will be organized in 3 phases:

1. **Foundation**: SSE client utility (fetch + ReadableStream parser), project structure setup, CDN imports
2. **Core UI**: Chat layout (message area + input), Alpine.js component with streaming, tool call panels, Markdown rendering
3. **Polish & Testing**: Token prompt, error handling, responsive layout, auto-scroll, accessibility, SSE parser unit tests
