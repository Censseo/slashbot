Status: Complete
Files Changed:
  - tests/unit/plugins/nodered/NodeRedManager.test.ts: Created with 11 tests covering PID file write on start, removal on stop, removal on crash, and read on stale process adoption
Deviations from Plan: None
Gotchas Discovered:
  - vi.resetAllMocks() in beforeEach clears fs.promises.open's mockResolvedValue, causing attachLogHandlers to fail (undefined.then). Fixed by re-setting fs.promises.open mock after resetAllMocks in beforeEach.
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Always re-setup fs.promises.* mocks after vi.resetAllMocks() if the module under test calls them during start/spawn flows.
