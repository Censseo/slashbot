# Task Result: T007 - Implement settings.js Generator Function

**Task ID**: T007
**Status**: COMPLETE
**Date**: 2026-02-13

## Task Description

Implement settings.js generator function in `src/plugins/nodered/services/settings.ts` (depends on T003, T006 — tests must fail first)

## Implementation Summary

Created `/home/harapeko/slashbot/src/plugins/nodered/services/settings.ts` with the `generateSettings()` function that converts `NodeRedConfig` to a valid Node.js module string for Node-RED's `settings.js` file. All 44 unit tests pass, and TypeScript compilation succeeds with no errors.

### Files Changed

1. **Created**: `/home/harapeko/slashbot/src/plugins/nodered/services/settings.ts`
   - Single exported function: `generateSettings(config: NodeRedConfig): string`
   - 55 lines including TSDoc comments
   - Maps config fields to Node-RED settings.js format
   - Generates valid JavaScript module.exports syntax

### Implementation Details

**Function Signature**:
```typescript
export function generateSettings(config: NodeRedConfig): string
```

**Input**: `NodeRedConfig` object with fields:
- `port`: number (mapped to `uiPort`)
- `localhostOnly`: boolean (mapped to `uiHost`: 'localhost' or '0.0.0.0')
- `userDir`: string (mapped to `userDir`)

**Output**: JavaScript string that evaluates to:
```javascript
module.exports = {
  uiPort: <config.port>,
  uiHost: '<localhost|0.0.0.0>',
  userDir: '<config.userDir>',
  flowFile: 'flows.json',
  httpAdminRoot: '/',
  httpNodeRoot: '/',
  functionGlobalContext: {},
  logging: {
    console: {
      level: 'info',
      metrics: false,
      audit: false
    }
  },
  editorTheme: {
    projects: {
      enabled: false
    }
  }
};
```

**Mapping Logic**:
1. `uiPort`: Directly from `config.port`
2. `uiHost`: Conditional - `'localhost'` if `config.localhostOnly === true`, else `'0.0.0.0'`
3. `userDir`: Directly from `config.userDir` (supports tilde paths, absolute paths, spaces)
4. `flowFile`: Hardcoded to `'flows.json'`
5. `httpAdminRoot`: Hardcoded to `'/'`
6. `httpNodeRoot`: Hardcoded to `'/'`
7. `functionGlobalContext`: Empty object `{}`
8. `logging.console.level`: Hardcoded to `'info'` (future: could be configurable)
9. `logging.console.metrics`: `false`
10. `logging.console.audit`: `false`
11. `editorTheme.projects.enabled`: `false` (disables Node-RED project mode)

## Test Results

```bash
npx vitest run src/plugins/nodered/services/settings.test.ts

✓ src/plugins/nodered/services/settings.test.ts (44 tests) 30ms

 Test Files  1 passed (1)
      Tests  44 passed (44)
   Duration  346ms
```

**Test Coverage**:
- Output format validation (4 tests)
- uiPort mapping (3 tests)
- userDir mapping (3 tests)
- flowFile mapping (2 tests)
- httpAdminRoot mapping (1 test)
- httpNodeRoot mapping (1 test)
- functionGlobalContext mapping (2 tests)
- Logging configuration (4 tests)
- editorTheme configuration (4 tests)
- uiHost configuration (3 tests)
- Required fields presence (1 test)
- Config-to-JS mapping completeness (1 test)
- Edge cases (3 tests)
- JavaScript syntax validation (3 tests)
- Special characters in paths (3 tests)
- Port ranges (3 tests)
- Logging levels (1 test)
- Integration readiness (2 tests)

## Type Check Results

```bash
npm run typecheck
# No type errors - compilation succeeds
```

All types are correctly inferred from the `NodeRedConfig` interface defined in T003.

## Deviations from Plan

**None**. The implementation follows the exact specification from:
- `/specs/001-nodered-lifecycle/data-model.md` (lines 185-208)
- Test requirements in `settings.test.ts` (all 44 tests)
- Task instructions in `tasks.md` (T007)

## Gotchas

1. **String Interpolation**: Used template literals for the entire module.exports string to ensure proper formatting and avoid escaping issues.

2. **No Trailing Comma**: JavaScript object literals must not have a trailing comma before the closing brace. The generated output ends with `}` directly after the `editorTheme` property.

3. **Path Quoting**: Paths are properly quoted as JavaScript strings, supporting:
   - Tilde expansion (`~/my-nodered`)
   - Spaces in paths (`/path with spaces/nodered`)
   - Absolute paths (`/var/lib/nodered`)

4. **Valid JavaScript**: The output can be evaluated with `new Function()` and passed directly to Node.js via `require()` or file writing.

5. **uiHost Binding**: The `localhostOnly` flag controls network exposure:
   - `true` → `'localhost'` (127.0.0.1 only, secure default)
   - `false` → `'0.0.0.0'` (all interfaces, for remote access)

## TODOs

None. All requirements are satisfied. Future enhancements could include:
- Configurable logging level (currently hardcoded to 'info')
- Additional Node-RED settings (apiMaxLength, debugMaxLength, etc.)
- Custom functionGlobalContext variables

These are outside the current spec and can be added in future iterations if needed.

## Lessons Learned

1. **TDD Value**: Having 44 comprehensive tests written first (T006) made implementation straightforward. Each test acted as a mini-specification.

2. **Template Literals vs String Concatenation**: Using a single template literal with embedded `${}` expressions is cleaner than building the string piece-by-piece.

3. **Node-RED Defaults**: Node-RED expects specific settings structure. Following the official Node-RED `settings.js` template ensures compatibility.

4. **Separation of Concerns**: This generator is a pure function with no dependencies on DI, EventBus, or file system. It can be tested in isolation and reused anywhere.

5. **JavaScript Generation**: Generating valid JavaScript requires attention to syntax details (commas, quotes, braces). The tests validate both syntactic correctness and semantic meaning.

## Next Steps

**Phase 2 Checkpoint**: With T003, T004, T005, T006, and T007 complete, the foundational phase is done.

**Ready to proceed to Phase 3 (User Story 1)**:
- **T008**: Write unit tests for NodeRedManager core
- **T009**: Implement NodeRedManager service (uses `generateSettings()` before spawn)
- **T010**: Create NODERED_PROMPT constant
- **T011**: Implement NodeRedPlugin class
- **T012**: Register NodeRedPlugin in loader.ts

The settings generator will be called by `NodeRedManager.start()` to write the generated settings.js before spawning the Node-RED process.

## Traceability

- **Spec Source**: `/specs/001-nodered-lifecycle/data-model.md` (NodeRedSettingsJS section)
- **Task Plan**: `/specs/001-nodered-lifecycle/tasks.md` (Phase 2: Foundational, T007)
- **Test Suite**: `/src/plugins/nodered/services/settings.test.ts` (T006, 44 tests)
- **Contract Reference**: data-model.md lines 185-208
- **Dependencies**: T003 (types), T006 (tests)

## Files Reference

**Created**:
- `/home/harapeko/slashbot/src/plugins/nodered/services/settings.ts`

**Tested Against**:
- `/home/harapeko/slashbot/src/plugins/nodered/services/settings.test.ts`

**Uses Types From**:
- `/home/harapeko/slashbot/src/plugins/nodered/types.ts` (NodeRedConfig interface)
