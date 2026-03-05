# Feature Specification: Node-RED UI Access

**Feature Branch**: `006-nodered-ui-access`
**Created**: 2026-03-04
**Status**: Draft
**Source**: [Feature 05](../../ideas/002-nodered-plugin/features/05-nodered-ui-access.md)
**Parent Idea**: [idea.md](../../ideas/002-nodered-plugin/idea.md)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access the Node-RED Editor (Priority: P1)

The administrator wants to open the Node-RED visual editor in a browser to view, create, and modify flows. They use a slash command to retrieve the editor URL and then log in with configured credentials.

**Why this priority**: This is the core value of the feature — without editor access, no other UI stories are possible.

**Independent Test**: Can be fully tested by running `/nodered ui`, opening the returned URL, and verifying the editor loads with authentication.

**Acceptance Scenarios**:

1. **Given** Node-RED is running, **When** the administrator types `/nodered ui`, **Then** the system displays the editor URL (e.g., "Node-RED Editor: http://localhost:1880")
2. **Given** the administrator opens the editor URL in a browser, **When** they enter valid credentials, **Then** the Node-RED editor loads showing all deployed flows
3. **Given** Node-RED is not running, **When** the administrator types `/nodered ui`, **Then** the system displays a message indicating Node-RED is not running and suggests starting it
4. **Given** the administrator opens the editor URL, **When** they enter invalid credentials, **Then** access is denied with an appropriate error message

---

### User Story 2 - Modify a Bot-Created Flow in the Editor (Priority: P2)

The administrator opens the visual editor, locates a flow previously created by the bot, makes modifications (e.g., adjusting parameters), and deploys the changes. The system detects the modification and updates the corresponding MCP tool.

**Why this priority**: Enables human oversight and fine-tuning of bot-created automations, which is the primary supervision use case.

**Independent Test**: Can be tested by modifying a bot-created flow in the editor, deploying it, and verifying the MCP Bridge reflects the update.

**Acceptance Scenarios**:

1. **Given** a flow "mcp-check-sol-price" was created by the bot, **When** the administrator opens the editor, **Then** the flow is visible and editable
2. **Given** the administrator modifies a flow and clicks Deploy in the editor, **When** the deployment completes, **Then** the system detects the change within 30 seconds
3. **Given** a flow change is detected, **When** the flow follows MCP naming conventions, **Then** the MCP Bridge updates the corresponding tool definition

---

### User Story 3 - Create a Complex Flow in the Editor (Priority: P3)

The administrator designs a complex flow in the visual editor (multi-branch, error handling, sub-flows) that would be difficult for the bot to generate. By following the MCP naming convention, the flow is automatically exposed as a bot tool.

**Why this priority**: Extends bot capabilities beyond what AI generation can produce, but requires the administrator to have Node-RED expertise.

**Independent Test**: Can be tested by creating a new flow named "mcp-complex-pipeline" in the editor, deploying it, and verifying it appears as an MCP tool.

**Acceptance Scenarios**:

1. **Given** the administrator creates a new flow named with the "mcp-" prefix in the editor, **When** they deploy it, **Then** the MCP Bridge detects and exposes it as a new tool
2. **Given** the administrator creates a flow without the "mcp-" prefix, **When** they deploy it, **Then** the flow runs normally but is not exposed as an MCP tool

---

### Edge Cases

- What happens when the administrator and the bot modify the same flow simultaneously? (Last-write-wins per Node-RED default behavior)
- What happens when the administrator deletes a flow that the bot relies on? (MCP tool is unregistered, bot notified)
- What happens when Node-RED restarts while the administrator is editing? (Editor session lost, unsaved changes discarded)
- What happens when the configured port is already in use? (Node-RED fails to start, error reported to user)
- What happens when the user tries to access the editor before configuring credentials? (Editor is disabled; `/nodered ui` prompts user to configure credentials via `/nodered config`)

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Node-RED is not running when `/nodered ui` is invoked | "Node-RED is not running. Use `/nodered start` to start it." | User starts Node-RED first |
| Configured port is occupied by another process | "Node-RED editor port [PORT] is in use. Check your configuration or free the port." | User changes port in config or stops conflicting process |
| Authentication credentials not configured | "Editor authentication is not configured. Use `/nodered config editor.username <user>` and `/nodered config editor.password <pass>` to set credentials." | User configures credentials via `/nodered config` |
| Flow change detection fails (API unreachable) | "Unable to sync flow changes from the editor. Will retry automatically." | System retries polling; user can trigger manual sync |
| Administrator deletes a flow used by the bot | "Flow [NAME] was removed from the editor. The corresponding MCP tool has been unregistered." | Bot adapts; admin can recreate if needed |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST serve the Node-RED visual editor on a configurable port and bind address, configurable via the Node-RED configuration file (`~/.slashbot/nodered.json`)
- **FR-002**: The system MUST protect editor access with username/password authentication
- **FR-003**: The system MUST provide a `/nodered ui` command that displays the editor URL when Node-RED is running
- **FR-004**: The system MUST bind the editor to `127.0.0.1` by default (local access only)
- **FR-005**: The system MUST detect flow changes made through the editor within 30 seconds of deployment
- **FR-006**: The system MUST notify the MCP Bridge when flows are created, modified, or deleted through the editor
- **FR-007**: The system MUST display all flows in the editor, including those created by the bot
- **FR-008**: The system MUST allow credential configuration via `/nodered config editor.username <user>` and `/nodered config editor.password <pass>`; the password MUST be bcrypt-hashed (cost factor 10, via `Bun.password.hash()`) before storage — plaintext is never persisted
- **FR-009**: When a flow following MCP naming conventions is created or modified in the editor, the system MUST update the corresponding MCP tool registration
- **FR-010**: The system MUST disable the editor (httpAdminRoot: false) when credentials are not yet configured; `/nodered ui` MUST inform the user to configure credentials first
- **FR-011**: The flow change poller MUST use a revision hash of the flows state to avoid re-processing changes already handled by bot-initiated CRUD operations
- **FR-012**: The system MUST include the editor URL in the context provider output when Node-RED is running and credentials are configured

### Key Entities

- **Editor Configuration**: Port, bind address, authentication credentials — persisted in the Node-RED settings
- **Flow Change Event**: A detected modification to flows made through the editor — includes flow ID, change type (created/modified/deleted), and timestamp
- **Editor Session**: An authenticated administrator session in the Node-RED editor

## Accessibility Requirements *(mandatory for UI features)*

| Requirement | Applies? | Acceptance Criteria |
|-------------|----------|---------------------|
| Keyboard navigation | N/A | Node-RED editor is a third-party UI; accessibility is managed upstream |
| Screen reader support | N/A | Same as above |
| Color contrast | N/A | Same as above |
| Focus indicators | N/A | Same as above |
| Reduced motion | N/A | Same as above |
| Touch targets | N/A | Same as above |

**Additional accessibility notes**: The Node-RED editor is a mature third-party application. Accessibility is managed by the Node-RED project. This feature only controls access to the editor, not the editor itself.

## Performance Requirements *(include if performance-sensitive)*

| Metric | Target | Justification |
|--------|--------|---------------|
| Flow change detection latency | < 30 seconds | Ensures timely sync between editor changes and MCP tool updates |
| `/nodered ui` command response | < 1 second | Simple status check should be near-instant |
| Editor page load | Managed by Node-RED | Third-party UI; not under our control |

**Performance notes**: The 30s detection target allows for up to two 15s poll cycles (worst case: change occurs immediately after a poll). For instances with > 100 flows, polling overhead is bounded by the HTTP round-trip to localhost; no additional throttling is required for MVP. Rapid successive deploys are naturally debounced by the fixed poll interval.

## Security Considerations *(mandatory — handles auth and external input)*

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Unauthorized editor access | Username/password authentication via Node-RED adminAuth | Credentials configured during setup |
| Password storage | bcrypt-hashed passwords | Hash generated at first configuration; plaintext never stored |
| Network exposure | Bind to 127.0.0.1 by default | Remote access (HTTPS, reverse proxy) is user's responsibility |
| Credential brute-force | Node-RED built-in rate limiting on login | Rely on Node-RED's default behavior |
| Concurrent edit conflicts | Last-write-wins (Node-RED default behavior) | Document this limitation; no custom conflict resolution for MVP |
| Input validation at command boundary | Validate `/nodered config` inputs before storage | `editor.username` must be non-empty alphanumeric; `editor.password` is accepted as raw string and bcrypt-hashed by the system |
| Invalid credentials at startup | Editor disabled with logged warning; plugin continues | If `editorPasswordHash` is malformed or partially configured, disable editor gracefully instead of crashing |
| LLM context contamination | Exclude sensitive fields from conversation context | Context provider MUST NOT include `editorPasswordHash` or `editorUsername` in conversation context sent to the LLM; only the derived editor URL is exposed |

## Data & State *(mandatory — involves persistence)*

- **Data ownership**: Administrator owns editor credentials; system owns flow change detection state
- **Access control**: Only authenticated administrators can access the editor
- **Retention policy**: Credentials persist until explicitly changed; flow change state is ephemeral (in-memory)
- **Concurrent modification**: Last-write-wins for flows modified simultaneously by bot and human (Node-RED default)
- **Sync behavior**: Polling-based detection with eventual consistency (< 30 second window); revision hash comparison prevents duplicate processing of bot-initiated changes
- **Schema migration**: Adding `editorUsername` and `editorPasswordHash` to `nodered.json` is backward-compatible — both fields are optional and default to undefined; existing configs require no migration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The administrator can access the Node-RED editor via the URL displayed by `/nodered ui` and authenticate successfully
- **SC-002**: Flows created or modified in the editor are detected by the system within 30 seconds of deployment
- **SC-003**: Flows following MCP naming conventions created in the editor are automatically available as bot tools without restart
- **SC-004**: The editor is only accessible from localhost by default (no external network exposure)
- **SC-005**: All bot-created flows are visible and editable in the Node-RED editor

---

## Clarifications

### Session 2026-03-04

- Q: How should editor credentials be configured? → A: Extend `/nodered config` with `editor.username` and `editor.password` keys; password is bcrypt-hashed before storage.
- Q: How should polling avoid double-processing bot-initiated flow changes? → A: Revision hash comparison — store hash of last known flows state after any change; poller only emits events when hash differs.
- Q: What happens if `/nodered ui` is used before credentials are configured? → A: Editor is disabled (httpAdminRoot: false in settings.js); `/nodered ui` instructs user to configure credentials first.
- Q: Should editor URL appear in TUI sidebar? → A: Yes, display editor URL in TUI sidebar when Node-RED is running and credentials are configured.

---

## Technical Hints (For Planning)

> This section preserves technical guidance from the source idea.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Source
- **Idea**: [ideas/002-nodered-plugin/idea.md](../../ideas/002-nodered-plugin/idea.md)
- **Feature**: [ideas/002-nodered-plugin/features/05-nodered-ui-access.md](../../ideas/002-nodered-plugin/features/05-nodered-ui-access.md)

### Technical Constraints
- Node-RED runs as a Node.js child process, not in the Bun runtime
- The editor and Admin API share the same port (1880 by default)
- Node-RED stores flows in `~/.slashbot/nodered/flows.json`
- Configuration lives in `~/.slashbot/config/nodered.json` and `~/.slashbot/nodered/settings.js`

### Implementation Guidance
1. Enable the editor via `httpAdminRoot: '/'` in settings.js
2. Configure `adminAuth` in settings.js with bcrypt-hashed credentials:
   ```js
   adminAuth: {
     type: "credentials",
     users: [{ username: "admin", password: bcryptHash, permissions: "*" }]
   }
   ```
3. For flow change detection, use polling approach (MVP): periodically `GET /flows` and compare with last known state
4. Bind address should default to `127.0.0.1` (local-only security)
5. Add editor URL to TUI sidebar when Node-RED is running

### Discovery Decisions
- Polling recommended over Node-RED runtime events for MVP (simpler, works with standard API)
- No custom UI — use the native Node-RED editor as-is
- No remote access features (HTTPS, reverse proxy, tunneling) — user's responsibility
- No multi-user permissions — single admin account for MVP
