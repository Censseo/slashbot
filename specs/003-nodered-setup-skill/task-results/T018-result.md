Status: Complete
Files Changed:
  - src/plugins/nodered/types.ts: Added `setupMonitorTimer` field to NodeRedRuntimeState
  - src/plugins/nodered/services/NodeRedManager.ts: Added startSetupMonitor(), clearSetupMonitorTimer(); called from init() after setup-needed transition; cleared in destroy()
Deviations from Plan: None
Gotchas Discovered: VALID_TRANSITIONS['setup-needed'] already had ['running'] - direct transition is correct
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Setup monitor is structurally identical to health check timer but fires in setup-needed instead of running state
