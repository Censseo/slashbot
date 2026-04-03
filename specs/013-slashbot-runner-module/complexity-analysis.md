# Complexity Analysis

**Feature**: slashbot-runner-module (013)
**Date**: 2026-04-03
**Source**: tasks.md

---

## Evaluation Criteria

| Criteria | DIRECT (implement directly) | BREAKDOWN (needs breakdown first) |
|----------|-----------------------------|----------------------------------|
| Task count | ≤ 8 tasks | > 8 tasks |
| Cross-domain scope | 1–2 domains | 3+ domains (backend+frontend+DB) |
| Dependency density | Mostly parallel [P] tasks | Many sequential dependency chains |
| Reuse complexity | REUSE/NEW only | REFACTOR or complex EXTEND tasks |

A phase **needs breakdown** if it meets 2 or more BREAKDOWN criteria.

---

## Phase Analysis

| Phase | Name | Tasks | Domains | Sequential Chains | Reuse Types | Verdict |
|-------|------|-------|---------|-------------------|-------------|---------|
| 1 | Setup | 4 | 1 (build config) | 1 (T001→T002) | NEW | **DIRECT** |
| 2 | Type Definitions | 2 | 1 (backend/types) | 1 (T005→T006) | NEW | **DIRECT** |
| 3 | Plugin Registry | 2 | 1 (backend/src) | 1 (T007→T008) | NEW | **DIRECT** |
| 4 | Runner Core | 3 | 1 (backend/src) | 2 (T009→T010→T011) | NEW | **DIRECT** |
| 5 | Build Target | 4 | 1 (build/compat) | 2 (T012→T013→T014*→T015) | NEW + EXTEND | **DIRECT** |
| 6 | Polish | 5 | 1 (backend/src) | 1 (T018→T020) | EXTEND | **DIRECT** |

*T014 is conditional (only if T013 finds issues)

---

## Detailed Phase Assessment

### Phase 1: Setup (4 tasks)

- **Task count**: 4 ≤ 8 ✅ DIRECT
- **Cross-domain scope**: 1 domain (build config + directory structure) ✅ DIRECT
- **Dependency density**: T003 and T004 are parallel; T001→T002 are sequential but trivial ✅ DIRECT
- **Reuse complexity**: All NEW — creating empty files and scripts ✅ DIRECT

**Verdict: DIRECT** — Straightforward scaffolding, no decision-making required.

---

### Phase 2: Foundational — Type Definitions (2 tasks)

- **Task count**: 2 ≤ 8 ✅ DIRECT
- **Cross-domain scope**: 1 domain (TypeScript types + Zod schema) ✅ DIRECT
- **Dependency density**: 1 sequential chain (test→implement), both small files ✅ DIRECT
- **Reuse complexity**: All NEW — types defined from contracts/runner-types.ts ✅ DIRECT

**Verdict: DIRECT** — Mechanical translation of contracts/runner-types.ts into implementation. Contract file is already written; implementation follows spec exactly.

---

### Phase 3: User Story 2 — Plugin Registry (2 tasks)

- **Task count**: 2 ≤ 8 ✅ DIRECT
- **Cross-domain scope**: 1 domain (backend TypeScript class) ✅ DIRECT
- **Dependency density**: 1 chain (T007→T008), trivial ✅ DIRECT
- **Reuse complexity**: NEW — PluginRegistry is a new class with no external dependencies ✅ DIRECT

**Verdict: DIRECT** — Simplest phase. `PluginRegistry` is a small, self-contained class (~30 lines). No external dependencies.

---

### Phase 4: User Story 1 — Runner Core (3 tasks)

- **Task count**: 3 ≤ 8 ✅ DIRECT
- **Cross-domain scope**: 1 domain (backend TypeScript) ✅ DIRECT
- **Dependency density**: 1 sequential chain (T009→T010→T011); T010 depends on T008 (registry) ✅ DIRECT
- **Reuse complexity**: NEW — `SlashbotRunner` uses `PluginRegistry` (created in Phase 3) ✅ DIRECT

**Verdict: DIRECT** — Core logic is an async generator with Zod validation and a try/catch. No complex orchestration. The concurrency test (10 calls) is asserting the existing design's property, not adding complexity.

---

### Phase 5: User Story 3 — Build Target (4 tasks)

- **Task count**: 4 ≤ 8 ✅ DIRECT
- **Cross-domain scope**: 1–2 domains (build tooling + Node.js compat) — borderline but same codebase ✅ DIRECT
- **Dependency density**: T012→T013→T014(conditional)→T015; T014 only if issues found ✅ DIRECT
- **Reuse complexity**: EXTEND (modifying package.json build scripts); NEW for compat test ✅ DIRECT

**Verdict: DIRECT** — The main risk here (native module compat) is addressed by T014 being conditional. If `bun build --target=node` works cleanly (expected given no Bun.* APIs in runner module), T014 is skipped entirely.

---

### Phase 6: Polish (5 tasks)

- **Task count**: 5 ≤ 8 ✅ DIRECT
- **Cross-domain scope**: 1 domain (code quality, documentation) ✅ DIRECT
- **Dependency density**: Most tasks are parallel [P]; T018→T020 is a 2-step check ✅ DIRECT
- **Reuse complexity**: EXTEND (adding JSDoc to existing code) ✅ DIRECT

**Verdict: DIRECT** — All polish tasks are low-effort quality gates with no implementation risk.

---

## Summary

- **Direct implement**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6
- **Needs breakdown**: (none)
- **Total phases**: 6
- **Total tasks**: 20 (T001–T020)

### Overall Assessment

This feature is well-scoped for direct implementation across all phases:

- **Smallest phase**: Phase 2 and Phase 3 (2 tasks each) — can be completed in a single implementation session
- **Largest phase**: Phase 6 (5 tasks) — all parallel, no sequential risk
- **Highest risk**: Phase 5 (build target) — T014 conditional on native compat, but mitigated by runner module having zero Bun.* API usage
- **Key blocker**: Phase 2 (types) blocks everything — implement first, verify Zod schema works

### Recommended Implementation Order

1. **Session 1**: Phase 1 + Phase 2 (setup + types) — foundation complete
2. **Session 2**: Phase 3 + Phase 4 (registry + runner core) — MVP deliverable
3. **Session 3**: Phase 5 + Phase 6 (build target + polish) — Feature 02 ready

No `/specforge.breakdown` is needed before `/specforge.implement` for any phase.
