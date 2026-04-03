Status: Complete
Files Changed:
  - src/plugins/nodered/services/settings.ts: Added escaping for backslashes and single quotes in config.userDir before interpolation into settings.js string
  - src/plugins/nodered/services/settings.test.ts: Added test 'escapes single quotes in userDir (T030)' verifying escaped output and valid JavaScript syntax
Deviations from Plan: Also escape backslashes (not just single quotes) to prevent double-escaping issues
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Any user-controlled string interpolated into generated code must be escaped to prevent injection
