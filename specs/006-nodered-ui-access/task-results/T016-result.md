Status: Complete
Files Changed:
  - src/plugins/nodered/services/McpBridgeService.ts: Added FlowChange type import, unsubscribeExternalChange field, flow:external-change subscription in init() routing deleted changes to handleFlowDeleted and created/modified to scanAndRegisterFlow, cleanup in dispose(), and new scanAndRegisterFlow private helper
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Envelope unwrapping pattern (e?.payload ?? e) consistent with existing event handlers
