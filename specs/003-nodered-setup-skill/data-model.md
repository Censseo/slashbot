# Data Model: Node-RED Setup Skill

**Feature**: 003-nodered-setup-skill
**Date**: 2026-02-19

## Entities

### NodeRedState (EXTENDED)

**Status**: EXTENDED — add `setup-needed` to existing union type

**Current** (6 values):
```typescript
type NodeRedState = 'disabled' | 'unavailable' | 'stopped' | 'starting' | 'running' | 'failed';
```

**New** (7 values):
```typescript
type NodeRedState =
  | 'disabled'       // Config enabled=false
  | 'unavailable'    // Enabled but Node.js not found
  | 'setup-needed'   // Node.js available but Node-RED not installed
  | 'stopped'        // Installed and ready to start
  | 'starting'       // Process spawned, waiting for health
  | 'running'        // Healthy and responding
  | 'failed';        // All restart attempts exhausted
```

**New transitions**:
```
disabled     → stopped | unavailable | setup-needed
setup-needed → starting | stopped | failed
```

### VALID_TRANSITIONS (EXTENDED)

```typescript
const VALID_TRANSITIONS: Record<NodeRedState, NodeRedState[]> = {
  disabled:       ['stopped', 'unavailable', 'setup-needed'],
  unavailable:    ['stopped'],
  'setup-needed': ['starting', 'stopped', 'failed'],
  stopped:        ['starting', 'failed'],
  starting:       ['running', 'failed', 'stopped'],
  running:        ['stopped', 'starting', 'failed'],
  failed:         ['starting', 'stopped'],
};
```

### STATE_LABELS (EXTENDED)

```typescript
const STATE_LABELS: Record<NodeRedState, string> = {
  disabled:       'NR: Disabled',
  unavailable:    'NR: Unavailable',
  'setup-needed': 'NR: Setup Needed',
  stopped:        'NR: Stopped',
  starting:       'NR: Starting',
  running:        'NR: Running',
  failed:         'NR: Failed',
};
```

### EventMap (EXTENDED)

**New event**:
```typescript
'nodered:setup-needed': Record<string, never>;
```

### NodeRedSetupSkill (NEW)

A bundled SKILL.md file — not a TypeScript entity. Structure:

```
src/plugins/skills/bundled/nodered-setup/SKILL.md
```

**Frontmatter**:
```yaml
---
name: Node-RED Setup
description: Install, start, stop, and manage the Node-RED runtime for slashbot
metadata:
  {
    "slashbot": {
      "emoji": "🔴",
      "skillKey": "nodered-setup",
      "requires": {
        "bins": ["node"]
      }
    }
  }
userInvocable: true
disableModelInvocation: false
---
```

**Sections** (instruction body):
1. **Detect** — Check Node-RED installation status
2. **Install** — Detect package manager, install Node-RED
3. **Start** — Start Node-RED process, write PID file
4. **Stop** — Read PID, SIGTERM/SIGKILL, remove PID file
5. **Restart** — Stop then Start
6. **Verify** — Health check via HTTP poll
7. **Troubleshoot** — Common issues and fixes

### PID File (NEW)

**Path**: `~/.slashbot/nodered/nodered.pid`
**Format**: Plain text, single line containing the Node-RED process PID
**Lifecycle**: Written by skill on start, read on stop, removed on stop

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/plugins/nodered/types.ts` | EXTEND | Add `setup-needed` to `NodeRedState` |
| `src/plugins/nodered/services/NodeRedManager.ts` | REFACTOR | Remove `ensureNodeRedInstalled()`, add `setup-needed` state, move settings.js to setup, read PID file |
| `src/plugins/nodered/index.ts` | EXTEND | Add `setup-needed` label, enrich context provider, add automation once job, eager settings.js |
| `src/plugins/nodered/prompt.ts` | EXTEND | Add skill invocation guidance |
| `src/plugins/skills/index.ts` | REFACTOR | Update `resolveBundledSkillsDir()` path |
| `src/plugins/skills/bundled/nodered-setup/SKILL.md` | NEW | Bundled skill file |

## Files Not Modified

| File | Reason |
|------|--------|
| `src/plugins/nodered/services/FlowManager.ts` | Flow management unaffected |
| `src/plugins/nodered/flow-types.ts` | Flow types unaffected |
| `src/plugins/nodered/flow-validator.ts` | Flow validation unaffected |
| `src/plugins/nodered/services/RingBuffer.ts` | Reused as-is |
| `src/plugins/nodered/services/settings.ts` | Reused as-is (caller changes, not the function) |
| `src/plugins/automation/index.ts` | Consumed via service API, no changes needed |
