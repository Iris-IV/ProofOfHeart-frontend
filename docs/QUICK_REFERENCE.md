# Quick Reference

Fast lookup for common development tasks.

## Pre-Commit Checks

**What runs when you commit**:

1. Linting & formatting (auto-fixes)
2. TypeScript type-check
3. Affected tests
4. Commit message validation

**If checks fail**: Fix errors and commit again

**Skip checks** (not recommended): `git commit --no-verify`

**Docs**: [PRE_COMMIT_CHECKS.md](./PRE_COMMIT_CHECKS.md)

## Commit Message Format

```
<type>(<scope>): <subject>
```

**Types**: feat, fix, docs, style, refactor, perf, test, chore, ci, revert

**Scopes**: auth, contract, ui, api, docs, deps, config, test, ci, perf

**Examples**:

- `feat(auth): add email verification`
- `fix(contract): handle campaign fetch errors`
- `docs: update contributing guide`

**Docs**: [COMMIT_CONVENTIONS.md](./COMMIT_CONVENTIONS.md)

## Development Commands

```bash
# Start dev server
npm run dev

# Lint and format
npm run lint
npm run format
npm run typecheck

# Tests
npm test
npm run test:watch
npm run test:coverage
npm run test:e2e

# Build
npm run build

# Docker
docker-compose up --build
docker-compose down
```

## Dev Mock Panel

**Enable**: `NEXT_PUBLIC_USE_MOCKS=true npm run dev`

**Access**: Click ⚙️ Mock button (bottom-right)

**Scenarios**: Active, Verified, Funded, Cancelled, Failed, Empty, Error

**Docs**: [DEV_MOCK_PANEL.md](./DEV_MOCK_PANEL.md)

## Branch Naming

```
feat/<short-description>
fix/<short-description>
docs/<short-description>
test/<short-description>
chore/<short-description>
```

**Examples**:

- `feat/email-opt-in`
- `fix/admin-audit-log-panel`

## PR Checklist

- [ ] Branch up to date with `main`
- [ ] PR title follows Conventional Commits
- [ ] All commits follow Conventional Commits
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm run typecheck` passes
- [ ] Tests pass (`npm test` and/or `npm run test:e2e`)
- [ ] New behavior documented
- [ ] PR description explains changes

## Troubleshooting

### Pre-commit checks failing?

```bash
# See what failed
npm run lint
npm run typecheck
npm test

# Fix and try again
git add .
git commit -m "..."
```

### Type errors?

```bash
npm run typecheck
# Fix the errors in your code
```

### Test failures?

```bash
npm test
# Fix the failing tests
```

### Commit message rejected?

```bash
git commit --amend
# Follow Conventional Commits format
```

## Environment Setup

Create `.env.local`:

```env
NEXT_PUBLIC_USE_MOCKS=true
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL=
```

## Useful Links

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Full contribution guide
- [PRE_COMMIT_CHECKS.md](./PRE_COMMIT_CHECKS.md) - Pre-commit details
- [COMMIT_CONVENTIONS.md](./COMMIT_CONVENTIONS.md) - Commit format
- [DEV_MOCK_PANEL.md](./DEV_MOCK_PANEL.md) - Mock panel guide
- [DEV_TOOLS.md](./DEV_TOOLS.md) - Developer tools

## Performance Tips

- **Commit smaller changes**: Faster pre-commit checks
- **Run tests during development**: `npm run test:watch`
- **Use dev mock panel**: Test UI states without code changes
- **Skip checks sparingly**: Only for WIP commits

## Getting Help

1. Check relevant docs (links above)
2. Search existing issues/PRs
3. Ask in discussions or open an issue
4. See [CONTRIBUTING.md](../CONTRIBUTING.md) for more
