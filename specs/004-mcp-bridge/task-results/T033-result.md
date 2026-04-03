Status: Complete
Files Changed:
  - src/plugins/nodered/index.ts: Changed `void mcpBridgeService.init()` to `.catch()` with `logger.warn()` — logs warning on init failure without crashing the application
Deviations from Plan: None
Gotchas Discovered: The existing `void` pattern silently swallowed errors. Replaced with `.catch()` using the resolved `logger` reference already available in scope.
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Using `void` on async calls silences errors. Always attach `.catch()` for user-facing services.
