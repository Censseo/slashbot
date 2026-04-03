---
description: Macro command that runs the full design pipeline from specification through task generation with automated quality checks.
semantic_anchors:
  - Pipeline Orchestration  # Sequential stage execution with gates
  - Fail Fast               # Detect issues early, abort on critical failures
  - Convention over Configuration  # Apply defaults for non-interactive steps
handoffs:
  - label: Build Implementation
    agent: specforge.build
    prompt: Run the build pipeline for this feature
    send: true
  - label: Re-run Design
    agent: specforge.design
    prompt: Re-run the design pipeline with adjustments
---

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding (if not empty).

## Outline

This macro command orchestrates the full design pipeline: specify, clarify, plan, checklist, tasks, and analyze. It runs non-interactively where possible, applying recommended defaults and remediations automatically.

1. Run `/specforge.specify` on user input
2. Run `/specforge.clarify` in non-interactive mode
3. Run `/specforge.plan`
4. Run `/specforge.checklist` (pre-implementation + review with auto-remediation)
5. Run `/specforge.tasks`
6. Run `/specforge.analyze` with auto-remediation
7. Perform complexity analysis of tasks.md phases
8. Save complexity analysis and report completion

## Detailed Steps

### Step 1: Specify

Invoke the specify sub-command to create the feature specification from user input.

```
Skill: specforge.specify
Args: $ARGUMENTS
```

**Gate check**: Verify spec.md exists and is non-empty. Extract FEATURE_DIR path. If spec creation failed, STOP and report.

### Step 2: Clarify (Non-Interactive)

Run clarification against docs/ and existing implementations.

```
Skill: specforge.clarify
Args: Explore the docs/ and the existing implementations related to this feature to clarify integration points. Raise all unclear points. You are in non-interactive mode: for each question, apply the recommended remediation by default. Do not wait for user input. Apply all clarifications directly to the spec.
```

**Gate check**: Verify spec.md was updated. If clarify found no ambiguities, that is fine — proceed.

### Step 3: Plan

Generate the implementation plan.

```
Skill: specforge.plan
Args: (no additional arguments)
```

**Gate check**: Verify plan.md and research.md exist in FEATURE_DIR. If plan reported architecture divergences needing user approval, STOP and present them.

### Step 4: Checklists — Generate and Auto-Remediate

#### Step 4a: Generate pre-implementation checklists

```
Skill: specforge.checklist
Args: pre-implementation, for all domains, for deviation check and constitution and architecture compliance, single consolidated file. You are in non-interactive mode, if you need user answer, use your recommended answer.
```

#### Step 4b: Review and remediate

```
Skill: specforge.checklist
Args: review. Propose and apply remediation for failing and partial items. You are in non-interactive mode, if you need user answer, use your recommended answer.
```

**Gate check**: If any CRITICAL checklist items remain FAIL after remediation, STOP and report. LOW/MEDIUM warnings are logged and we proceed.

### Step 5: Tasks

Generate the dependency-ordered task list.

```
Skill: specforge.tasks
Args: (no additional arguments)
```

**Gate check**: Verify tasks.md exists in FEATURE_DIR with proper format (T### IDs, checkboxes, phases).

### Step 6: Analyze and Auto-Remediate

Run cross-artifact consistency analysis and apply fixes.

```
Skill: specforge.analyze
Args: propose and apply remediations for all findings. Do not ask the user — apply reasonable fixes directly.
```

**Gate check**: If CRITICAL findings remain after remediation, STOP and report. Otherwise proceed.

### Step 7: Complexity Analysis

Read the final tasks.md and analyze each phase to determine which need `/specforge.breakdown` before `/specforge.implement`.

**Evaluation criteria per phase:**

| Criteria | DIRECT (implement directly) | BREAKDOWN (needs breakdown first) |
|----------|---------------------------|----------------------------------|
| Task count | <= 8 tasks | > 8 tasks |
| Cross-domain scope | 1-2 domains | 3+ domains (backend+frontend+DB) |
| Dependency density | Mostly parallel [P] tasks | Many sequential dependency chains |
| Reuse complexity | REUSE/NEW only | REFACTOR or complex EXTEND tasks |

A phase **needs breakdown** if it meets 2 or more BREAKDOWN criteria.

**Save output** to `FEATURE_DIR/complexity-analysis.md`:

```markdown
# Complexity Analysis

**Feature**: {feature-name}
**Date**: {date}
**Source**: tasks.md

## Phase Analysis

| Phase | Name | Tasks | Domains | Dependencies | Reuse | Verdict |
|-------|------|-------|---------|--------------|-------|---------|
| 1 | ... | N | N | N sequential | types | DIRECT or BREAKDOWN |

## Summary

- **Direct implement**: Phase X, Phase Y
- **Needs breakdown**: Phase Z, Phase W
- **Total phases**: N
```

### Step 8: Report

Output a summary:

```markdown
## Design Pipeline Complete

**Feature**: {feature-name}
**Branch**: {branch-name}

### Artifacts Generated
- spec.md, plan.md, research.md, tasks.md, checklists/, complexity-analysis.md

### Quality Status
- Checklist: {passed}/{total} pass
- Analyze: {critical} critical, {high} high remaining

### Complexity Verdicts
- Direct implement: {phases}
- Needs breakdown: {phases}

### Next Step
Run `/specforge.build` to start implementation.
```
