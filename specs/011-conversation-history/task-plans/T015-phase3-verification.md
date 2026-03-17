# Task Plan: T015

## Task Description
Verify T007 API tests pass; manually test end-to-end.
Phase: 3 | User Story: US1 | Parallel: No | Reuse Type: N/A

## Implementation Steps
1. Run `bun test tests/webui/conversations-api.test.ts` — fix any failures.
2. Run full test suite for regressions.
3. Manual testing: new conversation → sidebar appears → refresh persists → click loads history → send continues.

## Related Tasks
Depends on: T007-T014 (all)

## Estimated Complexity
Simple | Risk: Low
