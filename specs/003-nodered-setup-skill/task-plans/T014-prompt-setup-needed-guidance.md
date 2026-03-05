# Task Plan: T014

## Task Description
Update src/plugins/nodered/prompt.ts to include skill invocation guidance for setup-needed state.
Phase: Phase 3 | User Story: US1 | Parallel: Yes | Reuse Type: EXTEND

## Architecture Alignment
- Patterns applied: Prompt string array joined with '\n' — same pattern as existing NODERED_PROMPT
- Tech decisions followed: TypeScript strict (pure string constants)
- Conventions: File at src/plugins/nodered/prompt.ts; export name unchanged
- Anti-patterns avoided: N/A
- Status: Aligned

## Reuse Decision
Original: EXTEND | Validation: VALID
Base: src/plugins/nodered/prompt.ts:8-54. Extension: insert new section block into array.

## Codebase Impact
- Files to create: None
- Files to modify:
  - `src/plugins/nodered/prompt.ts` — insert setup-needed guidance section into NODERED_PROMPT array
- Dependencies: None

## Implementation Steps

1. Insert after the "Node-RED Editor is accessible" line and before "## Flow Management Actions":
   ```typescript
   '',
   '## Node-RED Setup (when not installed)',
   'If Node-RED state is `setup-needed`, Node-RED is not yet installed.',
   'DO NOT attempt to install Node-RED manually via bash or npm commands.',
   'Instead, run the setup skill:',
   '- Use the skills tool: invoke skill `nodered-setup`',
   '- Or run the slash command: `/skill run nodered-setup`',
   'The skill will install Node-RED and configure it automatically.',
   'After the skill completes, Node-RED will transition to running state.',
   ```

Gotchas:
- This is a static prompt section (always included), not conditional on state — the dynamic context provider (T012) handles state-conditional instructions
- Keep skill name `nodered-setup` consistent with actual registration
- Do not rename/restructure NODERED_PROMPT export — imported by name in index.ts:17

## Related Tasks
Depends on: None | Blocks: None | Parallel with: T010, T011, T012, T013

## Estimated Complexity
Simple | 10 min | Risk: Low
