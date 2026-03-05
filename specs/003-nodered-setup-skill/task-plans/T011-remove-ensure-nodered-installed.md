# Task Plan: T011

## Task Description
Remove the private ensureNodeRedInstalled() method from NodeRedManager entirely.
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: REFACTOR

## Architecture Alignment
- Patterns applied: Dead code removal — method had single call site removed in T010
- Tech decisions followed: TypeScript strict — removing unused private method
- Conventions: Changes in NodeRedManager.ts only
- Anti-patterns avoided: N/A
- Status: Aligned

## Reuse Decision
Original: REFACTOR | Validation: VALID
Target: NodeRedManager.ts:208-260 — delete entire method

## Codebase Impact
- Files to create: None
- Files to modify:
  - `src/plugins/nodered/services/NodeRedManager.ts:204-260` — delete JSDoc + ensureNodeRedInstalled() method
- Dependencies: `os` import still needed by resolveUserDir() — do NOT remove

## Implementation Steps
1. Confirm T010 is complete and the call at (old) line 174 is gone
2. Delete lines 204-260: JSDoc block + entire `private async ensureNodeRedInstalled()` method
3. Run `bun tsc --noEmit` to confirm no remaining references

Gotchas:
- `os` import still used by resolveUserDir() — keep it
- Line numbers shift ~57 lines after deletion; subsequent tasks reference by method name

## Related Tasks
Depends on: T010 | Blocks: None | Parallel with: T012, T013, T014

## Estimated Complexity
Simple | 10 min | Risk: Low
