# Feature Specification: Node-RED Setup Skill

**Feature Branch**: `003-nodered-setup-skill`
**Created**: 2026-02-18
**Status**: Draft
**Input**: Developer feedback - extract Node-RED installation and lifecycle management from the plugin into a skill

## Clarifications

### Session 2026-02-18

- Q: How should the plugin trigger autonomous Node-RED setup without modifying bot internals? → A: Context provider (enrich existing `nodered.context` to instruct the bot) + one-shot automation job (via automation plugin's `once` trigger) for immediate autonomous execution.
- Q: How does the system track the Node-RED process for stop/restart after removing spawn logic from the plugin? → A: PID file at `~/.slashbot/nodered/nodered.pid` — skill writes it on start, reads it on stop/restart.
- Q: Should package manager availability be enforced in skill frontmatter or handled at runtime? → A: Frontmatter declares only `requires.bins: [node]`. Skill instructions detect npm/bun at runtime and install one if neither is present (npm typically ships with Node.js; fallback: install bun via curl).
- Q: When should settings.js be generated relative to skill invocation? → A: Eagerly during plugin `setup()` phase — file is always ready in `~/.slashbot/nodered/settings.js` before any skill invocation.
- Q: How should crash recovery trigger the restart skill? → A: Same dual pattern as initial setup — one-shot automation job for immediate autonomous restart + context provider as fallback.

### Session 2026-02-19

- Q: Where should the bundled skill file be located — `skills/` at repo root (current loader path) or `src/plugins/skills/bundled/` (spec path)? → A: Place at `src/plugins/skills/bundled/nodered-setup/SKILL.md` and update the skill loader to resolve bundled skills from `src/plugins/skills/bundled/` instead of `<repo-root>/skills/`.
- Q: Should `setup-needed` be a formal 7th value in the `NodeRedState` union type, or a transient sub-case of `unavailable` signaled only via events? → A: Add `setup-needed` as a 7th value in the `NodeRedState` union type.
- Q: How should the plugin handle the automation plugin being absent (soft dependency)? → A: Silent graceful degradation — null-guard `getService('automation.service')`, rely on context provider alone as fallback. No warning, no hard dependency.

## Context

The current nodered plugin (feature 001) embeds `npm install node-red` and process lifecycle management (spawn, health check, restart) directly in plugin code. This creates a hard dependency on npm being installed on the user's machine and couples installation concerns with flow management.

This feature extracts installation and lifecycle management into a **bundled skill** — a markdown-driven instruction set that the bot (LLM) executes autonomously via shell commands. The plugin retains only flow management and Node-RED availability detection (heartbeat).

### Relationship with Existing Features

- **Feature 001 (nodered-lifecycle)**: Will be updated to REMOVE install logic and process management from plugin code. Plugin becomes a thin availability detector + event emitter.
- **Feature 002 (flow-management)**: Unchanged — still depends on `nodered:ready` event.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bot Detects Missing Node-RED and Sets It Up (Priority: P1)

When slashbot starts and the nodered plugin detects that Node-RED is not available (no heartbeat response, no installation in `~/.slashbot/nodered/`), I want the bot to autonomously invoke the nodered-setup skill to install and start Node-RED, so that Node-RED features become available without manual intervention.

**Why this priority**: This is the core value proposition — the bot handles setup autonomously instead of requiring npm on the user's machine.

**Independent Test**: Can be fully tested by starting slashbot with no Node-RED installed and verifying the bot invokes the skill, installs Node-RED, and starts it.

**Acceptance Scenarios**:

1. **Given** slashbot starts and Node-RED is not installed in `~/.slashbot/nodered/`, **When** the nodered plugin performs its availability check, **Then** the plugin detects Node-RED is unavailable and signals that setup is needed.
2. **Given** the plugin signals that Node-RED setup is needed, **When** the bot processes this signal, **Then** the bot invokes the `nodered-setup` skill autonomously.
3. **Given** the skill is invoked, **When** the bot follows the skill instructions, **Then** Node-RED is installed in `~/.slashbot/nodered/` and started on the configured port.
4. **Given** Node-RED has been installed and started by the skill, **When** the plugin's heartbeat detects Node-RED responding, **Then** the plugin emits `nodered:ready` and updates the sidebar to "NR: Running".

---

### User Story 2 - Bot Manages Node-RED Lifecycle via Skill (Priority: P1)

When Node-RED needs to be started, stopped, or restarted, I want the bot to use the nodered-setup skill to execute these operations, so that process management is handled through skill instructions rather than hard-coded plugin logic.

**Why this priority**: Lifecycle management is essential for daily operations and crash recovery.

**Independent Test**: Can be fully tested by asking the bot to start/stop/restart Node-RED and verifying it follows the skill instructions.

**Acceptance Scenarios**:

1. **Given** Node-RED is installed but not running, **When** the user or system requests a start, **Then** the bot invokes the skill with a "start" task and Node-RED becomes available.
2. **Given** Node-RED is running, **When** the user requests a stop, **Then** the bot invokes the skill with a "stop" task and Node-RED is gracefully shut down.
3. **Given** Node-RED is running, **When** the user requests a restart, **Then** the bot invokes the skill with a "restart" task (stop then start).
4. **Given** the plugin's heartbeat detects Node-RED has crashed (was running, now unresponsive), **When** the crash is detected, **Then** the bot autonomously invokes the skill to restart Node-RED (up to 3 retries with exponential backoff).

---

### User Story 3 - Plugin Detects Node-RED Availability via Heartbeat (Priority: P1)

As a plugin component, I want to continuously monitor Node-RED availability via HTTP heartbeat, so that the system knows the current state of Node-RED and can react to changes.

**Why this priority**: The heartbeat is the bridge between the plugin (state awareness) and the skill (action execution). Without it, neither detection nor recovery works.

**Independent Test**: Can be fully tested by starting/stopping Node-RED externally and verifying the plugin detects the state changes.

**Acceptance Scenarios**:

1. **Given** the plugin is initialized, **When** it starts its heartbeat loop, **Then** it periodically sends HTTP GET requests to `http://localhost:{port}/` at the configured interval (default: 30 seconds).
2. **Given** Node-RED is running, **When** a heartbeat receives a 200 response, **Then** the plugin considers Node-RED available and displays "NR: Running" in the sidebar.
3. **Given** Node-RED was running, **When** a heartbeat fails (connection refused, timeout, non-200), **Then** the plugin transitions to an unavailable state, emits `nodered:error`, and triggers the bot to invoke the skill for recovery.
4. **Given** Node-RED was not detected at startup, **When** the heartbeat detects Node-RED becomes available (e.g., manually started or skill completed), **Then** the plugin emits `nodered:ready`.

---

### User Story 4 - Skill Provides Installation Instructions for the Bot (Priority: P2)

As a skill, I want to provide clear, step-by-step instructions that the bot can follow to install Node-RED, so that the installation process is reliable and platform-aware.

**Why this priority**: Good skill instructions ensure reliable autonomous operation across different environments.

**Independent Test**: Can be tested by having the bot execute the skill on a clean system and verifying Node-RED is installed correctly.

**Acceptance Scenarios**:

1. **Given** the skill is invoked for installation, **When** the bot reads the skill instructions, **Then** it finds clear steps for: checking prerequisites (Node.js), installing Node-RED via npm/npx/bun, and verifying the installation.
2. **Given** Node.js is not installed on the machine, **When** the bot follows the skill instructions, **Then** it reports that Node.js is required and provides installation guidance for the user's platform.
3. **Given** npm is not available but bun is, **When** the bot follows the skill instructions, **Then** it uses `bun install` as an alternative package manager.
4. **Given** the installation succeeds, **When** the bot verifies the installation, **Then** it confirms Node-RED is present in `~/.slashbot/nodered/node_modules/node-red/`.

---

### Edge Cases

- What happens when neither npm nor bun is available? The skill instructs the bot to report the issue to the user with platform-specific installation guidance for a package manager.
- What happens when the network is unavailable during installation? The bot reports the network failure and suggests retrying when connectivity is restored.
- What happens when disk space is insufficient? The installation command fails; the bot reports the error and suggests freeing disk space.
- What happens when Node-RED is partially installed (corrupted node_modules)? The skill includes a cleanup step (remove and reinstall) for this scenario.
- What happens when the plugin heartbeat detects Node-RED but it was started externally (not by the skill)? The plugin adopts the existing instance — same behavior as current spec (FR-018 from feature 001).
- What happens when the bot cannot execute shell commands (restricted environment)? The skill instructions fall back to providing manual steps for the user.

### Error Scenarios *(mandatory per constitution)*

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Node.js not found during skill execution | "Node-RED requires Node.js (>= 18.x). Please install Node.js first." | Bot provides platform-specific install instructions |
| No package manager available (npm/bun) | "No package manager found. Installing bun..." | Bot follows skill instructions to install bun via curl, then proceeds with Node-RED installation |
| npm/bun install fails (network/permissions) | "Failed to install Node-RED: {error}. Check network connectivity and permissions." | Bot suggests retry or manual intervention |
| Node-RED fails to start after installation | "Node-RED was installed but failed to start. Check logs for details." | Bot attempts restart via skill; if persistent, reports to user |
| Port already in use | "Port {port} is in use. Node-RED cannot start." | Bot suggests changing port or freeing it |
| Heartbeat detects crash, all restart attempts fail | "Node-RED crashed and could not be restarted after 3 attempts." | Bot reports failure; user must investigate |
| Corrupted installation detected | "Node-RED installation appears corrupted. Reinstalling..." | Bot follows skill cleanup + reinstall steps |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a bundled skill (`nodered-setup`) located in `src/plugins/skills/bundled/nodered-setup/SKILL.md` that contains instructions for the bot to install, start, stop, and manage Node-RED. The skill loader MUST be updated to resolve bundled skills from `src/plugins/skills/bundled/` (replacing the current `<repo-root>/skills/` resolution).
- **FR-002**: The nodered plugin MUST detect Node-RED availability via HTTP heartbeat (GET `http://localhost:{port}/`) at a configurable interval (default: 30 seconds). Heartbeat responses MUST be validated (HTTP status code check; connection errors treated as unavailable). PID file reads MUST validate content is a numeric process ID.
- **FR-003**: When the plugin detects that Node-RED is not available at startup, it MUST signal the need for setup via two complementary mechanisms: (a) the existing `nodered.context` context provider MUST dynamically return a message instructing the bot to run the `nodered-setup` skill (visible on every LLM turn), and (b) the plugin MUST register a one-shot automation job (via the automation plugin's `once` trigger) to autonomously invoke the skill immediately without waiting for user interaction. The automation service is a soft dependency: the plugin MUST null-guard `getService('automation.service')` and silently degrade to context-provider-only mode if the automation plugin is not loaded.
- **FR-004**: The skill MUST include instructions for detecting the user's available package manager (npm, bun), and if neither is present, installing one (npm typically ships with Node.js; fallback: install bun via `curl -fsSL https://bun.sh/install | bash`). The detected or installed package manager is then used to install Node-RED in `~/.slashbot/nodered/`.
- **FR-005**: The skill MUST include instructions for starting Node-RED via `node ~/.slashbot/nodered/node_modules/node-red/red.js -s settings.js` and writing the process PID to `~/.slashbot/nodered/nodered.pid`.
- **FR-006**: The skill MUST include instructions for stopping Node-RED gracefully by reading the PID from `~/.slashbot/nodered/nodered.pid`, sending SIGTERM with 10-second timeout, then SIGKILL, and removing the PID file.
- **FR-007**: The skill MUST include prerequisite checks: Node.js (>= 18.x) availability.
- **FR-008**: The plugin MUST emit lifecycle events: `nodered:ready`, `nodered:stopped`, `nodered:error`, `nodered:failed`, `nodered:setup-needed`. The `NodeRedState` union type MUST include `setup-needed` as a formal 7th value (alongside `running`, `stopped`, `starting`, `failed`, `unavailable`, `disabled`). This is an additive change to an in-memory TypeScript type; no data migration is needed since the state is never persisted.
- **FR-009**: The plugin MUST display Node-RED status in the TUI sidebar using dynamic labels: "NR: Running", "NR: Stopped", "NR: Starting", "NR: Failed", "NR: Unavailable", "NR: Setup Needed". The sidebar contribution follows the existing keyboard-navigable sidebar pattern; no additional TUI elements are introduced.
- **FR-010**: When the heartbeat detects Node-RED has become unresponsive (was running, now failing), the plugin MUST emit `nodered:error` and trigger restart via the same dual mechanism as FR-003: fire a one-shot automation job to invoke the skill for restart, and update the context provider to reflect the need for restart (up to 3 retries with exponential backoff).
- **FR-011**: The plugin MUST probe the configured port on startup. If Node-RED is already responding, it MUST adopt the existing instance (skip setup, begin monitoring).
- **FR-012**: The plugin MUST NOT depend on npm, npx, or any package manager at the code level. All installation logic is delegated to the skill (executed by the bot).
- **FR-013**: The skill MUST be invocable both by the model (autonomously) and by the user (`/skill run nodered-setup`).
- **FR-014**: The plugin MUST generate a Node-RED `settings.js` file from its configuration eagerly during `setup()`, ensuring the file is always present in `~/.slashbot/nodered/settings.js` before any skill invocation.
- **FR-015**: The plugin MUST create the Node-RED user directory (`~/.slashbot/nodered/`) on first startup if it does not exist.
- **FR-016**: The plugin MUST NOT block slashbot startup if Node-RED is unavailable. Setup runs asynchronously via the bot.
- **FR-017**: The skill frontmatter MUST declare `requires.bins: [node]` so that eligibility checks verify Node.js availability.
- **FR-018**: The skill MUST include instructions for health verification after starting Node-RED (poll `http://localhost:{port}/` until 200 or timeout).

### Key Entities

- **NodeRedSetupSkill**: A bundled skill (SKILL.md) containing step-by-step instructions for the bot to manage Node-RED installation and lifecycle. Key attributes: name, description, prerequisites (Node.js), triggers, instruction sections (install, start, stop, restart, verify).
- **NodeRedAvailabilityState**: The plugin's view of Node-RED status based on heartbeat. States: running, stopped, starting, stopping, unavailable, setup-needed, failed. `setup-needed` is a formal state in the `NodeRedState` union type.
- **HeartbeatMonitor**: Plugin component that periodically probes the Node-RED HTTP endpoint to determine availability. Key attributes: interval, port, timeout, current state.

## Performance Requirements

| Metric | Target | Justification |
|--------|--------|---------------|
| Heartbeat probe latency | < 2 seconds per probe | Rapid availability detection |
| Crash detection to skill invocation | < 1 heartbeat interval + 5 seconds | Minimize downtime after crash |
| Plugin init (without Node-RED) | < 2 seconds | Plugin starts fast; setup is async via bot |
| Full setup (install + start) | < 120 seconds | npm install is network-bound; reasonable for first-time setup |

## Security Considerations

| Security Concern | Mitigation | Implementation Notes |
|------------------|------------|---------------------|
| Bot executes shell commands for installation | Skill instructions are bundled (not user-modifiable at runtime); bot follows predefined steps | Same trust model as existing bash plugin |
| Node-RED listens on network port | Bind to localhost only by default | Configured in generated settings.js |
| npm install executes arbitrary code | Standard npm security model; no different from manual npm usage | User accepts this when enabling Node-RED |
| Skill could be overridden by workspace skill | Workspace skills take precedence; this is by design | Users who override accept responsibility |
| Node-RED admin API accessible on localhost | No authentication configured by default; localhost-only binding limits exposure | Admin API is used only by the flow-management plugin (feature 002) on the same machine; network-level isolation is sufficient for single-user CLI tool. If multi-user or remote access is needed in future, add `adminAuth` to settings.js |

## Data & State

- **Data ownership**: Plugin owns heartbeat state and configuration; skill is stateless (instructions only)
- **Access control**: Only the slashbot process reads/writes configuration
- **Retention policy**: Configuration persists indefinitely; no additional state from the skill
- **Concurrent modification**: Single heartbeat monitor per plugin instance
- **Sync behavior**: Heartbeat state is real-time; configuration read at startup

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a clean system with Node.js installed, the bot autonomously installs and starts Node-RED within 2 minutes of slashbot first startup, without requiring npm to be pre-installed if bun is available.
- **SC-002**: The plugin detects Node-RED availability/unavailability within one heartbeat interval (default 30 seconds).
- **SC-003**: After a Node-RED crash, the bot autonomously restarts it within 60 seconds (for transient failures).
- **SC-004**: The plugin contains zero references to npm, npx, or package installation — all installation logic resides in the skill.
- **SC-005**: Slashbot starts and is fully usable within 5 seconds, regardless of Node-RED state.

## Assumptions

- Node.js (>= 18.x) is available on the host machine. The skill checks for this but does not install it.
- At least one package manager (npm or bun) is available for installing Node-RED. The skill detects which is available.
- The Node-RED instance runs on the same machine as slashbot (localhost).
- The bot has permission to execute shell commands (same trust model as the bash plugin).
- Network connectivity is available for the initial npm/bun install.

---

## Technical Hints (For Planning)

> This section preserves technical guidance for implementation planning.
> It is not part of the functional specification but should be considered during `/specforge.plan`.

### Technical Constraints
- Skill is markdown-driven (SKILL.md with YAML frontmatter) — no TypeScript code in the skill itself
- The bot (LLM) interprets skill instructions and executes shell commands via the bash tool
- Plugin code (TypeScript) handles only: heartbeat, state management, event emission, settings generation
- The skill loader currently resolves bundled skills from `<repo-root>/skills/` but MUST be updated to resolve from `src/plugins/skills/bundled/<name>/SKILL.md`

### Implementation Guidance
- Create `src/plugins/skills/bundled/nodered-setup/SKILL.md` with frontmatter and instruction sections
- Refactor `NodeRedManager.ts` to remove `ensureNodeRedInstalled()` and process spawn logic
- Keep heartbeat, state machine, event emission, and settings generation in the plugin
- Plugin signals setup need via prompt contribution or event; bot picks up and invokes skill
- Skill sections: detect, install, start, stop, restart, verify, troubleshoot

### Migration from Feature 001
- Remove FR-019 (auto-install via npm) from 001 spec
- Remove process spawn/kill logic from NodeRedManager
- Keep FR-002 (heartbeat), FR-006 (events), FR-010 (sidebar), FR-011 (config)
- Add new FR for `nodered:setup-needed` event
- NodeRedManager becomes a thin "availability monitor + event emitter"
