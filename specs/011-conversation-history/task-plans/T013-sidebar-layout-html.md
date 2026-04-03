# Task Plan: T013

## Task Description
Add sidebar layout to `frontend/public/index.html`.
Phase: 3 | User Story: US1 | Parallel: Yes | Reuse Type: EXTEND

## Reuse Decision
Original: EXTEND | Validation: VALID. Chat view restructured from centered column to flex row.

## Codebase Impact
- Files to modify: `frontend/public/index.html`
- Dependencies: conversations.js (T012)

## Implementation Steps
1. Restructure chat view wrapper to flex row: sidebar + chat panel side by side.
2. Add `<aside x-data="conversations()">` with conversation list, loading/empty states.
3. Move `x-data="chat()"` to inner chat panel div.
4. Add `<script src="js/conversations.js">` before chat.js.
5. Sidebar: w-64, border-r, scrollable list with item template.

Gotchas:
- Removing max-w-3xl from outer wrapper — apply max-width to message area instead.
- Verify x-data scoping doesn't break existing event listeners.

## Related Tasks
Depends on: T012 | Blocks: T014, T015

## Estimated Complexity
Moderate | Risk: Medium
