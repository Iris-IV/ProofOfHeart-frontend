# Contributing to ProofOfHeart Frontend

Thanks for contributing. This guide covers local setup, workflow expectations, and pre-PR checks.

## 1) Local Setup

### Prerequisites

- Node.js `>=22`
- npm `>=10`
- Git
- (Optional) Docker + Docker Compose

### Clone and install

```bash
git clone https://github.com/Iris-IV/ProofOfHeart-frontend.git
cd ProofOfHeart-frontend
npm ci
```

### `npm ci` vs `npm install`

- Use `npm ci` for clean, reproducible installs (CI and normal contributor flow).
- Use `npm install` only when intentionally adding/updating dependencies and lockfile entries.

## 2) Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_USE_MOCKS=true
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL=
```

Notes:

- Keep `NEXT_PUBLIC_USE_MOCKS=true` for local development unless you are testing against a live contract.
- `NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL` is optional and used only for off-chain creator email opt-in events.
- Never commit `.env.local`.

## 3) Development Commands

### Start dev server

```bash
npm run dev
```

### Lint, format, and typecheck

```bash
npm run lint
npm run format:check
npm run typecheck
```

### Auto-format

```bash
npm run format
```

### Unit/integration tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### E2E tests

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
```

## 4) Pre-Commit Checks

When you commit, the following checks run automatically via husky:

1. **Linting & Formatting** (lint-staged)
   - ESLint on staged `.ts`, `.tsx`, `.js`, `.jsx` files
   - Prettier on staged files
   - Auto-fixes issues where possible

2. **TypeScript Type-Check**
   - Runs `tsc --noEmit` on staged TypeScript files
   - Catches type errors before they reach CI

3. **Affected Tests**
   - Runs Jest on test files related to staged changes
   - Finds tests by file name pattern (e.g., `Component.test.tsx`)
   - Uses `--bail` to stop on first failure (fast feedback)

4. **Commit Message Validation** (commitlint)
   - Validates commit message format
   - Enforces Conventional Commits

### What Happens If Checks Fail

If any check fails, the commit is rejected. You'll see:

```
✗ Type-check failed
✗ Tests failed
```

**Fix the errors** and try committing again. The checks will re-run on the same staged files.

### Skipping Checks (Not Recommended)

To skip pre-commit checks (use sparingly):

```bash
git commit --no-verify
```

This bypasses all hooks. Use only when absolutely necessary (e.g., WIP commits).

### Performance

Pre-commit checks are optimized for speed:

- **Type-check**: Only checks staged files (not entire codebase)
- **Tests**: Only runs tests related to staged changes
- **Typical time**: 5-15 seconds depending on changes

If checks are too slow, consider:

- Committing smaller, focused changes
- Running `npm run typecheck` and `npm test` separately during development

## 4) Docker Workflow

### Run with docker compose

```bash
docker-compose up --build
```

### Stop stack

```bash
docker-compose down
```

## 5) Branch Naming

Create branches from `main` with descriptive prefixes:

- `feat/<short-description>`
- `fix/<short-description>`
- `docs/<short-description>`
- `test/<short-description>`
- `chore/<short-description>`

Examples:

- `feat/email-opt-in`
- `fix/admin-audit-log-panel`

## 6) Commit Conventions

We enforce **Conventional Commits** format for all commits. This ensures clear, semantic commit history and enables automated changelog generation.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Allowed Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect code meaning (formatting, semicolons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to build process, dependencies, or tooling
- **ci**: Changes to CI/CD configuration files and scripts
- **revert**: Reverts a previous commit

### Allowed Scopes

Scopes are optional but recommended for clarity:

- `auth` - Authentication and authorization
- `contract` - Smart contract integration
- `ui` - User interface components
- `api` - API routes and integrations
- `docs` - Documentation
- `deps` - Dependency updates
- `config` - Configuration files
- `test` - Test infrastructure
- `ci` - CI/CD workflows
- `perf` - Performance optimizations

### Examples

```
feat(auth): add email verification flow
fix(contract): handle campaign fetch errors
docs: update contributing guide
test(ui): add CauseCard component tests
chore(deps): update tailwindcss to 4.3.0
ci: add commitlint enforcement
```

### Rules

- Use lowercase for type and scope
- Use imperative mood ("add" not "added" or "adds")
- Do not end subject with a period
- Keep subject under 100 characters
- Leave a blank line between subject and body
- Wrap body at 100 characters
- Reference issues in footer: `Closes #123` or `Refs #456`

### Validation

Commits are validated:

- **Locally**: Via husky `commit-msg` hook (runs on every commit)
- **In CI**: Via GitHub Actions on pull requests

If a commit message is invalid, you'll see a helpful error message explaining what needs to be fixed.

## 7) Pull Request Conventions

PR titles must follow the same Conventional Commits format as commit messages. This ensures consistency and enables automated changelog generation.

### PR Title Format

```
<type>(<scope>): <description>
```

### Examples

- `feat(auth): add email verification`
- `fix(contract): handle campaign fetch errors`
- `docs: update contributing guide`
- `ci: add commitlint enforcement`

### PR Checklist

Before opening a PR:

- [ ] Branch is up to date with `main`
- [ ] PR title follows Conventional Commits format
- [ ] All commits follow Conventional Commits format
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm run typecheck` passes
- [ ] Relevant tests pass (`npm test` and/or `npm run test:e2e`)
- [ ] New behavior is documented (README/docs) when needed
- [ ] PR description explains what changed, why, and how it was tested
- [ ] Screenshots/GIFs included for UI changes

### Validation

PR titles and commits are validated automatically in CI. If validation fails, you'll see a clear error message explaining what needs to be fixed.

## 8) Testing Guidance

For contract-layer work (`src/lib/contractClient.ts`):

- Cover mock and non-mock branches where possible.
- Validate error mapping paths (`Error(Contract, #N)`).
- Add focused unit tests for serialization/decoding behavior.

For UI work:

- Add/adjust component or integration tests under `src/__tests__/`.
- Ensure localization parity when adding translation keys (`messages/en.json` and `messages/es.json`).

## 9) Opening Issues and PRs

- Search existing issues/PRs first to avoid duplicates.
- Link related issues in your PR body (`Closes #123`).
- Keep discussion respectful and technical.

Thanks again for helping move ProofOfHeart forward.
