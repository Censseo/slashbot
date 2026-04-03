Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Changed saveConfig() parameter type from NodeRedConfig to Partial<NodeRedConfig> (consistent with HeartbeatService pattern), added fs.chmodSync(configPath, 0o600) after Bun.write to restrict config file permissions.
Deviations from Plan: Config loading (loadConfig) was already implemented inline in init() from T009. No separate public loadConfig() method was added since init() already handles all cases (missing file, partial config merge, malformed JSON fallback). The existing implementation already satisfied all T020 requirements except file permissions.
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: The incremental approach (US1 through US5) meant most config management was already working from init(). US5 only needed file permissions and the Partial type signature update.
