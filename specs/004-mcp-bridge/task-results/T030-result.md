Status: Complete
Files Changed:
  - src/plugins/nodered/services/McpBridgeService.ts: Subscribed to flow:updated, flow:deleted, flow:created events in init()
Deviations from Plan: flow:created reuses handleFlowUpdated (same eligibility logic, no separate handler needed)
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: flow:created and flow:updated can share handleFlowUpdated handler since both need eligibility check + register-if-eligible
