# Task Plan: T012

## Task Description
Enrich nodered.context provider to return skill invocation instruction when state is setup-needed.
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: EXTEND

## Architecture Alignment
- Patterns applied: Dynamic context provider pattern at index.ts:116-124. Extension adds state-specific branch.
- Tech decisions followed: TypeScript strict; return type is string
- Conventions: Change inside existing provide() function body
- Anti-patterns avoided: No cross-plugin imports; no state mutation
- Status: Aligned

## Reuse Decision
Original: EXTEND | Validation: VALID
Base: src/plugins/nodered/index.ts:116-124. Extension point: provide() arrow function. New: setup-needed branch.

## Codebase Impact
- Files to create: None
- Files to modify:
  - `src/plugins/nodered/index.ts:120-123` — extend provide() with setup-needed branch
- Dependencies: No new imports; manager.getState() already called

## Implementation Steps
1. Replace current provide() body (lines 120-123):

   From:
   ```typescript
   provide: () => {
     const state = manager.getState();
     return state !== 'disabled' ? `Node-RED is currently ${state}.` : '';
   },
   ```

   To:
   ```typescript
   provide: () => {
     const state = manager.getState();
     if (state === 'disabled') return '';
     if (state === 'setup-needed') {
       return 'Node-RED is not installed. To install it, run the setup skill: invoke the `nodered-setup` skill using the skills tool or `/skill run nodered-setup`.';
     }
     return `Node-RED is currently ${state}.`;
   },
   ```

Gotchas:
- Instruction text must be clear enough for LLM to act on without additional context
- Keep disabled short-circuit returning '' for consistency
- Skill name `nodered-setup` must match the actual registered skill name

## Related Tasks
Depends on: T010 | Blocks: None | Parallel with: T011, T013, T014

## Estimated Complexity
Simple | 15 min | Risk: Low
