Status: Complete
Files Changed:
  - src/core/kernel/registries.ts: Added `delete(id: string): void` method to `Registry<T>` with JSDoc (FR-012)
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Straightforward Map.delete() delegation; no-op on missing keys matches expected behaviour.
