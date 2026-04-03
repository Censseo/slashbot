# Task Plan: T008

## Task Description
Unit test: `McpBridgeService.buildSchema()` — generates Zod schema from `FlowMetadata.params`; uses fallback `z.object({})` when params absent.
Phase: Phase 3 | User Story: US1 | Parallel: Yes | Reuse Type: NEW

## Architecture Alignment
- Patterns applied: TDD, Zod v4 schema validation
- Conventions: tests in `McpBridgeService.test.ts`
- Status: Aligned

## Reuse Decision
Original: NEW | Validation: NEW_CONFIRMED

## Codebase Impact
- Files to modify: `tests/plugins/nodered/services/McpBridgeService.test.ts` — add `describe('buildSchema')` block
- Dependencies: `ParamDescriptor` from `src/plugins/nodered/flow-types.ts`

## Implementation Steps
1. Add `describe('buildSchema')` block (test via `scanAndRegister` observing registered tool's `parameters` field):
   - Helper: `getSchema(params?)` creates eligible flow with given params, calls `scanAndRegister`, returns registered tool's `parameters` Zod schema
2. Test cases using `.safeParse()` on returned schema:
   - `undefined` params → empty schema, parses `{}` successfully
   - Empty `{}` params → empty schema
   - `{ name: { type: 'string', required: true } }` → accepts `{ name: "test" }`, rejects `{}`
   - `{ count: { type: 'number' } }` → accepts `{ count: 5 }` and `{}`, rejects `{ count: "abc" }`
   - `{ flag: { type: 'boolean' } }` → accepts `{ flag: true }`, coerces `"true"`
   - `{ name: { type: 'string', description: 'The name' } }` → description metadata present
   - Mixed required/optional → required fails on missing, optional doesn't

Gotchas:
- Zod v4 `.describe()` must be called before `.optional()` — test verifies description is preserved
- `z.coerce.boolean()` coerces strings — verify `"true"` works
- Test `.safeParse()` return value's `.success` property

## Related Tasks
Depends on: T005, T006 (helpers) | Blocks: T014 | Parallel with: T006, T007, T009

## Estimated Complexity
Simple | ~25 min | Risk: Low
