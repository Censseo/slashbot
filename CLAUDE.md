# slashbot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-03

## Active Technologies
- (001-nodered-lifecycle), ActionParser), Automation plugin (soft dependency), Bun 1.0+, `Bun.password.hash()` for bcrypt, `editorPasswordHash`), Ephemeral — tool definitions rebuilt from flow state on each startup; FlowMetadata extended with `params` (persisted in `~/.slashbot/nodered/flow-metadata.json`), EventBus, EventBus (core), Existing slashbot core (InversifyJS DI, Existing slashbot plugin SDK, full in-memory load, InversifyJS (DI), JSON file (`~/.slashbot/nodered.json` extended with `editorUsername`, JSONL file (`~/.slashbot/graph.jsonl`), native `fetch` (HTTP), Node-RED Admin API v3.x, Node-RED Admin API v3.x (REST via localhost), PID file at `~/.slashbot/nodered/nodered.pid`; config at `~/.slashbot/nodered.json`; settings at `~/.slashbot/nodered/settings.js`, Skills plugin (SkillManager), TypeScript (strict mode), TypeScript (strict mode) on Bun 1.0+, Vercel AI SDK (LLM calls via createLlmAdapter), Vercel AI SDK (streaming), Zod v4 (schemas), Zod v4 (tool schemas), Zod v4 (validation)
- JSON file (`~/.slashbot/nodered/flow-metadata.json`) for custom metadata; Node-RED manages flow storage in `flows.json`, N/A (stateless — sessions managed by existing SessionManager)


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
- 008-gateway-api: Added TypeScript (strict mode) on Bun 1.0+ + Vercel AI SDK (streaming), Zod v4 (validation), InversifyJS (DI)
- 007-association-graph: Added TypeScript (strict mode), Bun 1.0+ + Zod v4 (tool schemas), InversifyJS (DI), Vercel AI SDK (LLM calls via createLlmAdapter)
- 006-nodered-ui-access: Added TypeScript (strict mode), Bun 1.0+ + InversifyJS (DI), EventBus (core), native `fetch` (HTTP), Node-RED Admin API v3.x, `Bun.password.hash()` for bcrypt


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
