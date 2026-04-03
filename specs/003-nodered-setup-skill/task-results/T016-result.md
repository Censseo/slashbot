Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Added pidFilePath() helper, removePidFile() helper, PID file write in start(), PID file removal in stop() and handleProcessExit() crash path, PID file read during stale process adoption in init() (wrapped in try-catch)
Deviations from Plan: PID read in init() wrapped in try-catch for robustness (existing test lacked readFileSync in mock)
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: None
