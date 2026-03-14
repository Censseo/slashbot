Status: Complete
Files Changed:
  - src/plugins/webui/handlers/status-indicators.ts: NEW — handler that reads StatusIndicatorRegistry, maps to {id, label, kind, status} entries
  - src/plugins/webui/index.ts: EXTEND — import handler, register GET /api/status-indicators route, add heapUsed/heapTotal to systemInfo
  - src/plugins/webui/types.ts: EXTEND — added heapUsed, heapTotal to SystemInfo interface
  - tests/plugins/webui/handlers/status-indicators.test.ts: NEW — 3 tests (missing service, indicator list, empty registry)
Deviations from Plan: None
Gotchas Discovered:
  - StatusIndicatorRegistry is exposed as service 'kernel.statusIndicators.registry' (not directly on context)
  - getStatus() returns 'disconnected' as default (not 'off')
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Follow exact same pattern as createPluginsHandler for consistency
