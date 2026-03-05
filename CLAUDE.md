# slashbot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-03

## Active Technologies
- (001-nodered-lifecycle), ActionParser), Automation plugin (soft dependency), Bun 1.0+, `Bun.password.hash()` for bcrypt, `editorPasswordHash`), Ephemeral — tool definitions rebuilt from flow state on each startup; FlowMetadata extended with `params` (persisted in `~/.slashbot/nodered/flow-metadata.json`), EventBus, EventBus (core), Existing slashbot core (InversifyJS DI, Existing slashbot plugin SDK, InversifyJS (DI), JSON file (`~/.slashbot/nodered.json` extended with `editorUsername`, native `fetch` (HTTP), Node-RED Admin API v3.x, Node-RED Admin API v3.x (REST via localhost), PID file at `~/.slashbot/nodered/nodered.pid`; config at `~/.slashbot/nodered.json`; settings at `~/.slashbot/nodered/settings.js`, Skills plugin (SkillManager), TypeScript (strict mode), Zod v4 (schemas)
- JSON file (`~/.slashbot/nodered/flow-metadata.json`) for custom metadata; Node-RED manages flow storage in `flows.json`


## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

# Add commands for 

## Code Style

: Follow standard conventions

## Recent Changes
- 006-nodered-ui-access: Added TypeScript (strict mode), Bun 1.0+ + InversifyJS (DI), EventBus (core), native `fetch` (HTTP), Node-RED Admin API v3.x, `Bun.password.hash()` for bcrypt
- 005-ai-flow-authoring: Added prompt-only AI flow generation (webhook, cron, ETL patterns), gateway methods for Node-RED flow CRUD, flow validator node type enforcement
- 004-mcp-bridge: Added TypeScript (strict mode), Bun 1.0+ + InversifyJS (DI), Zod v4 (schemas), EventBus (core), native `fetch` (HTTP)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
