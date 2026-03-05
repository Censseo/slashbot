# Claude Command: Commit

This command creates well-formatted commits for the Slashbot project, with strict separation between **public** and **private** files to facilitate cherry-picking.

## Usage

```
/commit
/commit --no-verify
/commit --private-only
/commit --public-only
```

## Dual-Repo Architecture

This project uses two remotes:

| Remote | Repo | Content |
|--------|------|---------|
| `origin` | Censseo/slashbot (public fork) | Source code only |
| `private` | Censseo/slashbot-private | Source code + internal tooling |
| `upstream` | zorgspace/slashbot | Original upstream |

### Private files (internal tooling)

These files are listed in `.git/info/exclude` and MUST NEVER appear in commits pushed to `origin`:

```
.specforge/
.claude/
.mcp/
specs/
ideas/
docs/
CLAUDE.md
AGENTS.md
spec.md
README.md
src/**/CLAUDE.md
src/**/AGENTS.md
```

### Public files (everything else)

All other files: `src/**/*.ts`, `package.json`, `tsconfig.json`, config files, etc.

## What This Command Does

### Step 1: Disable exclusions in `.git/info/exclude`

The private files are hidden from git by `.git/info/exclude`. To see ALL changes, **comment out every non-comment line** using the Edit tool:

```
# Before (active exclusions):
.specforge/
.claude/

# After (disabled):
#.specforge/
#.claude/
```

This MUST be done BEFORE any `git status` or `git add` involving private files, otherwise git will refuse to stage them.

### Step 2: Assess all changes

Run `git status` to see the full picture of modified/untracked files (both public and private).

### Step 3: Classify files

Split all changed files into two groups:

- **Private files**: anything matching the patterns listed in the Private files section above
- **Public files**: everything else

### Step 4: Commit public files FIRST (if any)

1. **Restore exclusions** in `.git/info/exclude` (uncomment the patterns) so private files are hidden again
2. Unless `--no-verify` is specified, run pre-commit checks:
   - `bun run typecheck`
   - `npm run lint`
   - `npm run test`
3. Stage only public files with `git add`
4. Commit with conventional commit message
5. Push to BOTH `origin` and `private` (current branch)

### Step 5: Commit private files (if any)

1. **Disable exclusions again** in `.git/info/exclude` (comment out the patterns) so git can see the private files
2. Stage only private files with `git add`
3. Commit with conventional commit message, prefixed with scope `(internal)`:
   - Example: `🔧 chore(internal): update spec and tooling`
4. Push to `private` ONLY (NEVER to `origin`)

### Step 6: Restore exclusions

**Always restore** the exclusions in `.git/info/exclude` at the end (uncomment the patterns), even if something failed. This prevents accidentally staging private files in future manual git operations.

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

Beyond the mandatory public/private split, also split when:

1. **Different concerns**: Changes to unrelated parts of the codebase
2. **Different types**: Mixing features, fixes, refactoring
3. **Logical grouping**: Changes easier to understand separately

## Examples

### Typical session with both public and private changes:

```
# Commit 1 (public) - pushed to origin + private
✨ feat(nodered): add NodeRedManager lifecycle service

# Commit 2 (private) - pushed to private only
🔧 chore(internal): update nodered spec and task checklist
```

### Cherry-pick workflow (for reference):

```bash
# On the public fork, cherry-pick only public commits:
git checkout master
git cherry-pick <public-commit-hash>
git push origin master
```

## Command Options

- `--no-verify`: Skip pre-commit checks (typecheck, lint, test)
- `--private-only`: Only commit private/internal files
- `--public-only`: Only commit public files

## Important Notes

- **NEVER mix public and private files** in the same commit
- **NEVER push private commits to `origin`** (public fork)
- Pre-commit checks (`typecheck`, `lint`, `test`) only run for public file commits
- If no files are staged, the command auto-stages all modified files (respecting the public/private split)
- Always push public commits to both remotes so `private` stays in sync
