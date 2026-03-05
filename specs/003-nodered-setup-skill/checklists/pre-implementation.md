# Pre-Implementation Checklist: Node-RED Setup Skill

**Purpose**: Validate requirements quality, constitution compliance, and architecture alignment before implementation.
**Created**: 2026-02-19
**Depth**: Standard | **Audience**: Reviewer (PR) | **Timing**: Pre-implementation gate
**Focus**: All domains — deviation check, constitution compliance, architecture alignment

<!-- Validated: 2026-02-19 -->

---

## Constitution Compliance

### Accessibility [Constitution §Accessibility]

- [x] CHK001 - Are TUI sidebar labels for all 7 states defined with text (not color-only) conveying information? [Completeness, Spec §FR-009]
- [x] CHK002 - Is keyboard navigability specified for any new TUI elements introduced by this feature? [Coverage, Constitution §Accessibility]
  <!-- Remediated: FR-009 now notes sidebar follows existing keyboard-navigable pattern -->
- [x] CHK003 - Are animated elements (spinners during setup) specified to degrade to static text in non-interactive contexts? [Coverage, Constitution §Accessibility]
  <!-- N/A: This feature introduces no animated TUI elements. Setup runs via bot shell commands, not TUI spinners. -->

### Performance [Constitution §Performance]

- [x] CHK004 - Are all response time requirements quantified with measurable values (no "fast" or "responsive")? [Clarity, Spec §Performance]
- [x] CHK005 - Is plugin initialization time specified to remain below 2 seconds per constitution default? [Measurability, Spec §Performance]
- [x] CHK006 - Is heartbeat probe latency quantified (< 2s)? [Measurability, Spec §Performance]
- [x] CHK007 - Is the crash-detection-to-skill-invocation latency specified with a measurable threshold? [Clarity, Spec §Performance]
- [x] CHK008 - Is the full setup time (install + start) bounded with a measurable threshold? [Completeness, Spec §Performance]

### Security [Constitution §Security]

- [x] CHK009 - Are all sensitive data items identified and their handling specified for this feature? [Completeness, Constitution §Security]
- [x] CHK010 - Is the Node-RED listening address specified as localhost-only to prevent network exposure? [Clarity, Spec §Security]
- [x] CHK011 - Is the trust model for bot-executed shell commands documented and justified? [Coverage, Spec §Security]
- [x] CHK012 - Is data validation specified at system boundaries (skill frontmatter parsing, heartbeat responses, PID file reads)? [Coverage, Constitution §Security]
  <!-- Remediated: FR-002 now specifies heartbeat response validation and PID file content validation -->
- [x] CHK013 - Does the spec document the authentication/authorization model for the Node-RED admin API? [Coverage, Constitution §Security]
  <!-- Remediated: Security table now documents admin API auth model (localhost-only, no auth needed for single-user CLI) -->

### Error Handling [Constitution §Error Handling]

- [x] CHK014 - Are all failure modes listed with user-facing messages for each? [Completeness, Spec §Error Scenarios]
- [x] CHK015 - Are user-facing error messages actionable (tell user what went wrong AND what to do)? [Clarity, Spec §Error Scenarios]
- [x] CHK016 - Is fallback behavior defined for the automation plugin being absent (soft dependency)? [Coverage, Spec §FR-003]
- [x] CHK017 - Is plugin initialization failure specified to not crash the application per constitution? [Consistency, Constitution §Error Handling]
- [x] CHK018 - Are retry semantics for crash recovery quantified (count, backoff intervals)? [Measurability, Spec §FR-010]

### Data & State [Constitution §Data & State]

- [x] CHK019 - Are all persistent data locations documented (`~/.slashbot/nodered/` contents)? [Completeness, Constitution §Data & State]
- [x] CHK020 - Is the state management approach documented (heartbeat state, PID file, config file)? [Completeness, Spec §Data & State]
- [x] CHK021 - Is the PID file lifecycle fully specified (creation, reading, deletion, stale handling)? [Coverage, Spec §FR-005, FR-006]
- [x] CHK022 - Is a migration or backward-compatibility strategy specified for changes to the NodeRedState type? [Coverage, Constitution §Data & State]
  <!-- Remediated: FR-008 now documents this is an additive in-memory type change requiring no data migration -->

---

## Development Principles Compliance

### Test-First (TDD) [Constitution §TDD]

- [x] CHK023 - Are unit test requirements specified for core logic changes (state machine, context provider, PID file)? [Completeness, Plan §WP9]
- [x] CHK024 - Are integration test requirements specified for skill discovery from bundled path? [Coverage, Plan §WP9]

### Plugin-First Architecture [Constitution §Plugin-First]

- [x] CHK025 - Is all new functionality implemented via plugin contributions (no feature logic in core)? [Consistency, Constitution §Plugin-First]
- [x] CHK026 - Are plugin dependencies declared in `metadata.dependencies`? [Completeness, Constitution §Plugin-First]
- [x] CHK027 - Is cross-plugin communication via EventBus or DI container (not direct imports)? [Consistency, Constitution §Plugin-First]

### Library-First [Constitution §Library-First]

- [x] CHK028 - Is NodeRedManager specified as an injectable service testable without the plugin framework? [Consistency, Constitution §Library-First]

### Simplicity (YAGNI) [Constitution §Simplicity]

- [x] CHK029 - Are there any speculative configuration options added without a concrete use case? [Consistency, Constitution §Simplicity]

---

## Architecture Alignment [Registry]

- [x] CHK030 - Does the plan use established patterns from the architecture registry? [Consistency, Registry §Patterns]
- [x] CHK031 - Are technology decisions aligned with the registry (Bun, TypeScript strict, InversifyJS, Vitest)? [Consistency, Registry §Technology]
- [x] CHK032 - Are any anti-patterns from the registry present in the plan (direct cross-plugin imports, feature logic in core, shared mutable state)? [Coverage, Registry §Anti-Patterns]
- [x] CHK033 - Are new patterns ("Skill-Delegated Lifecycle", "Dual Signal") justified and documented for registry update? [Completeness, Plan §New Patterns]
- [x] CHK034 - Is the "Managed Child Process" registry pattern correctly extended (skill-started process via PID file)? [Consistency, Registry §Patterns]
- [x] CHK035 - Does the "Stale Process Adoption" pattern remain intact (port probe before spawn/setup)? [Consistency, Registry §Patterns, Spec §FR-011]

---

## Spec–Plan Deviation Check

- [x] CHK036 - Does the plan address all 18 functional requirements (FR-001 through FR-018)? [Completeness, Spec §Requirements]
  <!-- Remediated: WP3 now covers FR-015 (user dir creation), WP7 now covers FR-013 (user-invocable) -->
- [x] CHK037 - Are all 4 user stories covered by work packages in the plan? [Coverage, Spec §User Scenarios]
- [x] CHK038 - Are all 7 error scenarios from the spec reflected in the plan's error handling approach? [Coverage, Spec §Error Scenarios]
- [x] CHK039 - Is the skill loader path change (FR-001: `src/plugins/skills/bundled/`) explicitly addressed in the plan? [Completeness, Plan §WP8]
- [x] CHK040 - Is the `setup-needed` state (FR-008) consistently referenced across plan work packages (WP1, WP4, WP5)? [Consistency, Plan §Work Packages]
  <!-- Remediated: WP2 now references transition from old install logic to setup-needed -->

---

**Total Items**: 40 | **Constitution Items**: 22 | **Architecture Items**: 6 | **Deviation Items**: 5 | **Dev Principles Items**: 7
