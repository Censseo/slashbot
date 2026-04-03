---
status: resolved
severity: low
type: scenario_failure
user_story: US3
created: 2026-03-17
resolved_date: 2026-03-17
fix_applied: "Strip memory/ prefix from appendToday result path in memory-notes.ts"
---

# BUG-002: POST /api/memory/notes returns path with memory/ prefix

## Summary
The quick note endpoint returns a path with `memory/` prefix (`memory/202603/20260317.md`) that is inconsistent with the file tree API which uses paths without the prefix (`202603/20260317.md`). Cosmetic issue — the frontend does not use the returned path for navigation.

## Reproduction Steps
1. POST to `/api/memory/notes` with `{ "text": "test" }`
2. Response: `{ "path": "memory/202603/20260317.md" }`
3. GET `/api/memory/files` shows: `{ "path": "202603/20260317.md" }`

## Expected vs Actual
- **Expected**: `{ "path": "202603/20260317.md" }` (consistent with file tree paths)
- **Actual**: `{ "path": "memory/202603/20260317.md" }` (has `memory/` prefix)

## Technical Analysis
- **Probable Cause**: `store.appendToday()` returns the MemoryStore-internal path which includes the `memory/` prefix
- **Affected Files**: `src/plugins/webui/handlers/memory-notes.ts` (line ~26)
- **Suggested Fix**: Strip the prefix from the returned path:
  ```typescript
  const result = await store.appendToday(parsed.data.text);
  const path = (result.path || '').replace(/^memory\//, '');
  res.end(JSON.stringify({ path }));
  ```
