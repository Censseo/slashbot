Status: Complete
Files Changed:
  - tests/unit/plugins/nodered/NodeRedManager.test.ts: Added T019 describe block with 3 tests (transition succeeds, stays in setup-needed when not responding, emits nodered:ready with correct port)
Deviations from Plan: None
Gotchas Discovered: vi.advanceTimersByTimeAsync required (not advanceTimersByTime) for async interval callbacks in Bun/Vitest
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Fake timers + async interval tests work cleanly with advanceTimersByTimeAsync
