# Quickstart: Node-RED UI Access

**Feature**: 006-nodered-ui-access

## Prerequisites

- Node-RED running via slashbot (`/nodered start`)
- slashbot with nodered plugin enabled

## Setup

1. **Configure editor credentials**:
   ```
   /nodered config editor.username admin
   /nodered config editor.password mysecretpassword
   ```

2. **Restart Node-RED** (to apply settings.js changes):
   ```
   /nodered restart
   ```

3. **Get the editor URL**:
   ```
   /nodered ui
   ```
   Output: `Node-RED Editor: http://localhost:1880`

4. **Open in browser** and log in with the configured credentials.

## Flow Change Detection

When you create or modify flows in the editor:
- Changes are detected automatically within ~15 seconds
- Flows with `mcp-` prefix are auto-registered as bot tools
- The bot is notified of all external flow changes

## Key Commands

| Command | Description |
|---------|-------------|
| `/nodered ui` | Show editor URL (or prompt to configure credentials) |
| `/nodered config editor.username <user>` | Set editor username |
| `/nodered config editor.password <pass>` | Set editor password (hashed with bcrypt) |
