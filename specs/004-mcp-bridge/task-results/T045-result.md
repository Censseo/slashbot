Status: Complete
Files Changed:
  - src/plugins/nodered/index.ts: Moved mcpBridgeService.init() from fire-and-forget in setup() to awaited call inside startup hook, with try/catch for graceful degradation
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left: None
Lessons Learned: None
