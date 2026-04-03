Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.test.ts: Added 'Graceful Shutdown (US4)' describe block with 14 tests covering: stop() SIGTERM signal 15, stop() waits for clean exit within shutdownTimeout, stop() escalates to SIGKILL after timeout, stop() sets intentionalStop flag, stop() clears all timers, stop() emits nodered:stopped, stop() idempotent (stopped/disabled), destroy() stops running process + clears timers, destroy() handles stopped state, destroy() handles failed state, destroy() nullifies process references, destroy() clears log buffer, plugin destroy() delegation
Deviations from Plan: None
Gotchas Discovered: The 'already-stopped state' test initially timed out because the mock kill implementation was overridden to do nothing (not resolving the exited promise), which caused stop() to hang waiting for Promise.race with fake timers. Fixed by using the default setupRunningManager kill mock that resolves exited.
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: When testing shutdown behavior with fake timers and controllable process exit promises, ensure the kill mock behavior is consistent with what the test expects. If stop() races proc.exited vs timeout, both must be resolvable under fake timers.
