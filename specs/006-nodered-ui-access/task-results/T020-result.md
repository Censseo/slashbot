Status: Complete
Files Changed:
  - src/plugins/nodered/services/McpBridgeService.ts: Added logger.warn() in handleFlowDeleted with toolId, flowId, and label for user notification
Deviations from Plan: None — existing unregisterTool + prompt:redraw already handled the core functionality; added structured warning log per error scenarios table
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: The existing event-driven architecture (flow:external-change → handleFlowDeleted → unregisterTool) was already robust; only logging notification was missing
