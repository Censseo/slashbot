Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Removed this.runtimeState.restartCount++ from restart() method
  - src/plugins/nodered/services/NodeRedManager.test.ts: Changed test from 'increments restart count' to 'does not increment restart count on manual restart', updated assertion to expect count stays the same
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: restartCount is specifically for crash recovery tracking, not general restart counting
