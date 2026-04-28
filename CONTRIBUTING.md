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

Use clear, scoped commit messages. Conventional Commit style is recommended:
- `feat: add optional creator email opt-in`
- `fix: handle campaign fetch errors in contract client`
- `docs: add contributing guide`
- `test: add contractClient coverage`

Keep commits focused. Avoid mixing unrelated changes in one commit.

## 7) Pull Request Checklist

Before opening a PR:
- [ ] Branch is up to date with `main`
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm run typecheck` passes
- [ ] Relevant tests pass (`npm test` and/or `npm run test:e2e`)
- [ ] New behavior is documented (README/docs) when needed
- [ ] PR description explains what changed, why, and how it was tested
- [ ] Screenshots/GIFs included for UI changes

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
# Contributing to ProofOfHeart

We welcome contributions! To maintain a clean and consistent codebase, please follow these guidelines.

## Development Workflow

1.  **Branching**: Create a descriptive branch for your changes (e.g., `feat/add-onboarding` or `fix/login-error`).
2.  **Linting**: Run `npm run lint` before committing.
3.  **Testing**: Ensure tests pass by running `npm test`.
4.  **Bundle Analysis**: To inspect the bundle size and composition, run:
    ```bash
    npm run analyze
    ```
    This will generate an HTML report in the `.next/analyze` folder (or open it automatically in your browser). Use this to identify and resolve bundle bloat.

## Pull Requests

- Provide a clear description of the changes.
- Reference any related issues.
- Ensure your code builds locally (`npm run build`).
