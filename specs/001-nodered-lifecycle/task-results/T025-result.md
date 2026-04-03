Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Added MAX_CONSECUTIVE_HEALTH_FAILURES constant (3), consecutiveHealthFailures private field, implemented performHealthCheck() with failure counting and process kill after threshold, added handleHealthCheckFailure() helper method, reset counter on successful readiness poll
  - src/plugins/nodered/services/NodeRedManager.test.ts: Added 'Health Check Failure Recovery (T025)' describe block with tests for kill-after-3-failures and counter-reset-on-success
Deviations from Plan: None
Gotchas Discovered: Health check kills the unresponsive process (SIGKILL) which triggers handleProcessExit -> auto-restart flow, reusing existing crash recovery mechanism rather than duplicating restart logic
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Reusing the crash recovery flow (kill -> handleProcessExit -> auto-restart) is cleaner than implementing separate restart logic in health check failure handler
