Status: Complete
Files Changed:
  - tests/plugins/nodered/services/McpBridgeService.test.ts: Added unit tests for isEligible() (T006), slugifyLabel() (T007), buildSchema() (T008), scanAndRegister() (T009)
Deviations from Plan: Mock expanded to cover full PluginRegistrationContext interface; EventBus uses publish/subscribe not on/emit
Gotchas Discovered: EventBus API is publish/subscribe/subscribeAll — not on/emit as scaffold assumed
TODOs Left:
  - Blockers: McpBridgeService implementation needed (T011) to make tests green
  - Enhancements: Zod v4 schema introspection in T008 may need adjustment
  - Technical debt: None
Lessons Learned: Always verify EventBus API before mocking; test private methods indirectly via public entry points
