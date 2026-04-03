Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Added getCrashRestartCount() public method, onAllRetriesExhausted optional callback property, callback invocation in handleProcessExit when all retries exhausted
  - src/plugins/nodered/index.ts: Wires onAllRetriesExhausted callback in startup hook to schedule automation job for skill-based restart
Deviations from Plan: Used callback pattern instead of event subscription (cleaner, avoids EventBus subscription lifetime issues)
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Callback pattern on manager is simpler than event subscription for lifecycle hooks that need access to DI services.
