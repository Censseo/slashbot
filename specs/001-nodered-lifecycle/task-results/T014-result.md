Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Enhanced handleProcessExit() with crash detection and auto-restart logic: increment restartCount on crash, auto-restart via setTimeout with exponential backoff (1s * 2^(n-1)), transition to failed state when maxRestartAttempts exceeded, emit nodered:failed event on exhaustion
Deviations from Plan: None - implementation matches spec exactly
Gotchas Discovered:
  - handleProcessExit must set state to 'stopped' before scheduling restart via setTimeout, so that start() can transition stopped->starting (state machine requires valid transitions)
  - setTimeout callback must be async to properly await this.start()
  - pid and process must be nullified before attempting restart to prevent stop() from trying to kill a dead process
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Crash recovery integrates cleanly into the existing state machine. The key insight is that handleProcessExit transitions to 'stopped' (not directly to 'starting') and then schedules a delayed start(), which follows the normal stopped->starting->running path. This avoids any special state transitions for crash recovery.
