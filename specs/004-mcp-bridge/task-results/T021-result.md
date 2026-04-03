Status: Complete
Files Changed:
  - src/plugins/nodered/services/McpBridgeService.ts: Implemented invokeFlow(toolDef, args, timeoutMs) — builds URL, sends fetch with AbortController timeout, passes args as query (GET) or JSON body (POST)
Deviations from Plan: None — follows FR-006 and FR-007 exactly
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: Could add retry logic for transient failures
  - Technical debt: None
Lessons Learned: AbortController + setTimeout pattern works cleanly with Bun's fetch implementation
