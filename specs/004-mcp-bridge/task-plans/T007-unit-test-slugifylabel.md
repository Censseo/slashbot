# Task Plan: T007

## Task Description
Unit test: `McpBridgeService.slugifyLabel()` — lowercase, replace non-alphanumeric with hyphens, collapse consecutive, trim, max 64 chars, prefix `nodered:`.
Phase: Phase 3 | User Story: US1 | Parallel: Yes | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: TDD
- Conventions: tests in `McpBridgeService.test.ts`
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: NEW_CONFIRMED

## Codebase Impact
- Files to modify: `tests/plugins/nodered/services/McpBridgeService.test.ts` — add `describe('slugifyLabel')` block

## Implementation Steps
1. Add `describe('slugifyLabel')` block (test via `scanAndRegister` observing `registerTool` call's `id` field):
   - Helper: `getRegisteredId(label)` creates eligible flow with given label, calls `scanAndRegister`, returns registered tool ID
2. Test cases:
   - `"My Flow Name"` → `"nodered:my-flow-name"`
   - `"mcp-check-sol-price"` → `"nodered:mcp-check-sol-price"`
   - `"Flow With  Spaces & Symbols!"` → `"nodered:flow-with-spaces-symbols"`
   - `"a".repeat(100)` → slug part ≤ 64 chars + `logger.warn` called
   - `"flow--name"` → `"nodered:flow-name"` (consecutive hyphens collapsed)
   - `"--my-flow--"` → `"nodered:my-flow"` (leading/trailing trimmed)

Gotchas:
- Method is private — test via `scanAndRegister()` observing `registerTool` call args
- 64-char limit applies to slug part only, not the `nodered:` prefix

## Related Tasks
Depends on: T005, T006 (helpers) | Blocks: T013 | Parallel with: T006, T008, T009

## Estimated Complexity
Simple | ~20 min | Risk: Low
