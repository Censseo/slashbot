Status: Complete
Files Changed:
  - src/core/kernel/kernel.ts: Added `unregisterTool` to `createPluginRegistrationContext()` — delegates to `this.tools.delete(id)`
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: No ownership assertion needed for delete (can only delete what was registered, tool IDs are unique).
