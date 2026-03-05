Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Added `setup-needed` to `stopped` transitions and added `'setup-needed': ['running']` entry in VALID_TRANSITIONS
Deviations from Plan: `unknown → setup-needed` not added because `unknown` state does not exist in the codebase; documented in JSDoc only
Gotchas Discovered: No `unknown` state exists in type system; spec reference was aspirational
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Always check if referenced states exist before adding transitions
