Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Changed event type from nodered:error to nodered:failed when Node.js is not found (fatal condition per spec error table)
  - src/plugins/nodered/services/NodeRedManager.test.ts: Updated test name and assertion to expect nodered:failed instead of nodered:error
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: nodered:error is for recoverable errors (crash with retries remaining), nodered:failed is for terminal states (no Node.js, retries exhausted)
