Status: Complete
Files Changed:
  - src/plugins/nodered/index.ts: Added specific messaging for partial credentials in `/nodered ui` (username-only vs password-only)
  - src/plugins/nodered/index.test.ts: Added 2 tests for partial credential edge cases
Deviations from Plan: None
Gotchas Discovered: None — `generateSettings()` already treated partial credentials as unconfigured via `&&` check
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: The existing `&&` guard in generateSettings made the settings side a no-op; only UI messaging needed updating
