Status: Complete
Files Changed:
  - src/core/kernel/contracts.ts: Added `unregisterTool(id: string): void` to `PluginRegistrationContext` interface with JSDoc (FR-012)
  - src/plugin-sdk/index.d.ts: Added matching `unregisterTool(id: string): void` to `PluginRegistrationContext` with JSDoc (FR-012)
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Both interfaces must stay in sync; plugin-sdk is a copy for external use.
