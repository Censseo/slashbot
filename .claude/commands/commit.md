# Claude Command: Commit

This command creates well-formatted commits for the Slashbot project and pushes to `private`.

## Usage

```
/commit
/commit --no-verify
```

## What This Command Does

### Step 1: Assess all changes

Run `git status` to see the full picture of modified/untracked files.

### Step 2: Commit

Unless `--no-verify` is specified, run pre-commit checks:
- `bun run typecheck`
- `npm run lint`
- `npm run test`

Stage files, commit with a conventional commit message, then push to `private`.

## Commit Message Format

Use emoji conventional commit format:

- `<emoji> <type>(<scope>): <description>`
- First line under 72 characters
- Present tense, imperative mood

### Common emojis

| Emoji | Type | Usage |
|-------|------|-------|
| ✨ | `feat` | New feature |
| 🐛 | `fix` | Bug fix |
| ♻️ | `refactor` | Code refactoring |
| ⚡️ | `perf` | Performance |
| ✅ | `test` | Tests |
| 🔧 | `chore` | Tooling, config |
| 📝 | `docs` | Documentation |
| 🏗️ | `refactor` | Architecture |
| 🏷️ | `feat` | Types |
| 👔 | `feat` | Business logic |
| 🚑️ | `fix` | Critical hotfix |
| 🔒️ | `fix` | Security |
| 🩹 | `fix` | Minor fix |
| 🔥 | `fix` | Remove code/files |
| 💚 | `fix` | Fix CI |

## Guidelines for Splitting Commits

Split when:

1. **Different concerns**: Changes to unrelated parts of the codebase
2. **Different types**: Mixing features, fixes, refactoring
3. **Logical grouping**: Changes easier to understand separately

## Command Options

- `--no-verify`: Skip pre-commit checks (typecheck, lint, test)
