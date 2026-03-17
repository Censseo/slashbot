---
status: resolved
severity: critical
type: scenario_failure
user_story: US1
created: 2026-03-17
---

# BUG-001: Gateway route matching does not support path parameters

## Summary
The gateway server performed exact string matching on route paths, so parameterized routes like `/api/conversations/:id` never matched actual requests like `/api/conversations/550e8400-...`.

## Reproduction Steps
1. Start slashbot
2. Create a conversation via POST /api/chat
3. GET /api/conversations/:id with the returned sessionId
4. Receive 404 "Not found" instead of conversation data

## Expected vs Actual
- **Expected**: 200 with full conversation data
- **Actual**: 404 "Not found"

## Evidence
- GET /api/conversations (list) worked fine (exact match)
- GET /api/conversations/:id returned 404
- DELETE /api/conversations/:id also returned 404

## Technical Analysis
- **Probable Cause**: `src/core/gateway/server.ts` line 398 used `item.path === reqPath` which is exact match only
- **Affected Files**: `src/core/gateway/server.ts`
- **Fix Applied**: Added `matchRoutePath()` function that supports `:param` wildcard segments in route patterns
