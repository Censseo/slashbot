Status: Complete
Files Changed:
  - src/plugins/nodered/types.ts: Created `NodeRedEvent` union type including all existing event shapes plus `FlowChangeEvent`
Deviations from Plan: Created the full `NodeRedEvent` union type (didn't exist before) rather than just extending it. Includes `nodered:ready`, `nodered:stopped`, `nodered:setup-needed`, `nodered:error`, `nodered:crash`, and `flow:external-change`.
Gotchas Discovered: No formal `NodeRedEvent` union type existed — events were emitted as `{ type: string; ... }`. Created the typed union for future type safety.
TODOs Left:
  - Enhancements: Refactor `NodeRedManager.emitNodeRedEvent()` to use the new `NodeRedEvent` type instead of `{ type: string; ... }`
Lessons Learned: None
