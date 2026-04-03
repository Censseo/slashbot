Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Replaced ensureNodeRedInstalled() call with fs.existsSync check; transitions to setup-needed and emits nodered:setup-needed event.
  - src/plugins/nodered/index.ts: Added 'setup-needed' to startup hook guard condition.
Deviations from Plan: None.
Gotchas Discovered: None — plan was accurate about both change sites.
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Two-site change (manager + startup hook guard) required; easy to miss the index.ts guard.
