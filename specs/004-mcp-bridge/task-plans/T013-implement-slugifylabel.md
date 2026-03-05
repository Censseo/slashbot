# Task Plan: T013

## Task Description
Implement `slugifyLabel(label: string): string` — lowercase, replace non-alphanumeric (except hyphens) with hyphens, collapse consecutive, trim, max 64 chars; return `nodered:<slug>`; warn if truncated (FR-004).
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Pure transformation function, deterministic
- Conventions: private method on `McpBridgeService`; tool ID format `nodered:<slug>` (colon separator for dynamic tools vs dot for static)
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID

## Codebase Impact
- Files to modify: `src/plugins/nodered/services/McpBridgeService.ts` — add `slugifyLabel` private method

## Implementation Steps
1. Add private method:
   ```ts
   private slugifyLabel(label: string): string {
     let slug = label.toLowerCase()
       .replace(/[^a-z0-9-]+/g, '-')
       .replace(/-{2,}/g, '-')
       .replace(/^-+|-+$/g, '');
     if (slug.length > 64) {
       this.logger.warn('tool slug truncated to 64 chars', { original: slug, truncated: slug.slice(0, 64) });
       slug = slug.slice(0, 64);
     }
     return `nodered:${slug}`;
   }
   ```

Gotchas:
- 64-char limit applies to slug part only, not the `nodered:` prefix (total up to 72 chars)
- Empty slug (label like `"---"`) produces `nodered:` — callers should handle
- Trim after collapse to avoid false trim

## Related Tasks
Depends on: T011 | Blocks: T015 | Parallel with: T012, T014

## Estimated Complexity
Simple | ~20 min | Risk: Low
