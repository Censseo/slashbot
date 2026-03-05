Status: Complete
Files Changed:
  - src/plugins/nodered/types.ts: Added `'setup-needed'` to `NodeRedState` union type with JSDoc transitions documentation
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: STATE_LABELS is typed as Record<NodeRedState, string> providing compile-time exhaustiveness checking
