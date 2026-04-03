# slashbot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-03

## Active Technologies
- (001-nodered-lifecycle), ActionParser), Alpine.js 3.x (CDN), Alpine.js 3.x (frontend), Automation plugin (soft dependency), Bun 1.0+, `Bun.password.hash()` for bcrypt, `editorPasswordHash`), Ephemeral — tool definitions rebuilt from flow state on each startup; FlowMetadata extended with `params` (persisted in `~/.slashbot/nodered/flow-metadata.json`), EventBus, EventBus (core), Existing slashbot core (InversifyJS DI, Existing slashbot plugin SDK, full in-memory load, highlight.js (CDN), HTML/CSS/JavaScript (ES2022+) — no build step, `index.json` metadata, InversifyJS (DI), JavaScript ES2022+ (frontend), JSON file (`~/.slashbot/nodered.json` extended with `editorUsername`, JSONL files in `~/.slashbot/web-ui/conversations/`, JSONL file (`~/.slashbot/graph.jsonl`), localStorage (auth token only), marked (CDN), N/A (stateless dashboard — all data fetched from existing APIs), native `fetch` (HTTP), Node-RED Admin API v3.x, Node-RED Admin API v3.x (REST via localhost), PenguinUI components, PID file at `~/.slashbot/nodered/nodered.pid`; config at `~/.slashbot/nodered.json`; settings at `~/.slashbot/nodered/settings.js`, served as static files, Skills plugin (SkillManager), Tailwind CSS (CDN), TypeScript (strict mode), TypeScript (strict mode) on Bun 1.0+, TypeScript (strict mode) on Bun 1.0+ (backend), Vercel AI SDK (LLM calls via createLlmAdapter), Vercel AI SDK (streaming), Vercel AI SDK (title generation), Zod v4 (schemas), Zod v4 (tool schemas), Zod v4 (validation)
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
- 011-conversation-history: Added TypeScript (strict mode) on Bun 1.0+ (backend), JavaScript ES2022+ (frontend) + InversifyJS (DI), Zod v4 (validation), Vercel AI SDK (title generation), Alpine.js 3.x (frontend)
- 010-admin-dashboard: Added TypeScript (strict mode) on Bun 1.0+ (backend), JavaScript ES2022+ (frontend) + Alpine.js 3.x (CDN), Tailwind CSS (CDN), PenguinUI components
- 009-chat-ui: Added HTML/CSS/JavaScript (ES2022+) — no build step, served as static files + Alpine.js 3.x (CDN), Tailwind CSS (CDN), marked (CDN), highlight.js (CDN)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
