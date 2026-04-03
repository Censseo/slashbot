# Task Plan: T013

## Task Description
Add one-shot automation job via AutomationService.addOnceJob() with null guard for soft dependency (FR-003).
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: REUSE

## Architecture Alignment
- Patterns applied: Soft dependency via context.getService() with null guard. Duck-typed interface to avoid cross-plugin import.
- Tech decisions followed: TypeScript strict — duck-typed interface. Bun 1.0+.
- Conventions: Change inside startup hook in index.ts. No new files.
- Anti-patterns avoided: No direct cross-plugin import
- Status: Aligned

## Reuse Decision
Original: REUSE | Validation: VALID
Existing: AutomationService at service ID 'automation.service'. Wiring: getService() → null check → addOnceJob().

## Codebase Impact
- Files to create: None
- Files to modify:
  - `src/plugins/nodered/index.ts` — add OnceJobScheduler duck-type interface + addOnceJob call in startup hook when state is setup-needed
- Dependencies: No new imports; context.getService already available via closure

## Implementation Steps

1. Define local duck-typed interface:
   ```typescript
   interface OnceJobScheduler {
     addOnceJob(name: string, runAtMs: number, prompt: string): Promise<unknown>;
   }
   ```

2. In startup hook handler, after manager.init() and state check, add:
   ```typescript
   if (state === 'setup-needed') {
     const automation = context.getService<OnceJobScheduler>('automation.service');
     if (automation) {
       await automation.addOnceJob(
         'nodered-setup-prompt',
         Date.now(),
         'Node-RED is not installed. Please run the `nodered-setup` skill now to install it.',
       );
     }
   }
   ```

3. This goes AFTER the start() guard (which now excludes setup-needed per T010 step 4).

Gotchas:
- runAtMs is absolute epoch timestamp — Date.now() means "run immediately at next tick"
- Automation loads at priority 50, nodered at 60 — automation available when nodered hook fires
- If automation is null (plugin not installed), block silently skipped — correct soft-dependency behavior
- Job name should be idempotent-safe

## Related Tasks
Depends on: T010 | Blocks: None | Parallel with: T011, T012, T014

## Estimated Complexity
Moderate | 30 min | Risk: Medium (soft dependency pattern; confirm addOnceJob signature)
