Status: Complete
Files Changed:
  - src/plugins/nodered/index.ts: Added FlowChangePoller import, declaration, instantiation after McpBridgeService, lifecycle event subscriptions (nodered:ready -> start, nodered:stopped -> stop), cleanup in shutdown hook, and flow:external-change to EventMap augmentation
Deviations from Plan: Added FlowChangeEvent type import and EventMap augmentation in index.ts (plan noted this in T014 but logically belongs with wiring)
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Event subscription pattern from McpBridgeService lifecycle wiring applied cleanly
