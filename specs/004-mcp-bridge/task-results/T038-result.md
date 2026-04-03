Status: Complete
Files Changed:
  - src/plugins/nodered/flow-types.ts: Changed FlowInfo.httpEndpoints from string[] to { path: string; method: string }[]
  - src/plugins/nodered/services/FlowManager.ts: Updated extractHttpEndpoints() to return objects with path and method
  - src/plugins/nodered/services/McpBridgeService.ts: Updated registerFlowTool() and handleFlowUpdated() to read method from endpoint object
  - src/plugins/nodered/index.ts: Updated display code for httpEndpoints
  - src/plugins/nodered/services/FlowManager.test.ts: Updated 5 assertions for new httpEndpoints shape
  - tests/plugins/nodered/services/McpBridgeService.test.ts: Updated all test flows to use new httpEndpoints shape
Deviations from Plan: None — FlowManager's extractHttpEndpoints reads `n.method` from HTTP-in nodes (default 'get')
Gotchas Discovered: The change touched many test files due to the type change propagation
TODOs Left: None
Lessons Learned: Breaking type changes require systematic update across all consumers and test files
