---
status: resolved
severity: critical
type: scenario_failure
user_story: US2
created: 2026-03-17
resolved_date: 2026-03-17
fix_applied: "Strip memory/ prefix from MemoryStore search paths in memory-search.ts"
---

# BUG-001: Search-to-Explorer navigation broken — path prefix mismatch

## Summary
MemoryStore.search() returns paths with `memory/` prefix (e.g., `memory/notes.md`), but the file API endpoints (`/api/memory/files/:path`) expect paths relative to the memory directory (e.g., `notes.md`). Clicking a search result navigates to a 404 error.

## Reproduction Steps
1. Open the Memory Dashboard
2. Type a search query that matches a memory file (e.g., "vitest")
3. Click on a Memory File search result
4. **Actual**: File content panel shows "Failed to load file" (404)
5. **Expected**: Explorer tab opens with the matching file content displayed

## Expected vs Actual
- **Expected**: Search result path `notes.md` → `GET /api/memory/files/notes.md` → 200 with content
- **Actual**: Search result path `memory/notes.md` → `GET /api/memory/files/memory/notes.md` → 404

## Evidence
```bash
# Search returns path with memory/ prefix
curl -H "Authorization: Bearer ..." "/api/memory/search?q=vitest"
# → { "memory": [{ "path": "memory/notes.md", ... }] }

# File API expects path without prefix
curl -H "Authorization: Bearer ..." "/api/memory/files/memory/notes.md"
# → 404 { "error": "File not found" }

curl -H "Authorization: Bearer ..." "/api/memory/files/notes.md"
# → 200 { "path": "notes.md", "content": "...", ... }
```

## Technical Analysis
- **Probable Cause**: MemoryStore stores file paths relative to `~/.slashbot/` (including `memory/` subdirectory), but the file handler resolves paths relative to `~/.slashbot/memory/`.
- **Affected Files**: `src/plugins/webui/handlers/memory-search.ts` (line ~36, where `store.search()` results are passed through)
- **Suggested Fix**: Strip `memory/` prefix from each search hit's `path` field before returning results:
  ```typescript
  const memoryHits = (await store.search(q, limit)).map(hit => ({
    ...hit,
    path: hit.path.replace(/^memory\//, ''),
  }));
  ```
