# Task Plan: T010

## Task Description
Create NODERED_PROMPT constant in `src/plugins/nodered/prompt.ts` (LLM context: Node-RED managed process, available commands, do not use bash for lifecycle)

Phase: User Story 1 - Automatic Node-RED Startup | User Story: US1 | Parallel: Yes | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Prompt Contribution Pattern (constant string array joined with `\n`, exported for plugin registration)
- Tech decisions followed: Follow BashPlugin prompt structure (array of strings joined), priority 160 places it in Feature Tools range (150-200)
- Conventions: file at `src/plugins/nodered/prompt.ts`, exported as `NODERED_PROMPT` constant (SCREAMING_SNAKE_CASE)
- Anti-patterns avoided: No feature logic in prompt (pure documentation), no direct plugin imports
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID
Justification: Feature-specific prompt contribution following established pattern from BashPlugin (`src/plugins/bash/prompt.ts` lines 5-20).

## Codebase Impact
- Files to create (NEW only): `src/plugins/nodered/prompt.ts` -- LLM prompt contribution
- Files to modify: None
- Dependencies: None (pure constant export, imported by T011 plugin index)

## Implementation Steps
1. Create `src/plugins/nodered/prompt.ts`
2. Export `NODERED_PROMPT` constant as string array joined with `\n`, following BashPlugin pattern
3. Include sections:
   - Header: "## nodered -- Managed Node-RED Process"
   - Description: Node-RED runs as a managed child process of slashbot
   - Available commands: `/nodered start|stop|restart|status`, alias `/nr`
   - Important notes:
     - DO NOT use `bash` to start/stop/manage Node-RED (use /nodered commands instead)
     - DO NOT modify Node-RED settings.js directly (auto-generated)
     - Use `/nodered status` to check health and view recent logs
     - Node-RED Editor accessible at `http://localhost:{port}/` (default 1880)

Gotchas:
- Use exact format from BashPlugin (array of strings joined with \n)
- Priority 160 will be set in plugin index.ts (T011), not in this file
- Keep prompt concise -- LLM context budget is limited
- Emphasize DO NOT use bash for lifecycle (critical anti-pattern guard)

## Related Tasks
Depends on: None (standalone) | Blocks: T011 (plugin imports this constant) | Parallel with: T009

## Estimated Complexity
Simple | 5min | Risk: Low
