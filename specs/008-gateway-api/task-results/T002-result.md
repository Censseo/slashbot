Status: Complete
Files Changed:
  - src/plugins/webui/sse.ts: Created SSE_HEADERS, writeSseHeaders(), writeEvent(), writeRawEvent(), startKeepalive()
Deviations from Plan: None
Gotchas Discovered: None
TODOs Left: None
Lessons Learned: SSE format is `data: <json>\n\n`, keepalive uses SSE comment `:keepalive\n\n`
