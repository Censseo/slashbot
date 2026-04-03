Status: Complete
Files Changed:
  - src/plugins/nodered/flow-types.ts: Added `ParamDescriptor` interface; added `params?: Record<string, ParamDescriptor>` and `timeout?: number` to both `FlowMetadata` and `FlowMetadataInput`
Deviations from Plan: Added `timeout?: number` field (referenced in FR-006 / T020 / T021) alongside `params` — both are persisted metadata fields; included here to keep FlowMetadata complete.
Gotchas Discovered: None
TODOs Left:
  - Blockers: None
  - Enhancements: None
  - Technical debt: None
Lessons Learned: Extending both FlowMetadata and FlowMetadataInput together ensures consistency for create/update paths.
