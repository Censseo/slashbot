Status: Complete
Files Changed:
  - tests/plugins/nodered/services/McpBridgeService.test.ts: Added US4 describe block with 4 tests for prompt:redraw emission
Deviations from Plan: Added a 4th test — "does NOT emit prompt:redraw when no tools registered" — for completeness
Gotchas Discovered: The functional event bus mock receives the event it publishes (nodered:ready), so mockClear is needed before asserting prompt:redraw
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Use feBus.publish.mockClear() before triggering events to isolate prompt:redraw assertions from upstream events
