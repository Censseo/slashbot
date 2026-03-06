# Automation Specification

> Source of truth for automation functionality.
> Last updated: 2026-03-06
> **Status**: Active

## Overview

The automation domain covers Slashbot's autonomous and scheduled capabilities: cron-based task scheduling, the heartbeat system (periodic AI self-reflection and proactive monitoring), the skills system (installable capabilities from URLs), and the planning plugin (multi-step autonomous task execution). These systems enable Slashbot to operate autonomously beyond simple request-response interactions.

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Scheduling Plugin | `src/plugins/scheduling/index.ts` | Cron job management plugin |
| Task Scheduler | `src/plugins/scheduling/services/TaskScheduler.ts` | Core scheduler with persistent tasks |
| Cron Service | `src/plugins/scheduling/services/cron.ts` | Cron expression parsing and execution |
| Heartbeat Plugin | `src/plugins/heartbeat/index.ts` | Periodic AI reflection plugin |
| Heartbeat Service | `src/plugins/heartbeat/services/HeartbeatService.ts` | Reflection loop, alert system |
| Skills Plugin | `src/plugins/skills/index.ts` | Skill loading and management plugin |
| Skill Manager | `src/plugins/skills/services/SkillManager.ts` | Install/load skills from URLs |
| Planning Plugin | `src/plugins/planning/index.ts` | Multi-step autonomous planning |

## Capabilities

| System | Purpose | Trigger |
|--------|---------|---------|
| Scheduling | Run recurring tasks on cron schedules | `/tasks` commands |
| Heartbeat | Periodic self-reflection, proactive alerts | Configured interval |
| Skills | Extend capabilities with installable modules | `/skill install <url>` |
| Planning | Break complex tasks into executable steps | `/plan` or auto-detected |

## Features

### AI Flow Authoring

> Added: 2026-03-03 | Source: specs/005-ai-flow-authoring/

Enables users to create, preview, and deploy Node-RED flows from natural language descriptions via the bot's LLM. The integration is prompt-only — enriched prompt contributions guide the LLM to generate valid flow JSON and call existing `nodered.flow.create` / `nodered.flow.update` tools.

#### User Stories

1. **Create a Webhook Flow** (P1): User describes a webhook endpoint in plain language; the bot generates, validates, previews, and deploys a flow with HTTP In/Function/HTTP Response nodes.
2. **Create a Periodic Automation** (P1): User requests a recurring task (e.g., "Check BTC price every 10 minutes"); the bot generates a flow with inject (timed trigger), HTTP request, processing, and optional conditional notification nodes.
3. **Create a Data Pipeline (ETL)** (P2): User requests multi-source data aggregation; the bot generates parallel HTTP requests, a join node, and formatting logic.
4. **Preview Flow Before Deployment** (P2): The bot always presents a plain-text summary (flow name, pattern type, ordered node list, connection description) and awaits user confirmation before deploying.

#### Business Rules

- Three base flow patterns supported: webhook, periodic automation, data pipeline (ETL).
- Generated flows are validated before deployment: valid node structure, tab node present, wire references to existing IDs, standard node types only.
- On validation failure, the system auto-retries up to 2 times with corrected flow JSON.
- AI-generated flows get `mcp: true` by default (auto-exposed as MCP tools).
- The LLM must ask clarifying questions if the user description lacks: trigger type, primary action, or data sources/targets.
- Existing flows can be modified via `nodered.flow.update` — LLM fetches current state first.

#### Standard Node Types

HTTP In, HTTP Response, Function, Inject, Debug, Change, Switch, Template, HTTP Request, Join.

#### Security

- Flows must not embed credentials directly; use Node-RED credential store or environment variables.
- Function nodes rely on Node-RED's built-in VM2 sandbox for isolation.
- User input is never interpolated directly into flow JSON.

#### Success Criteria

- SC-001: ≥80% success rate for generating and deploying functional flows across the three base patterns.
- SC-002: Working webhook flow from single natural language request in <30 seconds.
- SC-003: Flows are readable and properly laid out in Node-RED visual editor.
- SC-004: ≥50% retry success rate for failed flow generations.

### Node-RED UI Access

> Added: 2026-03-06 | Source: specs/006-nodered-ui-access/

Enables administrators to access the Node-RED visual editor in a browser to view, create, and modify flows. The system protects editor access with username/password authentication, detects flow changes made through the editor via polling, and updates MCP tool registrations accordingly.

#### User Stories

1. **Access the Node-RED Editor** (P1): Administrator uses `/nodered ui` to retrieve the editor URL, opens it in a browser, and authenticates with configured credentials.
2. **Modify a Bot-Created Flow in the Editor** (P2): Administrator opens the editor, modifies a bot-created flow, deploys changes; the system detects the modification within 30 seconds and updates the corresponding MCP tool.
3. **Create a Complex Flow in the Editor** (P3): Administrator designs a complex flow in the editor using the `mcp-` naming convention; the system auto-exposes it as a bot tool.

#### Business Rules

- Editor access requires username/password authentication via Node-RED `adminAuth`.
- Password is bcrypt-hashed (cost factor 10, via `Bun.password.hash()`) before storage — plaintext is never persisted.
- Editor binds to `127.0.0.1` by default (local access only).
- Editor is disabled (`httpAdminRoot: false`) when credentials are not yet configured.
- Flow change detection uses polling with revision hash comparison to avoid re-processing bot-initiated changes.
- Changes detected within 30 seconds of deployment (two 15s poll cycles worst case).
- Concurrent edits follow last-write-wins (Node-RED default behavior).
- Credentials configured via `/nodered config editor.username <user>` and `/nodered config editor.password <pass>`.
- Context provider exposes editor URL but MUST NOT include `editorPasswordHash` or `editorUsername` in LLM context.

#### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| FlowChangePoller | `src/plugins/nodered/services/FlowChangePoller.ts` | Polls Node-RED API for flow changes |
| Editor Auth Config | `~/.slashbot/nodered.json` | Stores `editorUsername` and `editorPasswordHash` |
| Settings Generator | `src/plugins/nodered/services/NodeRedManager.ts` | Generates `settings.js` with `adminAuth` |

#### Security

- Passwords bcrypt-hashed before storage; plaintext never persisted.
- Editor bound to localhost by default; remote access (HTTPS, reverse proxy) is user's responsibility.
- Brute-force protection via Node-RED's built-in rate limiting.
- Invalid/partial credentials disable editor gracefully instead of crashing.

#### Success Criteria

- SC-001: Administrator can access and authenticate to the Node-RED editor via `/nodered ui`.
- SC-002: Flow changes in the editor are detected within 30 seconds.
- SC-003: Flows with `mcp-` prefix created in editor are auto-exposed as MCP tools without restart.
- SC-004: Editor is only accessible from localhost by default.
- SC-005: All bot-created flows are visible and editable in the editor.
