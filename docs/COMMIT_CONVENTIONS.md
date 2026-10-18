# Commit and PR Title Conventions

This document outlines the enforced Conventional Commits format for ProofOfHeart Frontend.

## Quick Reference

### Format

```
<type>(<scope>): <subject>
```

### Valid Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style (formatting, semicolons)
- `refactor` - Code refactoring
- `perf` - Performance improvement
- `test` - Tests
- `chore` - Build/tooling changes
- `ci` - CI/CD changes
- `revert` - Revert previous commit

### Valid Scopes (optional)

- `auth` - Authentication
- `contract` - Smart contract integration
- `ui` - UI components
- `api` - API routes
- `docs` - Documentation
- `deps` - Dependencies
- `config` - Configuration
- `test` - Test infrastructure
- `ci` - CI/CD
- `perf` - Performance

## Examples

### Good Commits

```
feat(auth): add email verification flow
fix(contract): handle campaign fetch errors
docs: update contributing guide
test(ui): add CauseCard component tests
chore(deps): update tailwindcss to 4.3.0
ci: add commitlint enforcement
perf(ui): optimize image loading
```

### Bad Commits

```
added new feature          ❌ Missing type and scope
feat: Add Email            ❌ Capitalized subject
fix(auth): fixed bug.      ❌ Ends with period
feat(auth): add email verification flow that does many things and is very long and exceeds the character limit ❌ Too long
```

## Enforcement

### Local Validation

- **Hook**: `commit-msg` (runs on every commit)
- **Tool**: commitlint
- **When**: Before commit is created
- **Failure**: Commit is rejected with helpful error message

### CI Validation

- **Workflow**: `.github/workflows/commitlint.yml`
- **Checks**:
  1. All commits in PR follow format
  2. PR title follows format
- **When**: On pull request creation/update
- **Failure**: PR check fails with clear error

## Helpful Error Messages

If commitlint validation fails, you'll see messages like:

```
⧖  input: "added new feature"
✖  type must be one of [feat, fix, docs, style, refactor, perf, test, chore, ci, revert] [type-enum]
✖  subject must not end with a period [subject-full-stop]

✖  found 2 problems, 0 warnings
ⓘ  Get help: https://github.com/conventional-changelog/commitlint/#what-is-commitlint
```

## Fixing Invalid Commits

### Before Push

If your commit hasn't been pushed yet, amend it:

```bash
git commit --amend
# Edit the message to follow the format
```

### After Push

If you've already pushed, create a new commit:

```bash
git commit --allow-empty -m "feat(scope): proper message"
git push
```

## PR Titles

PR titles must also follow Conventional Commits format:

```
feat(auth): add email verification
fix(contract): handle campaign fetch errors
docs: update contributing guide
```

This is validated automatically when you open a PR.

## Configuration

- **Config File**: `commitlint.config.js`
- **Husky Hooks**: `.husky/commit-msg` and `.husky/pre-commit`
- **CI Workflow**: `.github/workflows/commitlint.yml`

See `CONTRIBUTING.md` for full details.
