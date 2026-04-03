Status: Complete
Files Changed:
  - src/plugins/nodered/index.ts: Enriched context provider to include editor URL when EditorState is 'available'; sensitive fields (editorPasswordHash, editorUsername) excluded from output
Deviations from Plan: None
Gotchas Discovered: Context provider checks getState() before getEditorUrl(), so 'disabled' state returns early — editor URL only appears when state is not 'disabled' or 'setup-needed'
TODOs Left: None
Lessons Learned: None
