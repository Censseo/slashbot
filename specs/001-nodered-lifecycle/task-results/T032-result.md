Status: Complete
Files Changed:
  - src/plugins/nodered/services/NodeRedManager.ts: Moved TextDecoder from per-chunk creation inside WritableStream.write() to a class field (private textDecoder = new TextDecoder()). Used stream: true option for proper multi-chunk decoding.
Deviations from Plan: None
Gotchas Discovered: Added { stream: true } option to TextDecoder.decode() to handle multi-byte characters that may be split across chunks
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: TextDecoder should be reused and use stream: true when processing chunked data
