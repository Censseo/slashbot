# Quickstart: Node-RED Setup Skill

**Feature**: 003-nodered-setup-skill

## What This Feature Does

Extracts Node-RED installation and process lifecycle management from the nodered plugin into a **bundled skill** (`nodered-setup`). The plugin becomes a thin availability monitor; the bot (LLM) handles installation and process management by following skill instructions.

## Key Changes

1. **New bundled skill** at `src/plugins/skills/bundled/nodered-setup/SKILL.md` — markdown instructions for the bot to install, start, stop, and manage Node-RED
2. **Plugin refactored** — removes `ensureNodeRedInstalled()` and npm dependency; adds `setup-needed` state and dual signaling (context provider + automation job)
3. **Skill loader updated** — bundled skills resolved from `src/plugins/skills/bundled/` instead of `<repo>/skills/`

## How It Works

### First Launch (No Node-RED installed)

```
Plugin init() → detect Node.js ✓ → detect Node-RED ✗ → setState('setup-needed')
  → emit nodered:setup-needed
  → enrich context provider: "Run skill.run nodered-setup to install Node-RED"
  → fire one-shot automation job (if automation plugin available)
  → bot receives context → invokes skill.run nodered-setup
  → skill: detect npm/bun → npm install node-red → start Node-RED → write PID → verify health
  → plugin heartbeat detects Node-RED → setState('running') → emit nodered:ready
```

### Crash Recovery

```
Heartbeat detects failure → emit nodered:error
  → fire one-shot automation job for restart
  → enrich context provider: "Node-RED crashed, run skill to restart"
  → bot invokes skill with restart task
  → up to 3 retries with exponential backoff
```

### Day-to-Day

- `nodered.start`, `nodered.stop`, `nodered.restart` tools still work for running instances
- `/skill run nodered-setup` available for manual invocation
- Heartbeat monitoring unchanged (30s interval)

## Testing

```bash
# Run unit tests
bun run test -- --grep "nodered"

# Verify skill is discovered
# Start slashbot → /skill list → should show [B] nodered-setup
# Start slashbot with no Node-RED → bot should autonomously install and start
```
