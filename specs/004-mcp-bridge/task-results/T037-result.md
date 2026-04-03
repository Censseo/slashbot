Status: Complete
Files Changed:
  - src/plugins/nodered/services/McpBridgeService.ts: Changed buildSchema() fallback from z.object({}) to z.object({ input: z.string().optional() })
  - tests/plugins/nodered/services/McpBridgeService.test.ts: Updated T008 test assertions to verify fallback schema has 'input' field
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left: None
Lessons Learned: None
