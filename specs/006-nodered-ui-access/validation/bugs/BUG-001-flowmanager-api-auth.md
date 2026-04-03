---
status: resolved
severity: critical
type: scenario_failure
user_story: US2
created: 2026-03-05
---

# BUG-001: FlowManager API calls fail with 401 when adminAuth is enabled

## Summary

When editor credentials are configured (adminAuth in settings.js), all FlowManager API calls to Node-RED return HTTP 401 Unauthorized. This breaks flow CRUD operations, the FlowChangePoller, and MCP Bridge tool registration.

## Reproduction Steps

1. Configure editor credentials: `/nodered config editor.username admin` + `/nodered config editor.password testpass123`
2. Start Node-RED (settings.js now includes adminAuth block)
3. Any FlowManager operation (listFlows, createFlow, getFlowsRevisionHash) fails with 401

## Expected vs Actual

- **Expected**: FlowManager authenticates with Node-RED Admin API using configured credentials
- **Actual**: FlowManager sends unauthenticated requests, all return HTTP 401

## Evidence

- E2E test output: `Unexpected error (401) while listing flows.` at `FlowManager.ts:421`
- FlowChangePoller silently swallows the error (catch block at `FlowChangePoller.ts:64`), hash stays `null`
- All flow operations (create, update, delete, list) affected

## Technical Analysis

- **Root Cause**: Feature 006 added `adminAuth` to `settings.js` but did not update `FlowManager` to authenticate. Before 006, `httpAdminRoot: false` disabled the editor AND the auth requirement on the Admin API.
- **Affected Files**: `src/plugins/nodered/services/FlowManager.ts` (all API calls via `fetchWithRetry`)
- **Suggested Fix**: FlowManager must obtain an access token via `POST /auth/token` and pass `Authorization: Bearer <token>` in all API requests. Token should be cached and refreshed on 401.
