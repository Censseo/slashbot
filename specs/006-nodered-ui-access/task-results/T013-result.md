Status: Complete
Files Changed:
  - src/plugins/nodered/services/FlowChangePoller.test.ts: Created full test suite (9 tests) covering baseline detection, hash change events, same-hash no-op, bot CRUD hash update, start/stop lifecycle, double-start guard, API failure retry, FlowChange[] diffing, and getLastKnownHash seeding
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: vi.advanceTimersByTimeAsync works well with async poll intervals
