Status: Complete
Files Changed:
  - src/runner/registry.ts: Implemented PluginRegistry class (~17 lines) with Map-based storage, register, registerDefault, getPlugin (exact match first, default fallback via ??)
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Nullish coalescing (??) provides clean exact-match-then-default logic in one line.
