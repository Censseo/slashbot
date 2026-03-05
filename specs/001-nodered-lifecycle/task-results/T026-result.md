Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Updated both nodered:ready emission sites (stale process adoption in init() and readiness poll success) to include port: this.config.port
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Event payloads should match data-model.md exactly from initial implementation
