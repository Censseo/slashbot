Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Added eager generateSettings() call in init() after userDir creation; removed redundant directory creation from start(); start() retains generateSettings() call to pick up config changes
Deviations from Plan: start() retains its own generateSettings() call (intentional - picks up config changes); only redundant mkdirSync removed
Gotchas Discovered: saveConfig() can change this.config between init() and start(), so re-generating on each start() is still correct
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: When moving initialization logic, consider whether the same logic needs to run at multiple points in the lifecycle
