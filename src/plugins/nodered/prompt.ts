/**
 * Node-RED Plugin - Prompt contribution
 *
 * LLM context for Node-RED managed process.
 * Follows BashPlugin prompt pattern (array of strings joined with \n).
 */

export const FLOW_STRUCTURE_GUIDE = `
## Node-RED Flow JSON Structure

A Node-RED flow is represented as a JSON array of node objects. Every node object MUST include these fields:

| Field   | Type       | Description                                              |
|---------|------------|----------------------------------------------------------|
| id      | string     | Unique 16-character lowercase hex identifier             |
| type    | string     | Node type (e.g. "http in", "function", "debug")         |
| z       | string     | The tab (flow) ID this node belongs to                   |
| x       | number     | X coordinate in the editor canvas                        |
| y       | number     | Y coordinate in the editor canvas                        |
| wires   | string[][] | Output wires: array of arrays of downstream node IDs     |

### Tab Node Requirement

Every flow MUST begin with exactly one node of type \`tab\`. The tab node represents the flow itself:
- Its \`id\` becomes the value of \`z\` for all other nodes in the flow
- The tab node does NOT have a \`z\` field (it is the root)
- The tab node does NOT have a \`wires\` field
- The tab node has \`label\` (string) and optionally \`disabled\` (boolean) and \`info\` (string)

### Wires Format

The \`wires\` field is an array of output port arrays. Most nodes have one output port:
- Single output: \`[["target-node-id"]]\`
- Multiple targets from one port: \`[["target1-id", "target2-id"]]\`
- Two output ports (e.g. switch): \`[["port1-target"], ["port2-target"]]\`
- Terminal node (no outputs): \`[]\`

### Minimal valid flow structure

\`\`\`json
[
  { "id": "<tab-id>", "type": "tab", "label": "My Flow" },
  { "id": "<node-id>", "type": "inject", "z": "<tab-id>", "x": 200, "y": 100, "wires": [["<next-id>"]] },
  { "id": "<next-id>", "type": "debug", "z": "<tab-id>", "x": 400, "y": 100, "wires": [] }
]
\`\`\`

### Tool Call Convention

When calling \`nodered.flow.create\` or \`nodered.flow.update\`, pass:
- \`label\`: the flow name (from the tab node's label)
- \`nodes\`: the array of node objects **excluding** the tab node — the tab is created automatically from \`label\`
- \`metadata\`: optional metadata object (see Metadata Rules)

The \`z\` field on each node should still reference a consistent placeholder ID (e.g. the tab ID from your design), but do NOT include the tab node itself in the \`nodes\` array passed to the tool.
`.trim();

export const NODE_CATALOGUE = `
## Node-RED Built-in Node Catalogue

These are the only node types you may use when generating flows. All 12 types are listed below with their key properties.

---

### tab
Represents the flow (tab) itself. Required as the first element of every flow array.
- \`id\`: string — unique 16-char hex ID (also used as \`z\` value for all sibling nodes)
- \`type\`: "tab"
- \`label\`: string — human-readable flow name
- \`disabled\`: boolean (optional, default false)
- \`info\`: string (optional, markdown description)
No \`z\` or \`wires\` field.

---

### comment
An editor annotation — no runtime effect.
- \`type\`: "comment"
- \`name\`: string — comment text
- \`info\`: string (optional)

---

### inject
Triggers the flow on a schedule or manually.
- \`type\`: "inject"
- \`name\`: string (optional label)
- \`props\`: array of \`{ p: string, vt: string }\` — payload properties to inject
- \`repeat\`: string — interval in seconds (e.g. "60") for repeating injection
- \`crontab\`: string — cron expression for scheduled injection
- \`once\`: boolean — inject once on deploy
- \`onceDelay\`: number — delay in seconds before first injection
- \`wires\`: one output port

---

### debug
Outputs messages to the Debug panel. Terminal node (wires: []).
- \`type\`: "debug"
- \`name\`: string (optional)
- \`active\`: boolean (default true)
- \`tosidebar\`: boolean (default true)
- \`console\`: boolean — also log to console
- \`complete\`: string — "false" (payload only) or "true" (full message)
- \`wires\`: \`[]\`

---

### function
Executes JavaScript code against the message.
- \`type\`: "function"
- \`name\`: string (optional label)
- \`func\`: string — JavaScript function body (msg is the input, must return msg)
- \`outputs\`: number — number of output ports (default 1)
- \`wires\`: array with \`outputs\` sub-arrays

---

### http in
Receives HTTP requests as flow messages. Entry point for webhook flows.
- \`type\`: "http in"
- \`name\`: string (optional)
- \`url\`: string — URL path (e.g. "/webhook")
- \`method\`: string — HTTP method: "get", "post", "put", "delete", "patch"
- \`wires\`: one output port

---

### http response
Sends an HTTP response back to the caller. Terminal node for webhook flows.
- \`type\`: "http response"
- \`name\`: string (optional)
- \`statusCode\`: string (optional, default "200")
- \`headers\`: object (optional) — response headers
- \`wires\`: \`[]\`

---

### http request
Makes outbound HTTP requests to external APIs.
- \`type\`: "http request"
- \`name\`: string (optional)
- \`method\`: string — "GET", "POST", "PUT", "DELETE", "PATCH"
- \`ret\`: string — response type: "txt" (text), "bin" (binary), "obj" (parsed JSON)
- \`url\`: string — target URL
- \`wires\`: one output port

---

### change
Modifies, sets, or deletes message properties without code.
- \`type\`: "change"
- \`name\`: string (optional)
- \`rules\`: array of rule objects:
  - \`{ t: "set", p: "payload", pt: "msg", to: "value", tot: "str" }\`
  - \`{ t: "delete", p: "payload", pt: "msg" }\`
  - \`{ t: "move", p: "payload", pt: "msg", to: "data", tot: "msg" }\`
- \`wires\`: one output port

---

### switch
Routes messages to different outputs based on property values.
- \`type\`: "switch"
- \`name\`: string (optional)
- \`property\`: string — message property to test (e.g. "payload")
- \`propertyType\`: string — "msg", "flow", "global", "str", "num"
- \`rules\`: array — e.g. \`{ t: "eq", v: "value", vt: "str" }\`, \`{ t: "gt", v: "0", vt: "num" }\`, \`{ t: "else" }\`
- \`checkall\`: string — "true" to check all rules, "false" to stop at first match
- \`outputs\`: number — must equal the number of rules
- \`wires\`: array with \`outputs\` sub-arrays (one per rule)

---

### template
Generates output string using Mustache templating.
- \`type\`: "template"
- \`name\`: string (optional)
- \`field\`: string — output message property (default "payload")
- \`format\`: string — "handlebars" (Mustache)
- \`syntax\`: string — "mustache" or "plain"
- \`template\`: string — the template text, e.g. \`"Hello {{payload.name}}"\`
- \`wires\`: one output port

---

### join
Joins sequences of messages into a single message.
- \`type\`: "join"
- \`name\`: string (optional)
- \`mode\`: string — "auto", "custom", "reduce"
- \`build\`: string — output type for custom mode: "string", "array", "object"
- \`property\`: string — property to accumulate (default "payload")
- \`count\`: string — number of messages to join (e.g. "2" for two parallel branches)
- \`joiner\`: string — separator for string mode
- \`wires\`: one output port
`.trim();

export const GENERATION_RULES = `
## Flow Generation Rules

### ID Generation

- Every node \`id\` MUST be a 16-character lowercase hexadecimal string
- Example valid IDs: \`"a3f9c1e2b4d07865"\`, \`"1f2e3d4c5b6a7089"\`
- All IDs within a flow array MUST be unique — no two nodes may share an ID
- NEVER reuse IDs from the examples in this prompt — always generate fresh random hex strings for every flow
- The tab node's \`id\` is also used as the \`z\` value for every other node in the flow

### Coordinate Convention

Coordinates place nodes visually on the Node-RED canvas. Follow these rules:

- **Tab node**: no coordinates (omit \`x\` and \`y\`)
- **Sequential nodes** (main pipeline): \`x = 200 * position\` where position is 1-indexed from the left
  - First node: \`x = 200\`
  - Second node: \`x = 400\`
  - Third node: \`x = 600\`
- **Parallel branches**: \`y = 100 * branch_index\` where branch_index is 1-indexed from the top
  - Main branch: \`y = 100\`
  - Second parallel branch: \`y = 200\`
  - Third parallel branch: \`y = 300\`
- **All nodes** in a single linear flow sit on \`y = 100\`

### Coordinate Example

For a linear 3-node flow (http in → function → http response):
\`\`\`
http in:        x=200, y=100
function:       x=400, y=100
http response:  x=600, y=100
\`\`\`

For a switch with two branches (switch at x=400, then two parallel next nodes):
\`\`\`
switch:         x=400, y=100
branch A node:  x=600, y=100
branch B node:  x=600, y=200
\`\`\`
`.trim();

export const WEBHOOK_FLOW_EXAMPLE = `
## Complete Webhook Flow Example

Below is a complete, deployable Node-RED flow array for a simple POST webhook that echoes the request body back as JSON. Use this as a structural reference when generating webhook flows.

\`\`\`json
[
  {
    "id": "a1b2c3d4e5f60789",
    "type": "tab",
    "label": "Echo Webhook",
    "disabled": false,
    "info": "Receives POST /webhook and returns the body as JSON"
  },
  {
    "id": "f9e8d7c6b5a40321",
    "type": "http in",
    "z": "a1b2c3d4e5f60789",
    "name": "POST /webhook",
    "url": "/webhook",
    "method": "post",
    "x": 200,
    "y": 100,
    "wires": [["1a2b3c4d5e6f0789"]]
  },
  {
    "id": "1a2b3c4d5e6f0789",
    "type": "function",
    "z": "a1b2c3d4e5f60789",
    "name": "Build response",
    "func": "msg.payload = { received: msg.payload, timestamp: Date.now() };\\nreturn msg;",
    "outputs": 1,
    "x": 400,
    "y": 100,
    "wires": [["9f8e7d6c5b4a3210"]]
  },
  {
    "id": "9f8e7d6c5b4a3210",
    "type": "http response",
    "z": "a1b2c3d4e5f60789",
    "name": "Send response",
    "statusCode": "200",
    "headers": { "content-type": "application/json" },
    "x": 600,
    "y": 100,
    "wires": []
  }
]
\`\`\`

**Structural checklist for this example:**
- Tab node \`a1b2c3d4e5f60789\` has no \`z\` field and no \`wires\` field
- All other nodes carry \`"z": "a1b2c3d4e5f60789"\` matching the tab ID
- IDs are 16 lowercase hex characters
- Coordinates follow the 200×position convention on y=100
- The http response node has \`"wires": []\` (terminal node)
- The function node \`func\` contains only transformation logic — no require(), no process, no filesystem access
`.trim();

export const PREVIEW_RULE = `
## Flow Preview and Confirmation Rule

**MANDATORY**: Before calling \`nodered.flow.create\` or \`nodered.flow.update\`, you MUST present a plain-text preview of the flow to the user and explicitly wait for their confirmation.

### Preview Format

The preview MUST include all three sections:

1. **Flow name and pattern type**
   State the flow label and classify the pattern (e.g. "HTTP webhook", "Scheduled cron job", "HTTP request pipeline").
   Example: _Flow name: "Weather Checker" — Pattern: Scheduled cron job_

2. **Ordered node list with key settings**
   List each node in execution order with its type and the most important configuration value.
   Format: \`[type] name — key setting\`
   Example:
   \`\`\`
   [inject]        Every 60s — triggers automatically
   [http request]  GET https://api.weather.com/v1/current
   [function]      Extract temperature — reads msg.payload.temp
   [debug]         Log result
   \`\`\`

3. **Connection description as arrow chain**
   Describe the data flow as a left-to-right arrow chain.
   Example: _inject → http request → function → debug_

### Confirmation Step

End the preview with the exact phrase:
> "Awaiting your confirmation to create this flow."

Do NOT call \`nodered.flow.create\` or \`nodered.flow.update\` until the user responds with an explicit affirmative (e.g. "yes", "go ahead", "create it", "looks good").

If the user declines (e.g. "no", "cancel"), do NOT deploy. Offer to modify the flow instead.

If the user requests changes after the preview, update the plan and show a revised preview before proceeding.
`.trim();

export const RETRY_RULE = `
## Flow Tool Error Retry Rule

When \`nodered.flow.create\` or \`nodered.flow.update\` returns an error, follow this exact procedure:

### Retry Procedure

**Attempt 1 (automatic retry):**
1. Read the full error message returned by the tool
2. Identify which node or field caused the error (check node IDs, types, wires format, missing required fields)
3. Correct only the identified problem in the flow JSON — do not restructure the whole flow
4. Call the tool again with the corrected flow

**Attempt 2 (final retry):**
1. If attempt 1 also fails, read the new error message
2. Identify if it is a different error or the same error persisting
3. Apply the minimal correction
4. Call the tool one final time

**After 2 failures:**
- Do NOT attempt a third tool call
- Report the failure to the user with:
  - The specific error message from the last attempt
  - Which node or field appears to be the source of the problem
  - A suggestion for how the user could proceed

### Common Error Patterns to Check

| Error pattern | Likely cause | Fix |
|---------------|-------------|-----|
| "Invalid node type" | Type name misspelled or not built-in | Check against the Node Catalogue |
| "Duplicate node ID" | Two nodes share the same \`id\` | Regenerate all IDs to be unique |
| "Missing required field" | \`id\`, \`type\`, \`z\`, \`x\`, \`y\`, or \`wires\` omitted | Add the missing field |
| "Invalid wires format" | \`wires\` is not an array of arrays | Wrap wire targets: \`[["node-id"]]\` |
| "Node z references unknown tab" | \`z\` value does not match any tab \`id\` | Ensure all nodes reference the correct tab ID |
`.trim();

export const METADATA_RULES = `
## Flow Metadata Rules

When calling \`nodered.flow.create\` or \`nodered.flow.update\`, always include a \`metadata\` object alongside the flow nodes. The metadata is NOT part of the Node-RED flow JSON array — it is a separate parameter passed to the tool.

### Rules

| Condition | \`mcp\` value | \`creator\` value |
|-----------|------------|----------------|
| Flow contains one or more \`http in\` nodes | \`true\` | \`"bot"\` |
| Flow is cron/inject-only (no \`http in\` nodes) | \`false\` | \`"bot"\` |
| Any other flow (debug-only, etc.) | \`false\` | \`"bot"\` |

- \`creator: "bot"\` MUST always be set — it identifies flows created by the AI assistant
- \`mcp: true\` registers the flow's HTTP endpoint(s) with the MCP bridge, making them callable as tools
- \`mcp: false\` (or omitting \`mcp\`) means the flow will NOT be exposed as an MCP tool

### Examples

HTTP webhook flow (has \`http in\` node):
\`\`\`json
{
  "metadata": { "mcp": true, "creator": "bot" },
  "nodes": [ ... ]
}
\`\`\`

Cron/scheduled flow (inject only, no \`http in\`):
\`\`\`json
{
  "metadata": { "mcp": false, "creator": "bot" },
  "nodes": [ ... ]
}
\`\`\`
`.trim();

export const SECURITY_RULE = `
## Function Node Security Rules

Code written inside \`function\` node \`func\` fields MUST comply with all of the following rules.

### Forbidden APIs and Patterns

NEVER use any of the following in a function node:

| Forbidden | Reason |
|-----------|--------|
| \`require(...)\` | Arbitrary module loading; disabled by Node-RED sandbox |
| \`process.env\` | Environment variable leakage |
| \`process.exit\` | Could terminate the Node-RED process |
| \`process\` (any property) | Access to Node.js internals |
| \`__dirname\` / \`__filename\` | Filesystem path disclosure |
| \`fs.\` (any fs module usage) | Filesystem read/write access |
| \`child_process\` | Shell command execution |
| \`eval(...)\` | Dynamic code execution |
| Network calls (\`fetch\`, \`http\`, \`https\`) | Use an \`http request\` node instead |

### Allowed Patterns

Function node code SHOULD only:
- Read and transform \`msg.payload\` and other message properties
- Use built-in JavaScript (Math, JSON, Date, String, Array, Object methods)
- Set \`msg.statusCode\`, \`msg.headers\`, or other standard Node-RED message properties
- Return \`msg\` or \`null\` (to stop the message)
- Use \`node.warn()\` or \`node.error()\` for diagnostics

### Minimal Logic Principle

Keep function node code as minimal as possible. If a transformation can be done with a \`change\` node or \`template\` node, prefer those over a \`function\` node.
`.trim();

export const CRON_FLOW_EXAMPLE = `
## Complete Cron Flow Example

Below is a complete, deployable Node-RED flow array for a periodic job that fetches data from an API every 10 minutes and logs the result. Use this as a structural reference when generating scheduled/cron flows.

\`\`\`json
[
  {
    "id": "b2c3d4e5f6a70891",
    "type": "tab",
    "label": "BTC Price Checker",
    "disabled": false,
    "info": "Fetches BTC price every 10 minutes and logs it"
  },
  {
    "id": "c3d4e5f6a7b80912",
    "type": "inject",
    "z": "b2c3d4e5f6a70891",
    "name": "Every 10 minutes",
    "repeat": "600",
    "crontab": "",
    "once": false,
    "onceDelay": 0,
    "props": [{ "p": "payload" }],
    "x": 200,
    "y": 100,
    "wires": [["d4e5f6a7b8c90123"]]
  },
  {
    "id": "d4e5f6a7b8c90123",
    "type": "http request",
    "z": "b2c3d4e5f6a70891",
    "name": "Fetch BTC price",
    "method": "GET",
    "ret": "obj",
    "url": "https://api.coindesk.com/v1/bpi/currentprice/BTC.json",
    "x": 400,
    "y": 100,
    "wires": [["e5f6a7b8c9d01234"]]
  },
  {
    "id": "e5f6a7b8c9d01234",
    "type": "function",
    "z": "b2c3d4e5f6a70891",
    "name": "Extract price",
    "func": "msg.payload = { price: msg.payload.bpi.USD.rate, timestamp: Date.now() };\\nreturn msg;",
    "outputs": 1,
    "x": 600,
    "y": 100,
    "wires": [["f6a7b8c9d0e12345"]]
  },
  {
    "id": "f6a7b8c9d0e12345",
    "type": "debug",
    "z": "b2c3d4e5f6a70891",
    "name": "Log price",
    "active": true,
    "tosidebar": true,
    "complete": "false",
    "x": 800,
    "y": 100,
    "wires": []
  }
]
\`\`\`

**Structural checklist for this example:**
- Tab node \`b2c3d4e5f6a70891\` has no \`z\` field and no \`wires\` field
- All other nodes carry \`"z": "b2c3d4e5f6a70891"\` matching the tab ID
- The inject node uses \`"repeat": "600"\` (seconds as string) for the 10-minute interval
- The http request node uses \`"ret": "obj"\` to auto-parse JSON responses
- The debug node has \`"wires": []\` (terminal node)
- Coordinates follow the 200×position convention on y=100
- No \`http in\` node — this is a cron-triggered flow, so metadata should use \`mcp: false\`
`.trim();

export const NOTIFICATION_CALLBACK_PATTERN = `
## Notification Callback Pattern (Threshold-Based)

When a cron flow needs to notify the user based on a condition (e.g. "notify me if price exceeds X"), add a conditional branch after the processing function node using a \`switch\` node and an \`http request\` node that calls back to slashbot.

### Pattern: inject → http request → function → switch → http request (callback)

The switch node evaluates the condition. If the condition is met, the message is routed to an \`http request\` node that sends a POST to slashbot's HTTP endpoint to trigger a push notification.

### Callback Flow Structure

After the function node that extracts/transforms data, add:

1. **switch node**: Tests a message property against a threshold
   - \`property\`: "payload.value" (or the relevant extracted field)
   - \`rules\`: \`[{ "t": "gt", "v": "<threshold>", "vt": "num" }, { "t": "else" }]\`
   - \`outputs\`: 2

2. **http request node** (on the "condition met" output): Sends a POST callback
   - \`method\`: "POST"
   - \`url\`: Ask the user for their notification endpoint URL before inserting it — use a placeholder \`<SLASHBOT_NOTIFY_URL>\` in the preview, then replace with the actual URL after the user confirms
   - \`ret\`: "txt"

3. **debug node** (on the "else" output): Logs that the condition was not met

### Example Addition (append to cron flow after the function node)

\`\`\`json
{
  "id": "a1b2c3d4e5f67890",
  "type": "switch",
  "z": "<tab-id>",
  "name": "Price threshold",
  "property": "payload.price",
  "propertyType": "msg",
  "rules": [
    { "t": "gt", "v": "100000", "vt": "num" },
    { "t": "else" }
  ],
  "checkall": "false",
  "outputs": 2,
  "x": 800,
  "y": 100,
  "wires": [["<callback-node-id>"], ["<debug-node-id>"]]
}
\`\`\`

\`\`\`json
{
  "id": "<callback-node-id>",
  "type": "http request",
  "z": "<tab-id>",
  "name": "Notify slashbot",
  "method": "POST",
  "ret": "txt",
  "url": "<SLASHBOT_NOTIFY_URL>",
  "x": 1000,
  "y": 100,
  "wires": [[]]
}
\`\`\`

\`\`\`json
{
  "id": "<debug-node-id>",
  "type": "debug",
  "z": "<tab-id>",
  "name": "Below threshold",
  "active": true,
  "x": 1000,
  "y": 200,
  "wires": []
}
\`\`\`

**Key points:**
- The switch node splits into two branches: condition met (y=100) and else (y=200)
- The callback http request node sends data to slashbot for push notification delivery
- **IMPORTANT**: Always ask the user for their notification endpoint URL before generating this pattern — slashbot exposes no built-in \`/api/notify\` endpoint; use \`<SLASHBOT_NOTIFY_URL>\` as a placeholder in the preview, then substitute the real URL after the user provides it
- The function node before the switch should set the property the switch tests (e.g. \`msg.payload.price\`)
`.trim();

export const ETL_FLOW_EXAMPLE = `
## Complete ETL (Data Pipeline) Flow Example

Below is a complete, deployable Node-RED flow array for an HTTP-triggered data pipeline that fetches data from two external APIs in parallel, joins the results, formats the combined output, and returns it as an HTTP response. Use this as a structural reference when generating ETL or multi-source data pipeline flows.

\`\`\`json
[
  {
    "id": "c4d5e6f7a8b90123",
    "type": "tab",
    "label": "Multi-Source Data Pipeline",
    "disabled": false,
    "info": "Fetches from two APIs in parallel, merges results, returns combined data"
  },
  {
    "id": "d5e6f7a8b9c01234",
    "type": "http in",
    "z": "c4d5e6f7a8b90123",
    "name": "GET /merged-data",
    "url": "/merged-data",
    "method": "get",
    "x": 200,
    "y": 100,
    "wires": [["e6f7a8b9c0d12345", "f7a8b9c0d1e23456"]]
  },
  {
    "id": "e6f7a8b9c0d12345",
    "type": "http request",
    "z": "c4d5e6f7a8b90123",
    "name": "Fetch API A",
    "method": "GET",
    "ret": "obj",
    "url": "https://api.example.com/source-a",
    "x": 400,
    "y": 100,
    "wires": [["a8b9c0d1e2f34567"]]
  },
  {
    "id": "f7a8b9c0d1e23456",
    "type": "http request",
    "z": "c4d5e6f7a8b90123",
    "name": "Fetch API B",
    "method": "GET",
    "ret": "obj",
    "url": "https://api.example.com/source-b",
    "x": 400,
    "y": 200,
    "wires": [["a8b9c0d1e2f34567"]]
  },
  {
    "id": "a8b9c0d1e2f34567",
    "type": "join",
    "z": "c4d5e6f7a8b90123",
    "name": "Merge results",
    "mode": "custom",
    "build": "array",
    "property": "payload",
    "count": "2",
    "x": 600,
    "y": 100,
    "wires": [["b9c0d1e2f3a45678"]]
  },
  {
    "id": "b9c0d1e2f3a45678",
    "type": "function",
    "z": "c4d5e6f7a8b90123",
    "name": "Format combined data",
    "func": "msg.payload = { sourceA: msg.payload[0], sourceB: msg.payload[1], mergedAt: Date.now() };\\nreturn msg;",
    "outputs": 1,
    "x": 800,
    "y": 100,
    "wires": [["c0d1e2f3a4b56789"]]
  },
  {
    "id": "c0d1e2f3a4b56789",
    "type": "http response",
    "z": "c4d5e6f7a8b90123",
    "name": "Send merged response",
    "statusCode": "200",
    "headers": { "content-type": "application/json" },
    "x": 1000,
    "y": 100,
    "wires": []
  }
]
\`\`\`

**Structural checklist for this example:**
- Tab node \`c4d5e6f7a8b90123\` has no \`z\` field and no \`wires\` field
- All other nodes carry \`"z": "c4d5e6f7a8b90123"\` matching the tab ID
- The http in node's \`wires\` contains TWO target IDs in a single output port: \`[["id-A", "id-B"]]\` — this is how parallel branching works
- API A sits at y=100 (main branch), API B sits at y=200 (parallel branch)
- Both http request nodes wire into the SAME join node
- The join node uses \`"count": "2"\` to wait for exactly 2 messages before emitting
- The join node uses \`"build": "array"\` so the function node receives \`msg.payload\` as an array of two results
- The http response node has \`"wires": []\` (terminal node)
- This flow has an \`http in\` node, so metadata should use \`mcp: true\`

### Parallel Branching Wiring Convention

To fan out from one node to multiple parallel branches, list all downstream node IDs in the SAME output port array:
- \`"wires": [["branchA-id", "branchB-id"]]\` — sends the message to BOTH nodes simultaneously
- Do NOT create separate output ports for parallel branches (that is for switch/router nodes only)

To reconverge parallel branches, wire all branch outputs into a single \`join\` node:
- Set the join node's \`count\` to match the number of parallel branches (e.g. "2" for two branches)
- The join node collects one message from each branch and emits a single combined message
- Use \`"build": "array"\` to receive results as an ordered array, or \`"build": "object"\` with \`msg.topic\` keys
`.trim();

export const MODIFICATION_RULE = `
## Flow Modification Rule

When modifying an existing flow (via \`nodered.flow.update\`), follow this procedure to avoid accidentally overwriting nodes or breaking wiring.

### Procedure

1. **Retrieve current state**: Call \`nodered.flow.get\` with the flow ID to get the full current node array
2. **Identify changes**: Compare the user's requested modification against the existing nodes
3. **Merge, don't replace**: Apply changes to the existing node array:
   - To **add a node**: append the new node to the array and update upstream/downstream \`wires\` to include it
   - To **remove a node**: delete it from the array and rewire upstream nodes to skip it (connect to the removed node's downstream targets)
   - To **modify a node**: update only the changed properties on the existing node object — preserve all other fields
   - To **reorder nodes**: update \`wires\` and coordinates (\`x\`, \`y\`) but keep node \`id\` values stable
4. **Re-validate**: Ensure the modified array still meets all flow structure rules (unique IDs, valid wires, tab node present)
5. **Preview**: Show the updated flow preview (per the Flow Preview and Confirmation Rule) highlighting what changed
6. **Deploy**: Only after user confirmation, call \`nodered.flow.update\` with the merged node array

### Do NOT

- Replace the entire node array with a freshly generated one (this loses user customizations and manual edits)
- Change existing node IDs (this breaks external references and flow metadata)
- Remove nodes the user didn't ask to remove

### When to Use Full Replacement

Only replace the entire flow if:
- The user explicitly asks to "recreate" or "rebuild from scratch"
- The existing flow is so different from the target that merging would be more complex than regenerating
- In this case, inform the user that you are replacing the entire flow, not merging
`.trim();

export const NODE_TYPE_CHECK_RULE = `
## Node Type Validation Rule

**PRIORITY**: This rule takes precedence over the Clarification Rule. Check node types BEFORE asking clarifying questions.

When a user requests a flow that requires a node type NOT listed in the Node-RED Built-in Node Catalogue above, you MUST:

1. **Identify** the non-standard node type the user is requesting (e.g. MQTT, email, TCP, serial, MongoDB, etc.)
2. **Inform** the user that the requested node type is not available in the standard catalogue
3. **List** the 12 available standard node types as alternatives
4. **Suggest** how to achieve a similar result using only standard nodes (if possible)

### Response Format

> "The flow you've described requires a **{node_type}** node, which is not available in the standard Node-RED node catalogue. The available node types are:
>
> tab, comment, inject, debug, function, http in, http response, http request, change, switch, template, join
>
> {suggestion for alternative approach using standard nodes, or note that this use case cannot be achieved with standard nodes alone}"

### Do NOT
- Ask clarifying questions about a non-standard node type (e.g. "What MQTT broker should I connect to?") — this implies you can use that node
- Generate a flow containing non-standard node types
- Silently substitute a different node without informing the user
`.trim();

export const CLARIFICATION_RULE = `
## Flow Authoring Clarification Rule

Before generating any Node-RED flow, verify that the user's request clearly specifies all three required dimensions. If ANY dimension is missing or ambiguous, ask for clarification before generating.

### Required Dimensions

**Dimension 1 — Trigger type**: How does the flow start?
- HTTP request (webhook, REST endpoint)
- Cron schedule (e.g. "every hour", "at 9am daily")
- Manual injection (one-time on deploy)

**Dimension 2 — Primary action**: What does the flow DO?
- Call an external API
- Transform or filter data
- Send a notification or response
- Log or debug output

**Dimension 3 — Data sources and targets**: What data enters and where does it go?
- Input: request body, query params, scheduled payload, static values
- Output: HTTP response, external API endpoint, debug log

### Decision Logic

If ALL three dimensions are clear from the request: proceed directly to the preview step (see the Flow Preview and Confirmation Rule).

If ONE OR MORE dimensions are missing: ask only about the missing dimensions in a single message. Do NOT generate a flow until all three are confirmed.

### Clarification Message Format

When clarification is needed, ask in this format:

> "Before I build this flow, I need a few details:
> - [question about missing dimension]"

Ask all missing questions in a **single message** — do not ask one at a time.

### Examples

**Clear request (no clarification needed):**
> "Create a webhook that receives POST /data and forwards the body to https://api.example.com/ingest"
- Trigger: HTTP POST ✓
- Action: forward to external API ✓
- Data: request body → external endpoint ✓
- Proceed to preview.

**Ambiguous request (clarification needed):**
> "Make a flow that processes data"
- Trigger: unknown ✗
- Action: "processes" is vague ✗
- Data: source and target unknown ✗
- Ask: "Before I build this flow, I need a few details:
  - What should trigger this flow — an HTTP request, a schedule, or manual injection?
  - What processing should it perform?
  - Where should the result go (an HTTP response, an external API, a debug log)?"
`.trim();

export const NODERED_PROMPT = [
  '## nodered -- Managed Node-RED Process',
  'Node-RED runs as a managed child process of slashbot.',
  '',
  '**Available commands:**',
  '- `/nodered start` — Start Node-RED',
  '- `/nodered stop` — Stop Node-RED',
  '- `/nodered restart` — Restart Node-RED',
  '- `/nodered status` — Check health and view recent logs',
  '- `/nodered config` — View or update configuration',
  '',
  '**Important:**',
  '- DO NOT use `bash` to start, stop, or manage Node-RED — use `/nodered` commands instead',
  '- DO NOT modify Node-RED `settings.js` directly — it is auto-generated on each start',
  '- Use `/nodered status` to check health and view recent logs',
  '- Node-RED Editor is accessible at `http://localhost:{port}/` (default port: 1880)',
  '',
  '## Node-RED Setup (when not installed)',
  'If Node-RED state is `setup-needed`, Node-RED is not yet installed.',
  'DO NOT attempt to install Node-RED manually via bash or npm commands.',
  'Instead, run the setup skill:',
  '- Use the skills tool: invoke skill `nodered-setup`',
  '- Or run the slash command: `/skill run nodered-setup`',
  'The skill will install Node-RED and configure it automatically.',
  'After the skill completes, Node-RED will transition to running state.',
  '',
  '## Flow Management Actions',
  'Use these action tags to manage Node-RED flows programmatically:',
  '',
  '**Create a flow** — deploy a new flow with nodes:',
  '```',
  '<nodered-flow-create>{"label":"My Flow","nodes":[{"id":"n1","type":"inject","wires":[["n2"]]},{"id":"n2","type":"debug"}]}</nodered-flow-create>',
  '```',
  '',
  '**List all flows:**',
  '```',
  '<nodered-flow-list />',
  '```',
  '',
  '**Delete a flow by ID:**',
  '```',
  '<nodered-flow-delete id="FLOW_ID" />',
  '```',
  '',
  '**Update an existing flow:**',
  '```',
  '<nodered-flow-update id="FLOW_ID">{"label":"Updated Label","nodes":[...]}</nodered-flow-update>',
  '```',
  '',
  '**Guidelines:**',
  '- Check Node-RED is running (`/nodered status`) before using flow actions',
  '- Use `<nodered-flow-list />` to discover flow IDs before delete/update',
  '- Flow JSON must include at least a `label` and `nodes` array for create',
  '- Use `/nodered flow list`, `/nodered flow info <id>`, `/nodered flow delete <id>` for direct commands',
  '- **CRITICAL: NEVER call nodered.flow.create or nodered.flow.update without first showing a preview and getting explicit user confirmation (see Flow Preview and Confirmation Rule below)**',
  '',
  FLOW_STRUCTURE_GUIDE,
  '',
  NODE_CATALOGUE,
  '',
  GENERATION_RULES,
  '',
  PREVIEW_RULE,
  '',
  WEBHOOK_FLOW_EXAMPLE,
  '',
  CRON_FLOW_EXAMPLE,
  '',
  NOTIFICATION_CALLBACK_PATTERN,
  '',
  ETL_FLOW_EXAMPLE,
  '',
  RETRY_RULE,
  '',
  METADATA_RULES,
  '',
  SECURITY_RULE,
  '',
  NODE_TYPE_CHECK_RULE,
  '',
  CLARIFICATION_RULE,
  '',
  MODIFICATION_RULE,
].join('\n');
