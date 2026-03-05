Status: Complete
Files Changed:
  - tests/plugins/nodered/services/McpBridgeService.test.ts: Added makeFunctionalEventBus() helper and integration test block for nodered:ready event (6 tests)
Deviations from Plan: Used vi.waitFor() exclusively instead of setTimeout(r,0) for async assertions
Gotchas Discovered: makeFunctionalEventBus() needed subscribeAll mock to satisfy interface shape
TODOs Left:
  - Blockers: McpBridgeService must accept (flowManager, eventBus, ctx) positionally; init() must subscribe to nodered:ready
  - Enhancements: None
  - Technical debt: None
Lessons Learned: vi.waitFor() is more robust than setTimeout for async test assertions
