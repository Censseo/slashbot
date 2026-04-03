---
description: Configure skills based on detected project frameworks
---

## User Input

```text
$ARGUMENTS
```

## Purpose

Detect project technology stack and create framework-specific skills.

---

## Phase 1: Detection

Run `.specforge/scripts/bash/setup-hooks.sh --json --agent-dir .claude` and parse:

```json
{
  "DETECTED_FRAMEWORKS": [
    {"name": "react", "docs_url": "...", "github_url": "..."},
    {"name": "next", "docs_url": "...", "github_url": "..."}
  ],
  "SKILLS_DIR": "/path/to/.claude/skills"
}
```

---

## Phase 2: Generate Skills

For each detected framework, create a skill file in `{SKILLS_DIR}/`:

### Skill Template

```markdown
---
name: {framework}-patterns
description: {Framework} best practices and patterns for this project
---

# {Framework} Patterns

## Conventions
[Extracted from codebase or framework defaults]

## Best Practices
[Framework-specific guidance]

## Common Patterns
[Code examples from project or defaults]
```

### Skill Categories

| Category | Skill Example | Source |
|----------|---------------|--------|
| Frontend | react-patterns, vue-conventions | Detected frameworks |
| Backend | express-patterns, fastapi-usage | Detected frameworks |
| Database | prisma-patterns, typeorm-usage | Detected ORM |
| Testing | jest-conventions, pytest-patterns | Detected test tools |

---

## Completion

```markdown
## Skills Setup Complete

### Skills Created
| Skill | Framework | Path |
|-------|-----------|------|
| {skill} | {framework} | {path} |

### Next Steps
- Review generated skills
- Add project-specific conventions
- Run /specforge.setup-agents to use skills in agents
```
