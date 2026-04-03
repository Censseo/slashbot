Status: Complete
Files Changed:
  - src/plugins/nodered/services/settings.ts: Added `/[\x00-\x1f\x7f]/g` stripping before escaping in username interpolation
  - src/plugins/nodered/services/settings.test.ts: Added test verifying control chars stripped from username in generated JS
Deviations from Plan: None
Gotchas Discovered: Test must check username value specifically, not entire output (template contains legitimate newlines)
TODOs Left: None
Lessons Learned: Defense-in-depth — even with input validation at config layer (T023), sanitize at output layer too
