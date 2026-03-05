Status: Complete
Files Changed:
  - src/plugins/nodered/index.ts: Created NodeRedPlugin implementing Plugin interface with DI registration, dynamic sidebar label via Object.defineProperty, prompt contribution (priority 160), auto-start on init
Deviations from Plan: None
Gotchas Discovered:
  - Object.defineProperty getter requires configurable:true and enumerable:true
  - Auto-start guard must check state !== 'unavailable' AND state !== 'disabled'
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Object.defineProperty getter works well for dynamic sidebar labels.
