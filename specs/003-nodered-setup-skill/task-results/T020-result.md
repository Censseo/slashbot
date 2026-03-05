Status: Complete
Files Changed:
  - src/plugins/skills/bundled/nodered-setup/SKILL.md: Replaced placeholder with full skill — frontmatter (name, description, slashbot metadata, requires: [node], userInvocable, disableModelInvocation) + 7 instruction sections (Detect, Install, Start, Stop, Restart, Verify, Troubleshoot)
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Skill Install section detects npm/bun at runtime (not TypeScript), satisfying FR-012. Restart section includes exponential backoff guidance for crash recovery.
