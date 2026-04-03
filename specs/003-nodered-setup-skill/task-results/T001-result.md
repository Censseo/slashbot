Status: Complete
Files Changed:
  - src/plugins/skills/index.ts: Changed resolveBundledSkillsDir() to return join(thisDir, 'bundled') instead of join(thisDir, '..', '..', '..', 'skills')
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Simple one-line path change. `thisDir` is `src/plugins/skills/` at runtime, so `join(thisDir, 'bundled')` resolves to `src/plugins/skills/bundled/` as required.
