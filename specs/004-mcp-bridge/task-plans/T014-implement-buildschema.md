# Task Plan: T014

## Task Description
Implement `buildSchema(params)` — convert `Record<string, ParamDescriptor>` to Zod schema; map `type` to `z.string()`/`z.number()`/`z.coerce.boolean()`; apply `.optional()` for non-required; fallback default schema (FR-005).
Phase: Phase 3 | User Story: US1 | Parallel: No | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: Follows existing Zod usage in `src/plugins/nodered/index.ts` (`z.object({...})`)
- Tech decisions followed: Zod v4, `import { z } from 'zod'`
- Conventions: private method on `McpBridgeService`
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: VALID

## Codebase Impact
- Files to modify: `src/plugins/nodered/services/McpBridgeService.ts` — add `import { z } from 'zod'`, add `buildSchema` private method

## Implementation Steps
1. Add `import { z } from 'zod';` at top of file
2. Add private method:
   ```ts
   private buildSchema(params: Record<string, ParamDescriptor> | undefined): z.ZodObject<z.ZodRawShape> {
     if (!params || Object.keys(params).length === 0) return z.object({});
     const shape: z.ZodRawShape = {};
     for (const [key, desc] of Object.entries(params)) {
       let field: z.ZodTypeAny;
       switch (desc.type) {
         case 'number': field = z.number(); break;
         case 'boolean': field = z.coerce.boolean(); break;
         default: field = z.string(); break;
       }
       if (desc.description) field = field.describe(desc.description);
       if (!desc.required) field = field.optional();
       shape[key] = field;
     }
     return z.object(shape);
   }
   ```

Gotchas:
- `.describe()` must be called before `.optional()` — order matters in Zod v4
- `z.coerce.boolean()` coerces strings (`"true"` → `true`) — needed for HTTP query params
- Consider `z.coerce.number()` for consistency (strings from HTTP)
- Import style: `import { z } from 'zod'` (same as `index.ts:11`)

## Related Tasks
Depends on: T011, T004 (ParamDescriptor) | Blocks: T015 | Parallel with: T012, T013

## Estimated Complexity
Simple | ~25 min | Risk: Low
