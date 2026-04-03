# Pre-Implementation Checklist: Gateway API Extensions

**Purpose**: Validate spec, plan, and design quality before implementation
**Created**: 2026-03-09
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md)

## Constitution Compliance

### Accessibility [Constitution §Accessibility]
- [x] CHK001 - This is a backend API feature with no TUI/UI components — accessibility section correctly omitted or marked N/A? [Constitution §Accessibility]

### Performance [Constitution §Performance]
- [x] CHK002 - Are all performance targets quantified with measurable values (no vague terms)? [Constitution §Performance, Spec §Performance]
- [x] CHK003 - Does the streaming output requirement align with constitution's 200ms first-chunk target? [Constitution §Performance]
- [x] CHK004 - Are performance degradation scenarios specified (e.g., large concurrent connections, slow LLM)? [Constitution §Performance, Coverage]

### Security [Constitution §Security]
- [x] CHK005 - Is the authentication model documented for all new endpoints? [Constitution §Security, Spec §Security]
- [x] CHK006 - Is input validation specified at the chat request boundary? [Constitution §Security, Spec §FR-008]
- [x] CHK007 - Is path traversal prevention documented for static file serving? [Constitution §Security, Spec §Security]
- [x] CHK008 - Are sensitive data handling rules followed (no tokens in logs/LLM context)? [Constitution §Security]

### Error Handling [Constitution §Error Handling]
- [x] CHK009 - Are failure modes specified for all endpoints with user-facing messages? [Constitution §Error Handling, Spec §Error Scenarios]
- [x] CHK010 - Is fallback behavior defined for LLM API failures during chat streaming? [Constitution §Error Handling]
- [x] CHK011 - Are error messages actionable (tell user what went wrong + recovery)? [Constitution §Error Handling]
- [x] CHK012 - Does plugin init failure handling follow constitution (disable, don't crash)? [Constitution §Error Handling]

### Data & State [Constitution §Data & State]
- [x] CHK013 - Is the stateless design documented (no new persistence)? [Constitution §Data & State]
- [x] CHK014 - Are session lifecycle and cleanup rules specified? [Constitution §Data & State, Spec §FR-011]

### Test-First (TDD) [Constitution §TDD]
- [x] CHK015 - Does the plan include test files for each handler? [Constitution §TDD, Plan §Source Code]
- [x] CHK016 - Are testable acceptance criteria defined for each user story? [Constitution §TDD, Spec §User Scenarios]

### Plugin-First Architecture [Constitution §Plugin-First]
- [x] CHK017 - Is the feature implemented as a plugin (not core logic)? [Constitution §Plugin-First, Plan §Summary]
- [x] CHK018 - Does the plan use plugin contribution API (registerHttpRoute, registerGatewayMethod)? [Constitution §Plugin-First]
- [x] CHK019 - Is the gateway core change minimal and infrastructure-level only? [Constitution §Plugin-First]

### Library-First [Constitution §Library-First]
- [x] CHK020 - Are handlers/services separable from the plugin wrapper? [Constitution §Library-First, Plan §Source Code]

### Simplicity (YAGNI) [Constitution §Simplicity]
- [x] CHK021 - Are only needed features included (no speculative config options)? [Constitution §Simplicity]
- [x] CHK022 - Is the number of new files/abstractions justified? [Constitution §Simplicity]

## Architecture Alignment

### Pattern Compliance [Registry §Patterns]
- [x] CHK023 - Does the plan follow Plugin-First Architecture (ADR-001)? [Registry §Patterns]
- [x] CHK024 - Does session management reuse Session-Scoped Context pattern? [Registry §Patterns]
- [x] CHK025 - Does gateway method registration follow Gateway Method Registration pattern? [Registry §Patterns]
- [x] CHK026 - Are new patterns (static file fallback, SSE handler) documented for registry update? [Registry §Patterns]

### Technology Alignment [Registry §Technology]
- [x] CHK027 - Does the plan use TypeScript strict mode on Bun? [Registry §Technology]
- [x] CHK028 - Does validation use Zod v4 for request schemas? [Registry §Technology]
- [x] CHK029 - Does testing use Vitest? [Registry §Technology]

### Anti-Pattern Avoidance [Registry §Anti-Patterns]
- [x] CHK030 - No feature logic placed in core engine? [Registry §Anti-Patterns]
- [x] CHK031 - No direct cross-plugin imports? [Registry §Anti-Patterns]
- [x] CHK032 - No untyped `any` usage in plan/design? [Registry §Anti-Patterns]

## Specification Quality

### Completeness [Spec]
- [x] CHK033 - Are all 12 functional requirements traceable to user stories? [Completeness, Spec §Requirements]
- [x] CHK034 - Are edge cases documented with expected behavior? [Completeness, Spec §Edge Cases]
- [x] CHK035 - Is CORS behavior specified? [Completeness, Spec §FR-009]

### Clarity [Spec]
- [x] CHK036 - Are SSE event types clearly defined with payload structure? [Clarity, Spec §FR-002]
- [x] CHK037 - Is the static file auth exemption clearly scoped (which paths)? [Clarity, Spec §FR-007]
- [x] CHK038 - Is the session creation vs reuse behavior unambiguous? [Clarity, Spec §FR-011]

### Consistency [Spec + Plan]
- [x] CHK039 - Are the API paths in spec consistent with contracts/api.md? [Consistency]
- [x] CHK040 - Are stream event types consistent between spec, data-model, and contracts? [Consistency]

## Deviation Check

- [x] CHK041 - Is the toDataStream() → AgentLoopCallbacks divergence justified in plan? [Deviation, Plan §Source Idea Alignment]
- [x] CHK042 - Is the gateway extension (static file fallback) justified as infrastructure-level? [Deviation, Plan §Constitution Check]
