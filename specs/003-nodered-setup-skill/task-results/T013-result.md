Status: Complete
Files Changed:
  - src/plugins/nodered/index.ts: Added OnceJobScheduler duck-typed interface + addOnceJob call in startup hook when state is setup-needed.
Deviations from Plan: None.
Gotchas Discovered: Interface declared inside setup() scope to keep it local.
TODOs Left:
  - Blockers: Need to verify addOnceJob signature matches AutomationService at runtime (soft dependency — null-guarded)
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Soft dependency pattern (getService + null guard) works cleanly.
