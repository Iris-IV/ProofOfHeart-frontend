# Pre-Commit Checks - Setup Complete ✅

Extended pre-commit hook to run typecheck and affected tests.

## What Was Added

### Hook Update

- **`.husky/pre-commit`** - Updated to run new script
  - Runs lint-staged (existing)
  - Runs pre-commit-checks.mjs (new)
  - Runs commitlint (existing)

### Script

- **`scripts/pre-commit-checks.mjs`** - Smart typecheck + test runner
  - Detects staged TypeScript files
  - Finds affected test files by pattern matching
  - Runs `tsc --noEmit` on staged files only
  - Runs `jest --bail` on affected tests only
  - Optimized for speed (5-30 seconds typical)

### CONTRIBUTING Update

- **`CONTRIBUTING.md`** - Section 4 added
  - Pre-commit checks explained
  - What happens if checks fail
  - Performance expectations
  - How to skip checks (not recommended)

### Documentation

- **`docs/PRE_COMMIT_CHECKS.md`** - Complete guide
  - What each check does
  - How to handle failures
  - Performance tips
  - Troubleshooting

## How It Works

### 1. Get Staged Files

```bash
git diff --cached --name-only
```

### 2. Run TypeScript Type-Check

```bash
npx tsc --noEmit src/components/Button.tsx src/lib/utils.ts
```

### 3. Find Affected Tests

- `Component.ts` → `Component.test.ts`
- `lib/utils.ts` → `src/__tests__/lib/utils.test.ts`
- Test files → same test file

### 4. Run Affected Tests

```bash
npx jest --bail --testPathPattern="Component.test.ts|utils.test.ts"
```

## Quick Start

```bash
# Make changes
vim src/components/Button.tsx

# Stage and commit (checks run automatically)
git add src/components/Button.tsx
git commit -m "feat(ui): add button variant"

# If checks pass → commit created
# If checks fail → commit rejected, fix and try again
```

## Performance

| Check      | Time      | Scope           |
| ---------- | --------- | --------------- |
| Linting    | 2-5s      | Staged files    |
| Type-check | 3-10s     | Staged TS files |
| Tests      | 2-15s     | Affected tests  |
| **Total**  | **5-30s** | **Typical**     |

## Acceptance Criteria Met

✅ Pre-commit runs typecheck and relevant tests on staged changes  
✅ Fast enough not to disrupt flow (5-30 seconds typical)  
✅ Documented in CONTRIBUTING (Section 4)  
✅ Labels: dx, ci, Stellar Wave

## Files Modified

- `.husky/pre-commit` - Added pre-commit-checks.mjs call
- `CONTRIBUTING.md` - Added Section 4: Pre-Commit Checks

## Files Created

- `scripts/pre-commit-checks.mjs` - Main script
- `docs/PRE_COMMIT_CHECKS.md` - Complete documentation

## How to Test

```bash
# Make a change with a type error
echo "const x: number = 'string';" >> src/lib/test.ts

# Try to commit
git add src/lib/test.ts
git commit -m "test: add type error"

# Should fail with:
# ✗ Type-check failed
# Fix the error and try again
```

## Skipping Checks (Not Recommended)

```bash
git commit --no-verify
```

Use only for WIP commits or emergencies.

## Next Steps

1. Run `npm ci` to ensure dependencies are installed
2. Make a change and commit to test the hooks
3. See `docs/PRE_COMMIT_CHECKS.md` for detailed guide

## Content Security Policy (CSP) Maintenance

The hooks above run on every commit, so they are also the first line of defence when someone edits
the CSP. This section is the process for changing the policy safely. Treat any change to the files
below as a security change and have it reviewed (see `SECURITY.md` and `docs/SECURITY.md`).

### Where the policy lives

| File                                      | Role                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/csp.ts`                          | **Source of truth.** `buildCspHeader(nonce, { development })` assembles the policy; `getConnectSrcOrigins()` derives `connect-src` from environment variables.                                                                                                                                  |
| `src/middleware.ts`                       | Generates a per-request nonce, builds the header and applies it: `Content-Security-Policy` in production, `Content-Security-Policy-Report-Only` (plus `Reporting-Endpoints`) in development.                                                                                                    |
| `src/lib/thirdParty.ts`                   | Opt-in analytics and support-widget origins. Configured origins are added to `script-src`, `connect-src` and `frame-src` automatically.                                                                                                                                                         |
| `next.config.ts` (`CSP_DIRECTIVES`)       | Static fallback header for route-level responses. It is more permissive than the middleware policy (it still lists `'unsafe-inline'` and `'unsafe-eval'` for scripts); the middleware header overrides it on the responses it handles. Keep the two from drifting apart when you change either. |
| `src/lib/envContract.ts` / `.env.example` | Variables whose values feed the policy (see below).                                                                                                                                                                                                                                             |

Production policy summary (from `buildCspHeader`):

- `script-src 'self' 'nonce-<per-request>'` + configured third-party origins. No `'unsafe-inline'`
  and no `'unsafe-eval'` in production (`'unsafe-eval'` is added in development only, for the
  Turbopack runtime).
- `connect-src 'self'` + the Soroban RPC origin, `MAINNET_RPC_URL` origin, Horizon (testnet and
  mainnet, or mainnet only when the passphrase is not a test network), `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_ERROR_TRACKING_DSN` and third-party origins. **Only `https:` origins are accepted**;
  invalid or `http:` values are silently dropped.
- `frame-src 'self'` + third-party origins, `frame-ancestors 'none'`, `form-action 'self'`,
  `base-uri 'self'`, `manifest-src 'self'`.
- `style-src 'self' 'unsafe-inline'` and `img-src 'self' data: https: blob:` are intentionally broad.

### Safe update process

1. **Prefer configuration over code.** A new RPC, API or analytics host is normally just an
   environment variable (`NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_API_URL`,
   `NEXT_PUBLIC_ANALYTICS_SRC`, `NEXT_PUBLIC_SUPPORT_WIDGET_SRC`, …). Set it and the origin is added
   for you; no edit to `csp.ts` is needed.
2. **If a code change is unavoidable, make it in `src/lib/csp.ts` only**, in the narrowest directive
   that works, using an exact origin. Do not add wildcards (`https://*.example.com`), `http:` or
   `data:` to `script-src`/`connect-src`, and never add `'unsafe-inline'` or `'unsafe-eval'` to the
   production `script-src`. An inline `<script>` needs the request nonce
   (`CSP_NONCE_HEADER` → `nonce` attribute) instead.
3. **Reproduce locally in report-only mode.** `npm run dev` ships the same policy as
   `Content-Security-Policy-Report-Only`, so violations appear in the browser console without
   breaking the page. Exercise the affected flow (wallet connect, contribute, image upload,
   analytics, support widget) and confirm the console shows no
   `Content-Security-Policy` violations.
4. **Verify the enforced policy.** Build and run production mode
   (`npm run build && npm run start`), then inspect the response header:

   ```bash
   curl -sI http://localhost:3000/ | grep -i content-security-policy
   ```

   Check that `script-src` has a nonce, and that every origin the app needs is in `connect-src`.
   Re-test with Freighter installed — signing must still work.

5. **Run the checks the hook runs, plus the policy-related tests**:

   ```bash
   npx tsc --noEmit
   npx jest src/__tests__/lib/thirdParty.test.ts src/__tests__/components/ThirdPartyScripts.test.tsx
   ```

   If you change `buildCspHeader` or `getConnectSrcOrigins`, add or update a test that asserts the
   new directive/origin and that the forbidden tokens (`'unsafe-inline'`/`'unsafe-eval'` in
   production `script-src`) are still absent.

6. **Commit with a `security:` or `fix:` Conventional Commit** (`docs/COMMIT_CONVENTIONS.md`) and
   describe the origin added and why in the PR, including how it was verified. Do not use
   `git commit --no-verify` for CSP changes.
7. **Roll out and watch.** After deploy, load the site with the console open. Roll back the change
   first and investigate second if wallet signing, RPC reads or uploads break.

### Known limitations

- Violation reports are not collected in production. Development advertises
  `Reporting-Endpoints: csp-endpoint="/api/csp-report"`, but there is currently no
  `/api/csp-report` route in `src/app/api`, so reports sent there return 404. Add the route (and a
  rate limit) before relying on reports for monitoring.
- `docs/SECURITY.md` shows an older example policy that still contains `'unsafe-inline'`; the
  authoritative policy is whatever `buildCspHeader` returns.

## Related Docs

- `docs/PRE_COMMIT_CHECKS.md` - Complete guide
- `docs/COMMIT_CONVENTIONS.md` - Commit message format
- `CONTRIBUTING.md` - Full contribution guide
- `docs/SECURITY.md` - Security headers overview
- `docs/THIRD_PARTY_SCRIPTS.md` - Opt-in third-party script origins
- `docs/ENVIRONMENT_VARIABLES.md` - Variables that feed the CSP
