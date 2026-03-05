Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Defined NodeRedEvent discriminated union type for all 4 lifecycle events (nodered:ready, nodered:stopped, nodered:error, nodered:failed). Added emitNodeRedEvent() private helper that casts to the EventBus plugin event overload signature. Replaced all 7 as-any event emissions with emitNodeRedEvent() calls.
Deviations from Plan: Used a helper method + local union type rather than modifying EventBus types, to keep changes local to the plugin
Gotchas Discovered: The EventBus has two overloads — typed core events and untyped plugin events. The as-any was needed because TypeScript couldn't disambiguate the overload. The helper method provides a clean boundary.
TODOs Left:
  - Blockers: None
  - Enhancements: Consider adding nodered event types to the core SlashbotEvent union if they become widely subscribed
  - Technical debt: None
Lessons Learned: Discriminated union types + helper methods eliminate as-any while keeping type safety local to the module
