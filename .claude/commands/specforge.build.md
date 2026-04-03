---
description: Macro command that runs breakdown (if needed) and implementation for all phases, followed by code review and corrections.
semantic_anchors:
  - Kanban                  # Visualize flow, limit WIP, pull system
  - Critical Path Method    # Identify blocking sequences, optimize throughput
  - Boy Scout Rule          # Leave code better than you found it
handoffs:
  - label: QA Validation
    agent: specforge.qa
    prompt: Run the QA validation pipeline for this feature
    send: true
  - label: Re-build Phase
    agent: specforge.build
    prompt: Re-run build for a specific phase
---

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding (if not empty). If user specifies a phase number (e.g., "phase 3"), start from that phase. Otherwise process all phases.

## Outline

This macro command orchestrates the build pipeline: for each phase, optionally break down complex phases, then implement, and finally review and apply corrections.

1. Load tasks.md and complexity-analysis.md
2. For each phase: breakdown if needed, then implement
3. Code review after all phases
4. Add correction tasks to tasks.md
5. Implement corrections

## Detailed Steps

### Step 1: Load Context

Run `.specforge/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse JSON for FEATURE_DIR.

Read:
- `FEATURE_DIR/tasks.md` — full task list
- `FEATURE_DIR/complexity-analysis.md` — phase verdicts from `/specforge.design`

If complexity-analysis.md does not exist, treat ALL phases as DIRECT and log a warning.

Build a phase execution plan from tasks.md phases. Skip phases where all tasks are already marked `[X]`.

Display the plan:

```
Build Execution Plan: {feature-name}

Phase 1: Setup (3 tasks) — DIRECT
Phase 2: Foundation (12 tasks) — BREAKDOWN first
Phase 3: US1 (6 tasks, 2 done) — DIRECT (resume)
...

Starting from Phase {first-incomplete}...
```

### Step 2: Execute Phases

**CRITICAL: This is a continuous loop. You MUST process ALL phases in sequence without stopping or returning control to the user between phases. After each phase completes, IMMEDIATELY proceed to the next one.**

For each phase in order, skip if fully completed:

#### Step 2a: Breakdown (if verdict is BREAKDOWN)

```
Skill: specforge.breakdown
Args: phase {phase_number}
```

Verify task-plans/ directory has plan files for the phase. If breakdown failed, log warning and proceed to implement anyway.

#### Step 2b: Implement

```
Skill: specforge.implement
Args: phase {phase_number} --auto-continue
```

**After each phase (then IMMEDIATELY continue to next phase):**
- Read tasks.md to verify completion status
- If tasks failed or have blockers in task-results/:
  - Log failures
  - Continue to next phase (do not stop the pipeline for individual task failures)
- Log: `Phase {N}: {name} — {completed}/{total} tasks complete`
- **Do NOT stop here. Proceed to the next incomplete phase immediately.**

### Step 3: Code Review

After all phases are implemented:

```
Skill: specforge.review
Args: Update tasks.md with review action items. Generate a review report in reviews/. Apply task updates directly.
```

Read the review report. Extract health score and critical issues count.

### Step 4: Correction Phase

If the review identified issues:

#### Step 4a: Verify corrections in tasks.md

The review should have added a correction phase to tasks.md. If it didn't, read the review report and manually append correction tasks to tasks.md based on HIGH and CRITICAL findings.

#### Step 4b: Implement corrections

```
Skill: specforge.implement
Args: Execute the review correction tasks only (the last phase in tasks.md). Do not re-implement earlier phases.
```

### Step 5: Report

```markdown
## Build Pipeline Complete

**Feature**: {feature-name}
**Branch**: {branch-name}

### Phase Results

| Phase | Name | Tasks | Completed | Breakdown | Status |
|-------|------|-------|-----------|-----------|--------|

### Review Results
- Health score: {score}/100
- Critical issues: {count} ({resolved} resolved)
- Corrections applied: {count}/{total}

### Next Step
Run `/specforge.qa` to validate the implementation end-to-end.
```

## Error Handling

- **Missing tasks.md**: STOP — run `/specforge.design` first
- **Missing complexity-analysis.md**: WARN, treat all phases as DIRECT
- **Phase implementation failure**: Log and continue to next phase
- **Review failure**: Log error, skip corrections, report to user
