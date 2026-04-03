Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Replaced fs.appendFileSync with async approach: open file handle via fs.promises.open() in attachLogHandlers(), use handle.appendFile() for writes, fallback to fs.promises.appendFile() if handle not ready. Close handle in destroy(). Added logFileHandle private field.
  - src/plugins/nodered/services/NodeRedManager.test.ts: Updated fs mock to include promises.open and promises.appendFile
  - src/plugins/nodered/index.test.ts: Updated fs mock to include promises.open and promises.appendFile
Deviations from Plan: Used fs.promises.open with file handle instead of Bun.write (Bun.write doesn't support append mode). Added fallback to fs.promises.appendFile for resilience when handle isn't ready yet.
Gotchas Discovered: The file handle open is async, so there's a brief window after attachLogHandlers where writes use the fallback path. This is acceptable since it only affects the first few log lines.
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: File handle reuse is more efficient than repeated appendFile calls for high-frequency writes
