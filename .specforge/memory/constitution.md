<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 0.0.0 (template) → 1.0.0 (initial ratification)

  Modified principles: N/A (first ratification — all sections new)

  Added sections:
    - Accessibility: TUI-specific accessibility rules
    - Performance: Relaxed AI-bound thresholds with non-API measurables
    - Security: Wallet encryption, input validation, credential handling
    - Error Handling: Failure modes, user-facing messages, graceful degradation
    - Data & State: Encrypted persistence, user data minimization, state management
    - Dev Principle 1: Test-First (TDD)
    - Dev Principle 2: Plugin-First Architecture
    - Dev Principle 3: Library-First
    - Dev Principle 4: Simplicity (YAGNI)
    - Business Constraints: MIT license, privacy, crypto hygiene
    - Quality Standards: Coverage, review, documentation targets

  Removed sections: None

  Templates requiring updates:
    - .specforge/templates/plan-template.md ✅ compatible (Constitution Check section reads from this file)
    - .specforge/templates/spec-template.md ✅ updated (version ref v1.0.0, TUI accessibility, CLI performance defaults)
    - .specforge/templates/tasks-template.md ✅ compatible (test tasks align with TDD principle)
    - .specforge/templates/checklist-template.md ✅ compatible (generates from Specification Principles)

  Follow-up TODOs: None — all placeholders resolved.
-->

# Slashbot Constitution

> **Purpose**: This constitution defines the non-negotiable rules that ALL specifications must follow. It serves as the quality gate for requirements, not implementation.

## Specification Principles

> Rules that every spec.md MUST respect. These are validated by `/specforge.checklist`.

### Accessibility

Slashbot is a terminal application with TUI (OpenTUI) and chat-platform connectors (Telegram, Discord). Web/mobile UI accessibility standards (WCAG) do not directly apply, but terminal-specific accessibility MUST be addressed.

- Every TUI panel MUST be fully navigable via keyboard alone; mouse interaction MUST NOT be the only way to reach any feature.
- Color usage MUST NOT be the sole means of conveying information; text labels, symbols, or structural cues MUST accompany color indicators.
- TUI color themes MUST maintain a minimum contrast ratio readable on both light and dark terminal backgrounds.
- Connector output (Telegram, Discord) MUST use platform-native formatting (Markdown, embeds) so platform accessibility tools (screen readers, font scaling) can process content.
- Animated elements (spinners, progress bars) MUST degrade gracefully to static text in non-interactive or piped output contexts.

### Performance

Most user-perceived latency in Slashbot is dominated by external LLM API round-trips. Hard sub-second thresholds on end-to-end response time are therefore not meaningful. Performance requirements focus on the non-API portions of the system.

- All response times in specs MUST be quantified with measurable values; vague terms ("fast", "responsive") are prohibited.
- Plugin initialization (all built-in plugins combined) MUST complete within 2 seconds on the reference platform (Bun 1.0+, modern Linux).
- Non-API action execution overhead (parsing, file I/O, formatting) MUST remain below 500ms per action.
- Streaming output MUST begin rendering to the user within 200ms of receiving the first API chunk.
- Performance-sensitive features MUST define measurable thresholds in their spec.md; the thresholds above serve as defaults.
- Performance degradation scenarios (e.g., large file reads, bulk operations) MUST be specified in feature specs where applicable.

### Security

Slashbot handles shell execution, file system access, wallet private keys, and external API credentials. Security requirements apply broadly.

- All sensitive data (API keys, wallet keys, passwords) MUST be identified and their handling specified in every feature that touches them.
- Private keys and seed phrases MUST be encrypted at rest using AES-256-GCM (or equivalent) with password-derived keys.
- Passwords and secrets MUST never be logged, stored in plaintext, or included in conversation context sent to the LLM.
- Shell command execution MUST validate input against the dangerous patterns blocklist before execution.
- Data validation MUST be specified at all system boundaries: user input, plugin input, connector input, external API responses.
- Features introducing new external integrations MUST document their authentication and authorization model.

### Error Handling

- All features MUST specify their failure modes and the user-facing message for each failure.
- Fallback behavior MUST be defined for critical paths (API failures, wallet operations, file operations).
- User-facing error messages MUST be actionable: they MUST tell the user what went wrong and what they can do about it.
- Plugin initialization failures MUST NOT crash the application; the failed plugin MUST be disabled with a logged warning and the system MUST continue operating.
- Connector disconnections MUST be handled with automatic reconnection attempts and user notification.

### Data & State

- User data MUST be minimized: collect and store only what is necessary for functionality.
- All persistent user data locations MUST be documented (currently `~/.slashbot/`).
- State management approach (file-based JSON, in-memory, DI-scoped) MUST be documented for each feature that maintains state.
- Wallet data (encrypted keys) and credentials MUST use the established `~/.slashbot/` storage with file-level encryption.
- Conversation context and history MUST NOT contain sensitive data (keys, passwords, tokens) in persisted form.
- Schema changes to configuration or data files MUST include a migration or backward-compatibility strategy.

---

## Development Principles

> Fundamental development practices that guide implementation.

### Test-First (TDD)

All features MUST follow the Red-Green-Refactor cycle. Tests are written before implementation code. A feature is not considered complete until its tests pass. Test files live alongside source files or in a dedicated `tests/` directory matching the source structure.

- Unit tests MUST cover core logic (services, parsers, handlers).
- Integration tests SHOULD cover plugin interactions and connector flows.
- The test suite MUST run via `bun run test` (Vitest) and MUST pass before merge.

### Plugin-First Architecture

Every new capability MUST be implemented as a plugin conforming to the `Plugin` interface. No feature logic belongs in the core engine — core provides infrastructure (DI, events, prompt assembly, action parsing) and plugins provide functionality.

- New features MUST register actions, prompts, commands, and context via the plugin contribution API.
- Plugins MUST declare their dependencies in `metadata.dependencies` for topological initialization.
- Cross-plugin communication MUST use the EventBus or DI container, not direct imports.

### Library-First

Every feature MUST start as standalone, testable logic before being wrapped as a plugin. The service layer (business logic) MUST be separable from the plugin layer (integration glue).

- Services MUST be injectable via InversifyJS and testable without the plugin framework.
- Plugin classes MUST be thin wrappers that wire services into the contribution API.

### Simplicity (YAGNI)

Build only what is needed now. No premature abstraction, no speculative generality, no over-engineering.

- Three similar lines of code are preferable to a premature abstraction.
- Configuration options MUST NOT be added "just in case" — add them when a real use case demands it.
- Favor deleting dead code over commenting it out or wrapping it in feature flags.

---

## Business Constraints

> Domain-specific rules, compliance requirements, legal constraints.

### Compliance

- The project is licensed under MIT. All dependencies MUST have MIT-compatible licenses (MIT, ISC, BSD, Apache-2.0). GPL-licensed runtime dependencies are prohibited.
- Third-party plugin installation MUST display the plugin's license before installation proceeds.

### Domain Rules

- **Privacy**: User conversation content, command history, and personal data MUST NOT be transmitted to any service other than the configured LLM API endpoint and the Slashbot proxy (for token-mode billing). No analytics, telemetry, or third-party tracking.
- **Crypto hygiene**: Wallet private keys MUST be encrypted at rest (AES-256-GCM). Seed phrases MUST never appear in logs, error messages, or API payloads. Session-based wallet auth MUST time out after 30 minutes of inactivity.
- **User data minimization**: The system MUST NOT persist data beyond what is required for its stated functionality. Users MUST be able to delete their data by removing `~/.slashbot/`.

---

## Quality Standards

> Measurable quality gates for the project.

| Metric | Target | Enforcement |
|--------|--------|-------------|
| Test Coverage | 70% | CI blocks below threshold |
| Code Review | Required | PR merge requires approval |
| Documentation | Required for public plugin APIs | New plugins must document their action tags and commands |
| Type Safety | Strict | `tsc --noEmit` must pass; no `any` in new code without justification |
| Linting | Required | ESLint + Prettier must pass before merge |

---

## Governance

- Constitution supersedes all other practices
- Amendments require: documentation, team approval, migration plan
- All specs MUST be validated against this constitution before implementation
- Divergence from principles requires explicit justification and approval
- Version follows semantic versioning:
  - MAJOR: Backward-incompatible governance/principle removals or redefinitions
  - MINOR: New principle/section added or materially expanded guidance
  - PATCH: Clarifications, wording, typo fixes, non-semantic refinements

**Version**: 1.0.0 | **Ratified**: 2026-02-12 | **Last Amended**: 2026-02-12
