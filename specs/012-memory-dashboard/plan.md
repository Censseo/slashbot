# Implementation Plan: Memory Dashboard

**Branch**: `012-memory-dashboard` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-memory-dashboard/spec.md`

## Summary

Memory visualization dashboard for the web UI combining an interactive force-directed graph (Cytoscape.js), a memory file explorer with edit/delete capabilities, a chronological timeline of daily notes, a stats bar, and unified search across memory store and association graph. Adds 10 new API endpoints to the existing webui plugin and a new Alpine.js page with 3 sub-tabs.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Bun 1.0+ (backend), JavaScript ES2022+ (frontend)
**Primary Dependencies**: Alpine.js 3.x (CDN), Tailwind CSS (CDN), Cytoscape.js (CDN), marked (CDN), DOMPurify (CDN), Zod v4
**Storage**: Filesystem (`~/.slashbot/memory/`, `~/.slashbot/graph.jsonl`) — read via MemoryStore + AssociationGraph services, write via direct filesystem for edits/deletes
**Testing**: Vitest (unit + integration)
**Target Platform**: Web browser (desktop-first), served from slashbot gateway
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: Graph render < 3s for 1K nodes, search < 500ms, page load < 2.5s
**Constraints**: No build step, CDN-only frontend, single-user auth (bearer token)
**Scale/Scope**: Up to 10K graph nodes, hundreds of memory files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Accessibility | PASS | Keyboard navigation, ARIA roles, color contrast, reduced motion defined in spec |
| Performance | PASS | Measurable thresholds defined: graph render < 3s, search < 500ms, LCP < 2.5s |
| Security | PASS | Path traversal validation, XSS sanitization, bearer token auth, no sensitive data in memory content |
| Error Handling | PASS | All failure modes defined with user messages and recovery actions |
| Data & State | PASS | Storage locations documented, last-write-wins, no new persistent state |
| Plugin-First | PASS | All routes registered in existing webui plugin |
| Library-First | PASS | Handler factories are standalone testable functions |
| Simplicity | PASS | No premature abstractions, filesystem-direct for edit/delete |
| Test-First | PASS | Unit tests for each handler, integration tests for API |

**Initial Gate**: PASS

## Architecture Alignment Report

### Patterns Applied

| Pattern | Source | Status |
|---------|--------|--------|
| Plugin-First Architecture | Registry ADR-001 | ALIGNED — routes registered in webui plugin |
| Library-First Development | Registry | ALIGNED — handler factories are testable standalone |
| Shared Service Registration | Registry (007) | ALIGNED — resolves `memory.store`, `memory.graph` via service IDs |
| Handler Factory Pattern | Existing webui handlers | ALIGNED — same `createXHandler(context)` pattern |
| Alpine.js SPA Component | Existing frontend | ALIGNED — same lifecycle pattern (onShow/onHide) |
| JSON API Response | Existing handlers | ALIGNED — same response pattern |
| Bearer Token Auth | Existing gateway | ALIGNED — all endpoints behind existing auth |

### New Patterns Introduced

| Pattern | Justification | Registry Update |
|---------|---------------|-----------------|
| Filesystem-Direct Operations | MemoryStore lacks edit/delete methods; direct filesystem ops are simplest for single-purpose endpoints | Flag for registry update |
| Optional Service Dependency | AssociationGraph may not exist; dashboard checks at runtime and degrades gracefully | Flag for registry update |
| CDN Graph Library (Cytoscape.js) | First graph visualization in the project; Cytoscape.js is standard, CDN-only, canvas-based | Flag for registry update |

### Divergences

None. All patterns align with established architecture.

## Idea Alignment

### Source
- **Idea**: [ideas/005-web-ui/idea.md](../../ideas/005-web-ui/idea.md)
- **Feature**: [ideas/005-web-ui/features/06-graph-visualization.md](../../ideas/005-web-ui/features/06-graph-visualization.md)

### Constraint Alignment

| Constraint (from idea/feature) | Status | Notes |
|-------------------------------|--------|-------|
| InversifyJS DI architecture | ALIGNED | Services resolved via DI container |
| No React/Vue/Svelte build pipeline | ALIGNED | Alpine.js + Tailwind CSS CDN only |
| PenguinUI components | ALIGNED | Tailwind + Alpine.js component library |
| Static HTML served by gateway | ALIGNED | Existing static file handler serves new files |
| Existing bearer token auth | ALIGNED | No auth changes needed |
| Cytoscape.js for graph rendering | ALIGNED | CDN, canvas renderer for large graphs |
| Memory file editing via memory.upsert | DIVERGENT | Clarified: editing uses direct file write (upsert is append-only) |
| Stats refresh on tab switch or 30s polling | ALIGNED | Implemented in onShow() + interval |
| Search debounced 300ms | ALIGNED | Frontend debounce on input |
| Graph handles up to 10K nodes | ALIGNED | Cytoscape canvas renderer + performance warning at 5K+ |

**Divergence justification**: The idea file said "Memory file editing uses `memory.upsert`" but MemoryStore.upsert() is append-only. Clarification in spec confirms editing replaces file content directly. This is the correct approach given the service API.

## Project Structure

### Documentation (this feature)

```text
specs/012-memory-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── tools.md         # API contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (by /specforge.tasks)
```

### Source Code (repository root)

```text
src/plugins/webui/
├── index.ts                     # EXTEND: register 10 new memory routes
├── types.ts                     # EXTEND: add memory Zod schemas and types
└── handlers/
    ├── memory-stats.ts          # NEW: GET /api/memory/stats
    ├── memory-search.ts         # NEW: GET /api/memory/search
    ├── memory-files.ts          # NEW: GET/PUT/DELETE /api/memory/files[/:path]
    ├── memory-notes.ts          # NEW: POST /api/memory/notes
    ├── memory-timeline.ts       # NEW: GET /api/memory/timeline
    └── memory-graph.ts          # NEW: GET /api/memory/graph[/neighbors/:id]

frontend/public/
├── index.html                   # EXTEND: add Memory nav button + page div
└── js/
    └── memory.js                # NEW: Alpine.js memory dashboard component

tests/
├── unit/webui/
│   ├── memory-stats.test.ts     # NEW
│   ├── memory-search.test.ts    # NEW
│   ├── memory-files.test.ts     # NEW
│   ├── memory-notes.test.ts     # NEW
│   ├── memory-timeline.test.ts  # NEW
│   └── memory-graph.test.ts     # NEW
└── integration/webui/
    └── memory-api.test.ts       # NEW
```

**Structure Decision**: Web application pattern — backend handlers in `src/plugins/webui/handlers/`, frontend in `frontend/public/`. Follows existing project structure exactly.

## Reuse Summary

| Category | REUSE | EXTEND | NEW |
|----------|-------|--------|-----|
| Backend handlers | 0 | 0 | 6 handler files |
| Plugin registration | 0 | 1 (index.ts) | 0 |
| Type definitions | 0 | 1 (types.ts) | 0 |
| Frontend HTML | 0 | 1 (index.html) | 0 |
| Frontend JS | 0 | 0 | 1 (memory.js) |
| Services | 2 (MemoryStore, AssociationGraph) | 0 | 0 |
| Tests | 0 | 0 | 7 test files |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete (/specforge.plan command)
- [x] Phase 1: Design complete (/specforge.plan command)
- [ ] Phase 2: Task planning complete (/specforge.plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/specforge.tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (5 clarifications applied)
- [x] Complexity deviations documented (none needed)
