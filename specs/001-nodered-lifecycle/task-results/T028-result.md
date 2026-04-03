Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Refactored handleProcessExit() and stop() to use setState() for all state transitions. Added starting->stopped and failed->stopped to VALID_TRANSITIONS. Added guard in stop() to skip setState if already stopped (from handleProcessExit). Removed duplicate prompt:redraw emissions since setState() already emits them.
  - src/plugins/nodered/services/NodeRedManager.test.ts: Updated restart() beforeEach to use controllable process promise instead of Promise.resolve(0)
Deviations from Plan: Added failed->stopped transition to support stop() when in failed state with lingering process
Gotchas Discovered: Process exit handlers can fire before stop() completes (race condition). Added guard `if (state !== 'stopped')` in stop() to handle case where handleProcessExit already transitioned to stopped. Some tests used Promise.resolve(0) for process.exited which caused immediate exit and state machine conflicts — fixed to use controllable promises.
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: All state mutations must go through setState() to maintain validation invariants. Tests with immediately-resolving process exit promises cause subtle timing issues with state machine transitions.
