Status: Complete
Files Changed:
  - src/plugins/nodered/services/McpBridgeService.ts: Added events.publish('prompt:redraw', {}) in registerFlowTool() and handleFlowDeleted()
Deviations from Plan: teardownAll() and scanAndRegister() do NOT need separate emit calls — registerFlowTool() emits once per registered tool (covers scanAndRegister), and handleFlowDeleted() emits after each unregistration (covers teardownAll). Emitting in teardownAll or scanAndRegister would cause redundant events.
Gotchas Discovered: None — the per-operation emit strategy is cleaner and avoids batching complexity
TODOs Left:
  - Blockers: None
  - Enhancements: Could batch emit a single prompt:redraw after teardownAll+scanAndRegister cycle instead of N individual events, but current behaviour is acceptable
  - Technical debt: None
Lessons Learned: Per-operation emit is simpler and aligns with the existing registerFlowTool/handleFlowDeleted structure
