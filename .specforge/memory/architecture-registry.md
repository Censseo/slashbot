# Architecture Registry

> **Purpose**: This registry captures **high-level architectural patterns** and **technology decisions** that apply across all features. It serves as the source of truth for architectural consistency.
>
> **Scope**: Architectural patterns, interface contracts between modules, major technology decisions.
> For module-specific conventions (naming, file organization, code patterns), see `{module}/CLAUDE.md` files.
> For specification rules, see `/memory/constitution.md`.

**CRITICAL**: Before planning ANY new feature, load this registry and verify alignment.
New features MUST follow established patterns unless explicitly diverging with documented justification.

## How This Registry Works

1. **During Planning** (`/specforge.plan`): Load this registry and verify new design aligns
2. **During Implementation** (`/specforge.implement`): Module-specific CLAUDE.md files are auto-loaded by Claude Code
3. **After Merge** (`/specforge.merge` + `/specforge.learn`): Update registry with new patterns, update module CLAUDE.md files
4. **Quality Gate** (`/specforge.checklist`): Validates plan alignment with registry patterns

---

## Architectural Patterns

> High-level patterns that define how the system is structured. For implementation details, see module CLAUDE.md files.

| Pattern | Description | Modules Using | Key Interfaces |
|---------|-------------|---------------|----------------|
| Plugin-First Architecture | Every capability is a plugin; core provides infrastructure only | All (24 plugins) | `Plugin`, `PluginMetadata`, `PluginContext` |
| Contribution-Based Extension | Plugins contribute to shared registries (actions, prompts, commands, tools, context, events, sidebar) | All plugins | `ActionContribution`, `PromptContribution`, `ToolContribution`, `CommandHandler` |
| Library-First Development | Business logic in standalone services before plugin wrappers | wallet, heartbeat, scheduling, skills, filesystem, bash, system | `*Service` classes injectable via DI |
| Dependency Injection (InversifyJS) | All services registered as singletons in a shared DI container | core, all plugins | `TYPES` symbols, `Container` |
| Typed Event Bus | Discriminated union events for core + string-based for plugins, with wildcard support | core/events, all plugins | `EventBus`, `SlashbotEvent` |
| Dynamic Action Parsing | Plugins define XML tag parsers; core routes LLM-generated tags to handlers | core/actions, 20+ plugins | `ActionParserConfig`, `Action`, `ActionResult` |
| AI SDK Tool Integration | Zod-schema tools as alternative to XML actions for LLM tool-calling | bash, say, todo (expanding) | `ToolContribution`, Zod schemas |
| Connector Abstraction | Platform-agnostic message routing with per-platform formatting | connectors (telegram, discord) | `Connector`, `ConnectorRegistry`, `splitMessage` |
| Prompt Assembly | Dynamic system prompt built from plugin contributions sorted by priority | core/api/prompts, all plugins | `PromptAssembler`, `PromptContribution` |
| Session-Scoped Context | Per-channel/chat conversation isolation via session IDs | core/api/sessions, connectors | `SessionManager`, `ConversationSession` |
| Dynamic Sidebar Label | Sidebar contributions with state-dependent labels via `Object.defineProperty` getter on `SidebarContribution.label` | nodered | `SidebarContribution` with property getter |
| Managed Child Process | Non-detached child process with exit monitoring, health probes, and crash recovery (vs ProcessManager's detached fire-and-forget) | nodered | `NodeRedManager`, `Bun.spawn` with exit handler |
| Stale Process Adoption | Port probing before spawn to adopt already-running instances (FR-018 pattern) | nodered | HTTP fetch probe on configured port during init |
| Typed Plugin Event Emission | Plugin events use local discriminated union type + helper method to avoid `as any` casts on EventBus.emit() | nodered | `NodeRedEvent` union type, `emitNodeRedEvent()` helper |
<!-- Added from 001-nodered-lifecycle (2026-02-14) -->
| Skill-Delegated Lifecycle | Plugin detects state needing external action (e.g. `setup-needed`, crash), signals via context provider + one-shot automation job; the bot (LLM) runs a bundled skill to carry out the action (install, start, restart). Separates "what to detect" from "how to act". | nodered, skills | `SkillManager.getSkill()`, `AutomationService.addOnceJob()`, context provider enrichment |
| Dual Signal (Context + Automation) | When plugin enters an actionable state, emit two signals: (1) enrich the context provider for persistent LLM visibility, (2) fire a one-shot automation job for immediate proactive action. Ensures both passive (next conversation) and active (current session) channels are covered. | nodered | Context provider with state guard, `addOnceJob()` with null guard for soft dependency |
| Prompt-Only Feature Integration | New capabilities added by enriching prompt contributions rather than creating new tools, services, or action parsers. The LLM calls existing tools guided by detailed prompt context (structure docs, node catalogues, embedded examples, generation rules). | nodered (AI Flow Authoring) | Existing `ToolContribution` + `PromptContribution` |
| Gateway Method Registration | Plugins register RPC methods via `context.registerGatewayMethod()` for external access through MCP bridge. Each method has an id, pluginId, description, and async handler. | nodered | `registerGatewayMethod()`, `JsonValue` |
| Synthetic Tab for Validation | When LLM omits the tab node from flow `nodes` (because the API creates it implicitly), FlowManager synthesizes a tab node from the `z` field values before validation. Strips tab nodes before the API call. | nodered/FlowManager | `validateFlow()`, `createFlow()`, `updateFlow()` |
<!-- Added from 005-ai-flow-authoring (2026-03-03) -->
<!-- Added from 003-nodered-setup-skill (2026-02-19) -->

---

## Technology Stack

> Major technology decisions that affect multiple modules. Version-specific details belong in module CLAUDE.md files.

| Category | Technology | Rationale | Alternatives Rejected |
|----------|------------|-----------|----------------------|
| Runtime | Bun 1.0+ | Fast startup (CLI), native TS support, built-in bundler with --compile for single binary | Node.js (slower startup), Deno (less ecosystem compat) |
| Language | TypeScript (strict mode) | Type safety, decorator support for DI | JavaScript (no types), Go (different ecosystem) |
| DI Container | InversifyJS | Mature TS DI with decorator-based injection, singleton scope | tsyringe (less mature), manual DI (verbose) |
| AI SDK | Vercel AI SDK | Multi-provider (xAI, Anthropic, OpenAI, Google), streaming, tool use | Direct API calls (no abstraction), LangChain (heavy) |
| TUI Framework | @opentui/core | Native terminal UI with React-like component model, JSX support | blessed (outdated), ink (React-based, heavier) |
| Blockchain | Solana (web3.js, SPL Token) | Fast transactions (400ms), low fees, SPL token standard | Ethereum (slow, expensive), Polygon (less ecosystem) |
| Testing | Vitest | Fast (Vite-powered), ESM native, TS support, V8 coverage | Jest (slower, CJS-first), Mocha (manual setup) |
| Linting | ESLint + TypeScript ESLint + Prettier | Industry standard, TS-aware rules, auto-formatting | Biome (newer, less plugins) |
| Validation | Zod v4 | Type inference + runtime validation for tool schemas | Yup (no inference), io-ts (verbose) |
| Telegram | Telegraf | Mature Node.js Telegram bot framework | node-telegram-bot-api (lower level) |
| Discord | discord.js | Standard Discord library for Node.js | Eris (less maintained) |
| Build | Bun build --compile | Single binary distribution, native binding support | esbuild (no compile), webpack (complex) |

---

## Module Contracts

> Interface contracts between modules. These are the "handshake agreements" that modules must respect.

### Core ↔ Plugins

**Communication**: Plugin Interface + DI Container + EventBus

**Contract Location**: `src/plugins/types.ts`

**Key Interfaces**:
- `Plugin`: Main interface all plugins implement (init, contributions, lifecycle hooks)
- `PluginContext`: Context provided to plugins (container, eventBus, configManager, workDir, getGrokClient)
- `PluginMetadata`: Plugin identity (id, name, version, category, description, dependencies)

### Plugins ↔ Core Actions

**Communication**: Parser Registration + Executor Dispatch

**Contract Location**: `src/core/actions/parser.ts`, `src/core/actions/types.ts`

**Key Interfaces**:
- `ActionParserConfig`: Parser registration (tags, parse function, fixups, preStrip)
- `Action`: Parsed action with type field
- `ActionResult`: Execution result (action, success, result, error)
- `ActionHandlers`: Handler map passed to executors

### Core ↔ Connectors

**Communication**: Connector Interface + ConnectorRegistry + EventBus

**Contract Location**: `src/connectors/base.ts`, `src/connectors/registry.ts`

**Key Interfaces**:
- `Connector`: Platform connector (start, stop, sendMessage, setMessageHandler)
- `ConnectorEntry`: Registry entry (connector, isRunning, sendMessage, sendMessageTo)
- `MessageHandler`: `(message, source, metadata?) => Promise<string | void>`
- `PLATFORM_CONFIGS`: Per-platform limits (maxMessageLength, supportsMarkdown, conciseMode)

### Plugins ↔ AI SDK

**Communication**: Tool Contributions + Zod Schemas

**Contract Location**: `src/plugins/types.ts`, `src/core/api/toolRegistry.ts`

**Key Interfaces**:
- `ToolContribution`: name, description, parameters (Zod), toAction, controlFlow
- `ToolRegistry`: Collects and registers tools for AI SDK consumption

---

## Cross-Module Dependencies

> Shared components that multiple modules depend on.

| Component | Owner Module | Used By | Stability |
|-----------|--------------|---------|-----------|
| EventBus | core/events | All plugins, connectors, kernel | Stable |
| ConfigManager | core/config | All plugins, connectors | Stable |
| DI Container (TYPES) | core/di | All plugins, connectors | Stable |
| Display Service | core/ui | All plugins, connectors, core | Stable |
| PluginRegistry | plugins/registry | core/app/kernel | Stable |
| CommandRegistry | core/commands | All plugins with commands | Stable |
| ToolRegistry | core/api | Plugins with tool contributions | Evolving |
| SecureFileSystem | plugins/filesystem | filesystem, code-editor | Stable |
| ProcessManager | plugins/bash | bash, system | Stable |
| SessionManager | core/api | kernel, connectors | Stable |
| TranscriptionService | plugins/transcription | telegram, discord connectors | Stable |
| ImageBuffer | plugins/filesystem | tui, telegram, discord | Stable |
| NodeRedManager | plugins/nodered | future nodered features | Stable |

---

## Architectural Anti-Patterns

> Approaches that were tried and MUST be avoided at the architectural level.

| Anti-Pattern | Issue | Correct Approach |
|--------------|-------|------------------|
| Feature logic in core engine | Violates plugin-first principle; makes core untestable and bloated | Implement as plugin; core provides infrastructure only |
| Direct cross-plugin imports | Creates tight coupling, breaks dependency resolution | Use EventBus for communication, DI container for service access |
| Shared mutable state between plugins | Race conditions, unpredictable behavior | Use DI-scoped singletons or EventBus for state propagation |
| Circular plugin dependencies | Build failures, initialization deadlock | Refactor to use events or shared DI services |
| Unencrypted secret storage | Security vulnerability for API keys and wallet data | Use AES-256-GCM encryption (CryptoService) for sensitive data |
| Hard-coded platform limits | Breaks when new connectors are added | Use PLATFORM_CONFIGS lookup by ConnectorSource |
| Bypassing action parser for direct execution | Breaks plugin isolation and action result tracking | Always go through registerActionParser + executeActions pipeline |
| Using `any` without justification | Defeats TypeScript safety guarantees | Use proper types; `container.get<SpecificType>(TYPES.X)` |
| Bypassing setState() for direct state mutation | Breaks state machine validation, skips prompt:redraw events | Always use setState() for all state transitions |
| Synchronous file I/O in stream handlers | Blocks event loop under high throughput | Use async writes with file handle reuse or fs.promises |
<!-- Added from 001-nodered-lifecycle review corrections (2026-02-14) -->
| Force-push or destructive git operations | Can destroy user work | Git allowlist in git plugin blocks dangerous commands |

---

## Architectural Decisions Log

> Key architectural decisions with context.

### ADR-001: Plugin-First Architecture

- **Date**: 2024 (project inception)
- **Status**: Accepted
- **Context**: Needed extensible system where capabilities could be added/removed without modifying core
- **Decision**: Every capability is a plugin. Core provides DI, events, prompt assembly, action parsing only
- **Consequences**: 24 built-in plugins, third-party plugin support, clear separation of concerns

### ADR-002: XML Action Tags + AI SDK Tools Dual System

- **Date**: 2024
- **Status**: Accepted (evolving toward tools)
- **Context**: LLM needs to invoke system capabilities; XML tags were first, AI SDK tools added later
- **Decision**: Support both XML action tags (legacy) and AI SDK tool contributions (modern)
- **Consequences**: Both systems coexist; new plugins should prefer tool contributions; migration ongoing

<!-- Added from 005-ai-flow-authoring (2026-02-27) -->
### Anti-Pattern: Unnecessary fetch mocks for built-in-only test nodes

When adding short-circuit paths to functions that are heavily mocked, audit all test cases that set up mocks for that function. vitest's `vi.clearAllMocks()` clears call history but NOT queued `mockResolvedValueOnce` responses — unconsumed queue entries leak across tests. Fix by removing mock setup from tests that now short-circuit, or switching `beforeEach` to `vi.resetAllMocks()`.

<!-- End 005-ai-flow-authoring -->

### ADR-003: InversifyJS for Dependency Injection

- **Date**: 2024
- **Status**: Accepted
- **Context**: Plugins need access to shared services without direct imports
- **Decision**: Use InversifyJS with symbol-based tokens, singleton scope by default
- **Consequences**: All services registered in shared container; plugins self-register during init()

### ADR-004: Bun Runtime + Single Binary Distribution

- **Date**: 2024
- **Status**: Accepted
- **Context**: CLI tool needs fast startup and easy distribution
- **Decision**: Use Bun for development and `bun build --compile` for single binary
- **Consequences**: Fast startup, native TS, but requires copying native bindings (OpenTUI) post-build

### ADR-005: Connector Lock System

- **Date**: 2025
- **Status**: Accepted
- **Context**: Multiple slashbot instances could try to start same connector (Telegram/Discord)
- **Decision**: PID-based lock files in `~/.slashbot/locks/` prevent duplicate connectors
- **Consequences**: Only one instance per connector type; graceful messaging on lock conflicts

### ADR-006: Multi-Provider AI Support

- **Date**: 2025
- **Status**: Accepted
- **Context**: Users want choice of LLM provider (xAI, Anthropic, OpenAI, Google)
- **Decision**: Vercel AI SDK with ProviderRegistry; auto-detect provider from API key prefix
- **Consequences**: Provider-agnostic core; each provider has specific model catalog; xAI is default

---

## Registry Maintenance

### When to Update This Registry

Update this registry when:
- A new **architectural pattern** is established (not just code conventions)
- A **technology decision** affects multiple modules
- A new **module contract** is defined
- An **anti-pattern** is discovered at the architectural level

### What Does NOT Belong Here

These belong in `{module}/CLAUDE.md` instead:
- File naming conventions
- Code formatting rules
- Module-specific patterns (React hooks, service class structure)
- Testing conventions for specific modules
- Error handling details

### Update Process

1. Run `/specforge.learn` after `/specforge.merge`
2. Review proposed changes
3. Keep only high-level patterns in this file
4. Module-specific details go to respective CLAUDE.md files

---

<!-- Added from 004-mcp-bridge (2026-02-25) -->
| Dynamic Tool Registration | Plugins may register/unregister tools at runtime via `PluginRegistrationContext.registerTool()` / `unregisterTool()`; emit `prompt:redraw` after changes | nodered/McpBridgeService | `PluginRegistrationContext`, `Registry<T>.delete()` |
| Event-Driven Bridge Services | Services that bridge external systems to the tool registry subscribe to lifecycle events (`nodered:ready`, `flow:updated`, `flow:deleted`) and reconcile state | nodered/McpBridgeService | `EventBus`, `FlowManager` |
<!-- Added from 007-association-graph (2026-03-09) -->
| In-Memory Graph with Deferred Flush | Graph data is kept in Maps (nodes, edges, reverseEdges, edgeIndex) and written to JSONL only after mutations; a 500ms debounced timer coalesces rapid writes into a single flush. Avoids hot-path I/O while ensuring durability. | memory/AssociationGraph | `dirty` flag + `scheduleDirtyFlush()` + `flush()` |
| Dual-Index Edge Storage | Edges stored in both a forward adjacency map (`from → GraphEdge[]`) and a reverse map (`to → GraphEdge[]`) plus a deduplication index keyed `from|to|rel`. Enables O(1) neighbor lookups in both directions without graph reversal. | memory/AssociationGraph | `edges`, `reverseEdges`, `edgeIndex` |
| LLM-Driven Knowledge Extraction | On `memory:upserted` events, fire-and-forget `extractAndMerge(text, llmAdapter)` calls the LLM in a dedicated session (`noTools`, `maxSteps:1`) to extract JSON concepts/edges, then merges them into the graph. Errors are swallowed to avoid disrupting the write path. | memory plugin | `AssociationGraph.extractAndMerge()`, `LlmAdapter.complete()` |
| Graph-Augmented Search | Full-text BM25 search is extended by exploring graph neighbors of the top query concept and running secondary BM25 passes. Graph-expanded hits are scored at 50% weight and tagged `source: 'graph'`; results are merged and re-ranked before truncation. | memory/MemoryStore | `search(query, limit, graph?, expand?)` |
| Shared Service Registration | Pure-domain services (no plugin logic) registered under stable string IDs via `context.registerService()` so other plugins can resolve them without direct imports. Pattern enables cross-plugin service sharing without DI container coupling. | memory plugin | `memory.store`, `memory.graph` service IDs |

**Version**: 2.3.0 | **Last Updated**: 2026-03-09 (007-association-graph patterns added)
