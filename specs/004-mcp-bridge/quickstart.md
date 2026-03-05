# Quickstart: MCP Bridge

**Feature**: 004-mcp-bridge

## Prerequisites

- Features 001 (nodered-lifecycle) and 002 (flow-management) implemented and working
- Node-RED running via slashbot (`/nodered start` or auto-start)
- At least one flow deployed with an HTTP endpoint

## How It Works

1. **Automatic**: When a flow with an HTTP-in node is deployed, it's automatically registered as a tool
2. **The bot sees it**: The tool appears in the bot's available tools on the next interaction
3. **Invocation**: The bot calls the tool by name, parameters are validated and sent as an HTTP request to Node-RED

## Creating an Exposable Flow

### Option A: Any flow with an HTTP-in node

Any flow containing an `http in` node is automatically eligible. The tool name is derived from the flow label.

### Option B: Naming convention

Name your flow `mcp-<tool-name>` (e.g., `mcp-check-sol-price`). The tool is registered as `nodered:check-sol-price`.

### Option C: Metadata annotation

Set `mcp: true` in the flow's metadata when creating via the API. The flow must still have an HTTP endpoint.

## Adding Parameters

Include `params` in flow metadata:

```json
{
  "metadata": {
    "mcp": true,
    "description": "Check the price of a Solana token",
    "params": {
      "token": { "type": "string", "description": "Token symbol", "required": true },
      "currency": { "type": "string", "description": "Quote currency", "required": false }
    }
  }
}
```

Without `params`, the default schema is `{ input?: string }`.

## Verifying Registration

After deploying a flow, the bot should see the tool within 10 seconds. The tool ID follows the pattern `nodered:<slugified-label>`.

## Architecture Overview

```text
Flow Deploy → EventBus (flow:created) → McpBridgeService
  → Check eligibility (HTTP-in node?)
  → Extract endpoint URL + HTTP method
  → Generate Zod schema from params
  → context.registerTool(toolDefinition)
  → EventBus (prompt:redraw)

Bot Invokes Tool → ToolRegistry → McpBridgeService.execute()
  → Validate args against Zod schema
  → HTTP request to localhost:{port}/{endpoint}
  → Return response as ToolResult
```
