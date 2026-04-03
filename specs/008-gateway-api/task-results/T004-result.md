Status: Complete
Files Changed:
  - src/core/gateway/server.ts: Added StaticFileHandler type, optional services to options, static file fallback in handleHttp() before auth check for non-API paths
  - src/core/kernel/kernel.ts: Pass services registry to gateway constructor
Deviations from Plan: Used ServiceRegistry lookup ('webui.static') instead of a dedicated options field — cleaner integration
Gotchas Discovered: None
TODOs Left: None
Lessons Learned: Static file handler is auth-exempt by design, checks non-API paths only
