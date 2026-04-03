# Task Plan: T012

## Task Description
Implement `isEligible(flow: FlowInfo): boolean` — check for HTTP-in node (via `FlowInfo.httpEndpoints`), `mcp:true` metadata, or `mcp-<name>` label pattern; require HTTP endpoint in all cases; log warning for `mcp:true` without HTTP-in.
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Pure predicate logic, no I/O
- Tech decisions followed: TypeScript strict; uses `FlowInfo.httpEndpoints` (already populated by `FlowManager.listFlows()`)
- Conventions: private method on `McpBridgeService`
- Anti-patterns avoided: No direct Node-RED API calls
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID
**Note**: FlowParser does NOT exist — `FlowManager.listFlows()` already populates `httpEndpoints` on `FlowInfo`. No separate parser needed.

## Codebase Impact
- Files to modify: `src/plugins/nodered/services/McpBridgeService.ts` — add `isEligible` private method

## Implementation Steps
1. Add private method:
   ```ts
   private isEligible(flow: FlowInfo): boolean {
     const hasHttpEndpoint = flow.httpEndpoints.length > 0;
     const isMcpFlagged = flow.metadata.mcp === true;
     const isMcpLabeled = /^mcp-/i.test(flow.label);
     if (isMcpFlagged && !hasHttpEndpoint) {
       this.logger.warn('flow has mcp:true but no HTTP-in node — skipping', { flowId: flow.id, label: flow.label });
       return false;
     }
     return hasHttpEndpoint && (isMcpFlagged || isMcpLabeled);
   }
   ```

Gotchas:
- `flow.metadata.mcp` is `boolean` (not optional) — `=== true` is safe
- Regex `/^mcp-/i` is case-insensitive (defensive)
- Both eligibility paths require HTTP endpoint

## Related Tasks
Depends on: T011 | Blocks: T016 | Parallel with: T013, T014

## Estimated Complexity
Simple | ~20 min | Risk: Low
