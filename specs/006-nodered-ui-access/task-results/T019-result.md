Status: Complete
Files Changed:
  - src/plugins/nodered/services/settings.ts: Added bcrypt hash format validation ($2a$/$2b$/$2y$); falls back to unconfigured on malformed hash
  - src/plugins/nodered/services/settings.test.ts: Added 4 tests for malformed hash edge cases
Deviations from Plan: None
Gotchas Discovered: Used recursive call to `generateSettings()` with `editorPasswordHash: undefined` to cleanly disable auth on malformed hash
TODOs Left:
  - Blockers: None
  - Enhancements: Could log a warning when malformed hash is detected (currently silent)
  - Technical debt: None
Lessons Learned: Recursive call pattern is clean for fallback behavior in settings generation
