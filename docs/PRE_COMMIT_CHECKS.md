# Pre-Commit Checks

Automated checks that run before each commit to catch errors early.

## Overview

When you run `git commit`, husky automatically runs:

1. **Linting & Formatting** (lint-staged)
2. **TypeScript Type-Check** (tsc)
3. **Affected Tests** (jest)
4. **Commit Message Validation** (commitlint)

All checks must pass before the commit is created.

## What Each Check Does

### 1. Linting & Formatting (lint-staged)

**What**: ESLint + Prettier on staged files

**Files**: `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.json`, `*.css`, `*.md`

**Auto-fixes**: Yes (eslint --fix, prettier --write)

**Time**: ~2-5 seconds

```bash
# Manually run
npx lint-staged
```

### 2. TypeScript Type-Check

**What**: Runs `tsc --noEmit` on staged TypeScript files

**Files**: `*.ts`, `*.tsx` (staged only)

**Auto-fixes**: No (requires manual fixes)

**Time**: ~3-10 seconds

**Example error**:

```
src/components/Button.tsx:15:5 - error TS2322: Type 'string' is not assignable to type 'number'.
```

```bash
# Manually run
npm run typecheck

# Or on specific files
npx tsc --noEmit src/components/Button.tsx
```

### 3. Affected Tests

**What**: Runs Jest on test files related to staged changes

**Files**: Test files matching staged source files

**Auto-fixes**: No (requires code fixes)

**Time**: ~2-15 seconds (depends on test count)

**How it finds tests**:

- If `Component.ts` is staged, runs `Component.test.ts`
- If `lib/utils.ts` is staged, runs `src/__tests__/lib/utils.test.ts`
- If a test file is staged, runs that test

**Example**:

```
Staged: src/components/Button.tsx
Runs: src/__tests__/components/Button.test.tsx
```

```bash
# Manually run
npm test

# Or specific test file
npx jest src/__tests__/components/Button.test.tsx
```

### 4. Commit Message Validation

**What**: Validates commit message format (Conventional Commits)

**Auto-fixes**: No (requires message rewrite)

**Time**: <1 second

**Example error**:

```
✖  type must be one of [feat, fix, docs, ...] [type-enum]
```

See [COMMIT_CONVENTIONS.md](./COMMIT_CONVENTIONS.md) for format details.

## Typical Workflow

```bash
# Make changes
$ vim src/components/Button.tsx

# Stage changes
$ git add src/components/Button.tsx

# Commit (checks run automatically)
$ git commit -m "feat(ui): add button variant"

# If checks pass:
# ✓ Linting passed
# ✓ Type-check passed
# ✓ Tests passed
# ✓ Commit message valid
# → Commit created

# If checks fail:
# ✗ Type-check failed
# → Commit rejected, fix errors and try again
```

## Handling Failures

### Linting/Formatting Failures

Most are auto-fixed. If not:

```bash
# See what failed
npm run lint

# Fix manually
npm run format
npm run lint -- --fix
```

### Type-Check Failures

Requires manual fixes:

```bash
# See errors
npm run typecheck

# Fix the type errors in your code
# Then try committing again
```

### Test Failures

Requires code fixes:

```bash
# Run tests to see failures
npm test

# Fix the failing tests
# Then try committing again
```

### Commit Message Failures

Rewrite the commit message:

```bash
# Amend the commit message
git commit --amend

# Follow Conventional Commits format
# Then try again
```

## Performance

Pre-commit checks are optimized for speed:

| Check      | Time      | Scope                |
| ---------- | --------- | -------------------- |
| Linting    | 2-5s      | Staged files only    |
| Type-check | 3-10s     | Staged TS files only |
| Tests      | 2-15s     | Affected tests only  |
| **Total**  | **5-30s** | **Typical**          |

### If Checks Are Too Slow

1. **Commit smaller changes**: Fewer files = faster checks
2. **Run checks separately**: `npm run typecheck` and `npm test` during development
3. **Skip checks** (not recommended): `git commit --no-verify`

## Skipping Checks

To bypass all pre-commit checks:

```bash
git commit --no-verify
```

**Use sparingly** - only for WIP commits or emergencies. Checks exist to catch bugs early.

## Configuration

### Husky Hooks

- **Location**: `.husky/pre-commit`
- **Runs**: lint-staged → typecheck → tests → commitlint

### Lint-Staged Config

- **Location**: `.lintstagedrc.json`
- **Defines**: Which files trigger which checks

### TypeScript Config

- **Location**: `tsconfig.json`
- **Defines**: Type-check rules

### Jest Config

- **Location**: `jest.config.ts`
- **Defines**: Test patterns and coverage thresholds

### Commitlint Config

- **Location**: `commitlint.config.js`
- **Defines**: Commit message rules

## Troubleshooting

### "Command not found: npx"

Ensure dependencies are installed:

```bash
npm ci
```

### "No staged files"

Stage files before committing:

```bash
git add src/components/Button.tsx
git commit -m "feat: ..."
```

### "Tests timeout"

Increase timeout or run specific test:

```bash
npx jest --testTimeout=10000 src/__tests__/components/Button.test.tsx
```

### "Type-check passes locally but fails in CI"

Ensure you're using the same Node/TypeScript version:

```bash
node --version  # Should be >=22
npm --version   # Should be >=10
```

## CI Integration

Pre-commit checks are also run in CI:

- **On**: Every pull request
- **Workflow**: `.github/workflows/ci.yml`
- **Checks**: lint, typecheck, test, build

Pre-commit checks catch issues early; CI validates the full build.

## Best Practices

1. **Commit frequently**: Smaller commits = faster checks
2. **Keep tests fast**: Avoid slow tests in pre-commit
3. **Fix issues immediately**: Don't accumulate type errors
4. **Use `--no-verify` sparingly**: Only for WIP commits
5. **Run checks locally**: Don't rely only on CI

## Related Docs

- [COMMIT_CONVENTIONS.md](./COMMIT_CONVENTIONS.md) - Commit message format
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Full contribution guide
- [CI workflow](.github/workflows/ci.yml) - CI checks
