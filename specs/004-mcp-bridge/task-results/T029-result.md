Status: Complete
Files Changed:
  - src/plugins/nodered/services/McpBridgeService.ts: Implemented teardownAll(); updated nodered:ready handler to call teardownAll() before scanAndRegister()
Deviations from Plan: None
Gotchas Discovered: Must use registeredTools.clear() after iterating to avoid ConcurrentModificationException-equivalent
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Iterate values() then clear() is cleaner than deleting during iteration
