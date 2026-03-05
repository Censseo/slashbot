Status: Complete
Files Changed:
  - src/plugins/nodered/commands.ts: Added 'config' subcommand with display (show current config as formatted table), update (port, healthCheckInterval, shutdownTimeout, maxRestartAttempts via /nodered config <key> <value>), validation (unknown keys rejected, non-numeric values rejected, missing value shows usage), confirmation message with restart notice. Updated usage string and subcommands array.
  - src/plugins/nodered/commands.test.ts: Added saveConfig to mock manager, added 'config' to subcommands metadata test, added 11 new tests covering config display, config updates for all 4 supported keys, confirmation/restart messages, unknown key rejection, invalid value rejection, missing value error.
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Following the contract (nodered-commands.ts) and HeartbeatPlugin config command pattern made the implementation straightforward. The UPDATABLE_CONFIG_KEYS constant prevents invalid key access.
