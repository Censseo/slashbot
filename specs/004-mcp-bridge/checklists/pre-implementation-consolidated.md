# Pre-Implementation Consolidated Checklist: MCP Bridge

**Purpose**: Deviation check + constitution compliance + architecture alignment across all domains before implementation
**Created**: 2026-02-25
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md)
**Depth**: Standard | **Audience**: Reviewer (PR) | **Timing**: Pre-implementation
<!-- Validated: 2026-02-25 -->

---

## Constitution Compliance

### Accessibility [Constitution §Accessibility]

- [x] CHK001 - Are accessibility requirements addressed or explicitly marked N/A with justification? [Completeness, Plan §Constitution Check]
  <!-- Plan marks N/A: "No TUI components; bridge is backend-only" — valid justification -->

### Performance [Constitution §Performance]

- [x] CHK002 - Are all response times quantified with measurable values (no vague terms like "fast" or "responsive")? [Clarity, Spec §Performance Requirements]
  <!-- spec.md Performance Requirements table: <10s registration, <100ms overhead, <5s scan -->
- [x] CHK003 - Are performance degradation scenarios specified for edge cases (e.g., 50+ flows, slow Node-RED responses)? [Coverage, Constitution §Performance]
  <!-- REMEDIATED: Added "Beyond 50 flows, linear degradation is acceptable; no hard failure" to Performance Requirements -->
- [x] CHK004 - Is the startup scan duration target (< 5s for 50 flows) justified with a measurement strategy? [Measurability, Spec §Performance Requirements]
  <!-- REMEDIATED: Added "Measured from nodered:ready event to last registerTool call" to Performance Requirements -->

### Security [Constitution §Security]

- [x] CHK005 - Are all system boundaries with data validation requirements identified (tool parameters, HTTP responses from Node-RED)? [Completeness, Constitution §Security]
  <!-- REMEDIATED: Added HTTP response validation to §Security table -->
- [x] CHK006 - Is the authentication/authorization model for the Node-RED integration documented? [Coverage, Constitution §Security]
  <!-- REMEDIATED: Added "Authentication model" row to §Security table — same trust level, localhost child process -->
- [x] CHK007 - Is the localhost-only constraint explicitly enforced (not just assumed) in the spec? [Clarity, Spec §Security Considerations]
  <!-- REMEDIATED: Updated mitigation to specify programmatic enforcement via config port -->
- [x] CHK008 - Are input validation requirements specified for tool name slugification (what characters are allowed/rejected)? [Clarity, Spec §Security Considerations]
  <!-- REMEDIATED: FR-004 now specifies: lowercase, [a-z0-9-], max 64 chars, collapse hyphens -->

### Error Handling [Constitution §Error Handling]

- [x] CHK009 - Are all failure modes specified with user-facing messages? [Completeness, Spec §Error Scenarios]
  <!-- 6 error scenarios (including new init failure) with user messages in Error Scenarios table -->
- [x] CHK010 - Are user-facing error messages actionable (tell user what went wrong AND what to do)? [Clarity, Constitution §Error Handling]
  <!-- REMEDIATED: Updated all error messages to include actionable guidance -->
- [x] CHK011 - Is fallback behavior defined for the critical path of tool invocation failure? [Coverage, Spec §Error Scenarios]
  <!-- Recovery actions defined for all error scenarios -->
- [x] CHK012 - Is it specified that McpBridgeService initialization failure MUST NOT crash the application? [Completeness, Constitution §Error Handling]
  <!-- REMEDIATED: Added init failure row to Error Scenarios table with "MUST NOT crash" -->

### Data & State [Constitution §Data & State]

- [x] CHK013 - Is the state management approach documented (ephemeral tool definitions, FlowMetadata.params persistence)? [Completeness, Spec §Data & State]
  <!-- §Data & State: ephemeral tools, sequential event processing -->
- [x] CHK014 - Is the persistent data location documented (`~/.slashbot/nodered/flow-metadata.json`)? [Completeness, Constitution §Data & State]
  <!-- REMEDIATED: Added persistent data path to §Data & State -->
- [x] CHK015 - Is it specified that no sensitive data (keys, tokens) flows through the bridge? [Coverage, Constitution §Data & State]
  <!-- REMEDIATED: Added "Sensitive data" row to §Security table -->
- [x] CHK016 - Is schema change handling specified for the `FlowMetadata.params` addition (backward compatibility)? [Completeness, Constitution §Data & State]
  <!-- Clarifications: "No migration needed — absent field treated as {}" -->

### Development Principles

#### Test-First (TDD) [Constitution §Test-First]

- [x] CHK017 - Are unit test requirements specified for McpBridgeService core logic? [Completeness, Plan §Phase 2 Approach]
  <!-- Plan §Phase 2: unit tests for each capability -->
- [x] CHK018 - Are integration test requirements specified for event-driven registration flows? [Completeness, Plan §Phase 2 Approach]
  <!-- Plan §Phase 2: integration tests for event-driven flows -->

#### Plugin-First [Constitution §Plugin-First]

- [x] CHK019 - Is all feature logic contained within the nodered plugin (no core feature logic)? [Consistency, Plan §Constitution Check]
  <!-- Plan confirms: extends existing nodered plugin; core gets only Registry.delete() and unregisterTool() -->
- [x] CHK020 - Are plugin dependencies declared correctly (no new plugin manifest needed)? [Completeness, Spec §Clarifications]
  <!-- Clarification: "No new plugin manifest needed" -->

#### Library-First [Constitution §Library-First]

- [x] CHK021 - Is McpBridgeService designed as a standalone, injectable, testable service separate from plugin wiring? [Completeness, Plan §Architecture Alignment]
  <!-- Plan §Architecture Alignment: Library-First ALIGNED -->

#### Simplicity (YAGNI) [Constitution §Simplicity]

- [x] CHK022 - Are deferred features clearly marked and excluded from scope (FR-011 streaming)? [Clarity, Spec §FR-011]
  <!-- FR-011 strikethrough + "Deferred" label -->
- [x] CHK023 - Are there any speculative features or "just in case" configuration options? [Coverage]
  <!-- No speculative features found -->

### Business Constraints [Constitution §Compliance]

- [x] CHK024 - Are all new dependencies MIT-compatible (or confirmed: no new dependencies)? [Completeness, Plan §Constitution Check]
  <!-- Plan: "No new dependencies" -->
- [x] CHK025 - Is it confirmed that no user data is transmitted externally beyond localhost Node-RED? [Coverage, Constitution §Privacy]
  <!-- Spec + Plan: localhost-only, no external transmission -->

### Quality Standards [Constitution §Quality Standards]

- [x] CHK026 - Is TypeScript strict mode specified for all new code? [Consistency, Constitution §Quality Standards]
  <!-- Plan: "TypeScript (strict mode)" -->
- [x] CHK027 - Are documentation requirements specified for the new tool registration API (`unregisterTool`)? [Completeness, Constitution §Quality Standards]
  <!-- REMEDIATED: Added FR-012 requiring JSDoc for unregisterTool and Registry.delete -->

---

## Architecture Alignment [Registry]

### Established Patterns [Registry §Patterns]

- [x] CHK028 - Does the plan use the Plugin-First Architecture pattern (extends existing plugin, no core feature logic)? [Consistency, Registry §Patterns]
  <!-- Plan §Architecture Alignment: Plugin-First ALIGNED -->
- [x] CHK029 - Does the plan follow Library-First Development (McpBridgeService as injectable service)? [Consistency, Registry §Patterns]
  <!-- Plan §Architecture Alignment: Library-First ALIGNED -->
- [x] CHK030 - Does the plan use the Typed Event Bus for flow lifecycle events? [Consistency, Registry §Patterns]
  <!-- Plan §Architecture Alignment: Typed Event Bus ALIGNED -->
- [x] CHK031 - Does the plan use AI SDK Tool Integration for Zod-schema tool definitions? [Consistency, Registry §Patterns]
  <!-- Plan §Architecture Alignment: AI SDK Tool Integration ALIGNED -->
- [x] CHK032 - Does the plan use Contribution-Based Extension (`registerTool`/`unregisterTool`)? [Consistency, Registry §Patterns]
  <!-- Plan §Architecture Alignment: Contribution-Based Extension ALIGNED -->

### Technology Decisions [Registry §Technology]

- [x] CHK033 - Are technology choices aligned with the registry (Bun, TypeScript strict, InversifyJS, Zod v4, Vitest)? [Consistency, Registry §Technology]
  <!-- Plan §Technical Context matches registry stack -->

### Anti-Patterns [Registry §Anti-Patterns]

- [x] CHK034 - Is there any feature logic in the core engine (should be plugin-only)? [Consistency, Registry §Anti-Patterns]
  <!-- Core only gets infrastructure methods (delete, unregisterTool) — no feature logic -->
- [x] CHK035 - Are there any direct cross-plugin imports (should use EventBus/DI)? [Consistency, Registry §Anti-Patterns]
  <!-- Uses EventBus + DI exclusively -->
- [x] CHK036 - Is there any use of `any` without justification in the plan? [Consistency, Registry §Anti-Patterns]
  <!-- No `any` usage in plan -->
- [x] CHK037 - Does the plan avoid bypassing the action parser / tool registry pipeline? [Consistency, Registry §Anti-Patterns]
  <!-- Uses registerTool/unregisterTool pipeline -->

### New Patterns [Registry §Divergence]

- [x] CHK038 - Are new patterns (Dynamic Tool Lifecycle, Full Teardown + Re-scan) justified with documented rationale? [Completeness, Plan §New Patterns Introduced]
  <!-- Plan §New Patterns: both justified with rationale -->
- [x] CHK039 - Is a registry update planned after implementation for new patterns? [Completeness, Plan §New Patterns Introduced]
  <!-- Plan: "YES — add to registry after implementation" -->

---

## Spec Completeness & Clarity

- [x] CHK040 - Are all functional requirements (FR-001 through FR-012) unambiguous and independently testable? [Clarity, Spec §Requirements]
  <!-- REMEDIATED: FR-004 slugification, FR-007 timeout, FR-008 diff strategy all clarified -->
- [x] CHK041 - Is the tool naming derivation rule (`nodered:<slugified-label>`) fully specified (slugification algorithm, max length, allowed characters)? [Clarity, Spec §FR-004]
  <!-- REMEDIATED: FR-004 now specifies algorithm, [a-z0-9-], max 64 chars -->
- [x] CHK042 - Is the `ParamDescriptor` type fully specified with all fields and their semantics? [Completeness, Spec §FR-005]
  <!-- Clarifications + FR-005: { type, description?, required? } -->
- [x] CHK043 - Is the diff-based reconciliation strategy for `flow:updated` events sufficiently specified (what constitutes "changed")? [Clarity, Spec §FR-008]
  <!-- REMEDIATED: FR-008 now defines "changed" = URL, method, params, or label differs -->
- [x] CHK044 - Are all acceptance scenarios traceable to functional requirements? [Consistency, Spec §User Scenarios]
  <!-- All scenarios map to FR-001 through FR-010 -->
- [x] CHK045 - Is the timeout value for flow invocation specified (FR-007 mentions timeout but no duration)? [Measurability, Spec §FR-007]
  <!-- REMEDIATED: FR-007 now specifies 30s default, overridable via FlowMetadata.timeout -->

---

## Notes

- All 45 items validated and passing after remediation (2026-02-25)
- CHK001 pre-checked: accessibility N/A is justified in plan
- 15 items required spec remediation (5 FAIL + 10 PARTIAL → all now PASS)
- Spec changes: FR-004 (slugification), FR-007 (timeout), FR-008 (diff definition), FR-012 (new), §Security (5 rows), §Error Scenarios (+1 row, improved messages), §Data & State (+persistent path), §Performance (measurement + degradation)
- 45 items total (soft cap 40 exceeded by 5 due to all-domain consolidation)
