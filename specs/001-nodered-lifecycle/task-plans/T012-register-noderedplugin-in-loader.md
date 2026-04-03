# Task Plan: T012

## Task Description
Register NodeRedPlugin in `src/plugins/loader.ts`: add import and instantiation in loadBuiltinPlugins()

Phase: User Story 1 - Automatic Node-RED Startup | User Story: US1 | Parallel: No | Reuse Type: EXTEND

## Architecture Alignment
- Patterns applied: Plugin Registration Pattern (static import + array instantiation in loadBuiltinPlugins())
- Tech decisions followed: All plugins loaded via loader.ts, topological sort by registry handles dependency order
- Conventions: file at `src/plugins/loader.ts`, import at top with other feature plugins, instantiate in feature section
- Anti-patterns avoided: No dynamic import (all plugins statically imported), no conditional loading
- Status: Aligned

## Reuse Decision
Original: EXTEND | Validation: VALID
Base component path: `src/plugins/loader.ts`
Extension point: Add new plugin to `loadBuiltinPlugins()` return array

## Codebase Impact
- Files to create: None
- Files to modify:
  - `src/plugins/loader.ts` -- Add import statement (top of file) + Add instantiation in loadBuiltinPlugins() array (feature plugins section)
- Dependencies: NodeRedPlugin from `./nodered` (T011)

## Implementation Steps
1. Open `src/plugins/loader.ts`
2. Add import statement in feature plugins section:
   ```typescript
   import { NodeRedPlugin } from './nodered';
   ```
3. Add instantiation in `loadBuiltinPlugins()` return array (feature plugins section):
   ```typescript
   new NodeRedPlugin(),
   ```
4. Maintain alphabetical order within the feature section
5. Ensure trailing comma for clean diffs

Gotchas:
- Placement: maintain consistent ordering with other feature plugin imports/instantiations
- Comma: ensure trailing comma
- TypeScript will verify NodeRedPlugin implements Plugin interface at compile time
- Plugin auto-initializes when Kernel calls PluginRegistry.initAll()

## Related Tasks
Depends on: T011 (NodeRedPlugin class must exist) | Blocks: None (final wiring step for US1) | Parallel with: None

## Estimated Complexity
Simple | 5min | Risk: Low
