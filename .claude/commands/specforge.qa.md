---
description: Macro command that validates the implementation end-to-end and runs a fix/validate loop up to 3 times if failures are found.
semantic_anchors:
  - ATDD                    # Acceptance Test-Driven Development - executable specs
  - Regression Testing      # Verify unchanged functionality still works
  - Scientific Method       # Hypothesis, experiment, observation, conclusion
handoffs:
  - label: Manual Fix
    agent: specforge.fix
    prompt: Manually diagnose and fix the remaining issues
  - label: Re-validate
    agent: specforge.validate
    prompt: Re-run validation after manual fixes
  - label: Merge Feature
    agent: specforge.merge
    prompt: Merge this feature into main
---

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding (if not empty).

## Outline

This macro command runs end-to-end validation with an automated fix/validate loop.

1. Load test credentials and context
2. Run `/specforge.validate`
3. If partial/failed: `/specforge.fix` then re-validate (loop max 3x)
4. Early exit if no progress between retries
5. Final QA report

## Detailed Steps

### Step 1: Preparation

Run `.specforge/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse JSON for FEATURE_DIR.

Load test credentials from `TEST_USER_CREDENTIALS.md` in project root. Extract usernames, passwords, and service URLs for use during validation.

Initialize state:
- MAX_RETRIES = 3
- current_retry = 0
- validation_status = PENDING
- previous_failure_count = 999

### Step 2: Validation Loop

Repeat while `current_retry <= MAX_RETRIES` and `validation_status != PASSED`:

#### Step 2a: Validate

```
Skill: specforge.validate
Args: Use TEST_USER_CREDENTIALS.md for test users. Run E2E tests via browser. Verify style cohesion. Start the agent-service if needed. Start all required infrastructure. Do not ask for confirmation — proceed with all scenarios.
```

Parse results: extract overall status (PASSED/FAILED/PARTIAL), failure count, list of failing scenarios.

#### Step 2b: Check exit conditions

- If **PASSED**: break loop, go to Step 3
- If `current_retry >= MAX_RETRIES`: log "Max retries reached", break loop
- If failure count >= previous_failure_count (no progress): log "No progress detected, stopping", break loop
- Otherwise: proceed to fix

#### Step 2c: Fix

```
Skill: specforge.fix
Args: Fix the validation failures. Apply fixes directly without asking the user. Focus on the failing acceptance scenarios.
```

Log: `Retry {current_retry}: Applied fixes. Re-validating...`

#### Step 2d: Increment

```
previous_failure_count = current_failure_count
current_retry += 1
```

Loop back to Step 2a.

### Step 3: Final Report

Save to `FEATURE_DIR/qa-report.md` and display:

```markdown
## QA Pipeline Complete

**Status**: {PASSED | FAILED | PARTIAL}
**Validation Rounds**: {current_retry + 1}
**Final Pass Rate**: {rate}%

### Summary
- Scenarios tested: {total}
- Passed: {count}
- Failed: {count}
- Fixed during QA: {count}

### Remaining Failures (if any)
{list with severity and user story}

### Next Steps
{If PASSED:} Feature ready for merge. Run `/specforge.merge`.
{If FAILED:} {count} issues remain. Run `/specforge.fix` manually or `/specforge.qa` after manual fixes.
```

## Error Handling

- **No TEST_USER_CREDENTIALS.md**: Warn but continue
- **Validate fails to start (infra issue)**: Report and stop, status = INCOMPLETE
- **Fix fails**: Log error, increment retry, continue loop
- **No progress between retries**: Break early to avoid wasting time
