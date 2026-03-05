Status: Complete
Files Changed:
  - src/plugins/nodered/services/FlowManager.ts: Replaced `any` with `INodeRedManagerForFlows` interface (`getState(): NodeRedState`, `getConfig(): NodeRedConfig`); added NodeRedConfig import
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left: None
Lessons Learned: Minimal typed interfaces avoid circular imports while maintaining type safety
