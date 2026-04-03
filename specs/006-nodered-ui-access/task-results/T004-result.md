Status: Complete
Files Changed:
  - src/plugins/nodered/services/settings.ts: Extended generateSettings() with conditional adminAuth block and httpAdminRoot toggle
Deviations from Plan: None
Gotchas Discovered: Existing httpAdminRoot test assumed '/' always — updated to expect false without credentials
TODOs Left: None
Lessons Learned: None
