# Environment Variables

Every environment variable the app reads, the shape its value must have, and how
the configuration is validated on boot.

## Why this exists

Historically each variable was read where it was used, with its own ad-hoc
parsing. That made a misspelled key indistinguishable from an unset one, let a
secret be prefixed `NEXT_PUBLIC_` and shipped to the browser, and left no single
answer to "what does this app read?".

The contract now lives in one place:

| File                     | Role                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `src/lib/envContract.ts` | The table: one row per variable — scope, format, required, secret, meaning    |
| `src/lib/runtimeEnv.ts`  | The readers. No runtime dependencies, so `"use client"` modules can import it |
| `src/lib/envSchema.ts`   | The Zod schemas derived from the table, plus the cross-variable rules         |
| `src/instrumentation.ts` | The server boot hook that runs the validation                                 |

`runtimeEnv.ts` and `envSchema.ts` are deliberately separate. `zod` is not in the
browser bundle today — every consumer of `src/lib/schemas.ts` is an API route —
and `runtimeEnv.ts` is imported by `"use client"` components (`Navbar`,
`WalletContext`, `DevMockPanel`). Importing Zod there would add it to the main
chunk, so the schema side is server-only by construction.

## Adding a variable

1. Add a row to `ENV_CONTRACT` in `src/lib/envContract.ts`.
2. Add the literal `process.env.X` read to `readClientEnv` or `readServerEnv` in
   `src/lib/runtimeEnv.ts`. `NEXT_PUBLIC_*` values are inlined at build time by
   literal-text substitution, so a computed lookup such as `process.env[name]`
   silently becomes `undefined` in the browser — keep the reads literal.
3. If it changes how the app is configured, note it in `.env.example`.
4. Do not add a bare `process.env.X` read anywhere else.

The schemas are derived from the table, so steps 1 and 2 are all that is needed
for validation and types. A test asserts that every declared variable has a
schema and a documented example value.

## Validation

On every server boot, `src/instrumentation.ts` validates all client and server
variables. The asymmetry is deliberate:

- **`error`** — the app is misconfigured in a way that breaks a user-visible
  feature, or a secret is exposed to the browser. **Blocks a production boot.**
  Logged only outside production, so a work-in-progress `.env.local` never makes
  the dev server unusable.
- **`warning`** — worth a look but safe to boot with. Never blocks.

Set `SKIP_ENV_VALIDATION=true` to bypass the check entirely. The same idea as
`SKIP_MOCK_CHECK` in `scripts/validate-production-build.mjs`.

To validate from a script or a test:

```ts
import { validateRuntimeEnv, assertRuntimeEnv } from "@/lib/envSchema";

const report = validateRuntimeEnv();
if (!report.ok) console.error(report.issues);

assertRuntimeEnv(); // throws EnvValidationError on any error-severity issue
```

Both accept a `source` override, which is how the tests avoid depending on the
machine's own environment.

## Rules that span more than one variable

A per-variable schema cannot express these, so they are checked in a second pass:

| Rule                                                                                       | Severity |
| ------------------------------------------------------------------------------------------ | -------- |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` must match `NEXT_PUBLIC_STELLAR_NETWORK`                  | error    |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` needs its site id (`…_DOMAIN` or `…_WEBSITE_ID`)          | error    |
| An analytics site id with no provider selected                                             | error    |
| `NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER` needs its matching publishable key                      | error    |
| An on-ramp key with no provider selected                                                   | error    |
| `NEXT_PUBLIC_MAINTENANCE_MODE=true` with an empty allowlist locks out every administrator  | error    |
| A server secret also exported as `NEXT_PUBLIC_<NAME>` is inlined into the public JS bundle | error    |
| `NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL` is client-scoped, so its endpoint is public        | warning  |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` unset in production                                         | warning  |
| `NEXT_PUBLIC_SITE_URL` is not https in production                                          | warning  |
| `MAINNET_RPC_URL` unset while the app is configured for mainnet                            | warning  |

A passphrase mismatch is the one worth internalising: the app signs for one
network while the network banner says another, and every transaction fails with
an opaque error.

### Secret exposure

This is the highest-value check in the module and the reason the contract marks
`secret: true` separately from `scope`. A server secret that is _also_ exported
as `NEXT_PUBLIC_<NAME>` is inlined into the JavaScript bundle by Next.js and is
readable by anyone who loads the site. Per-variable schemas structurally cannot
catch it, because each variable is individually valid.

## The variables

`scope: client` values are inlined into the browser bundle. `scope: server`
values never leave the server.

### Mode and network

| Variable                         | Format                 | Default             | Notes                             |
| -------------------------------- | ---------------------- | ------------------- | --------------------------------- |
| `NEXT_PUBLIC_USE_MOCKS`          | boolean                | `false`             | `true` cannot ship to production  |
| `NEXT_PUBLIC_SITE_URL`           | url                    | `proofofheart.xyz`  | Canonical origin, CORS, metadata  |
| `NEXT_PUBLIC_STELLAR_NETWORK`    | `testnet` \| `mainnet` | `testnet`           | Selects RPC host and passphrase   |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | string                 | per network         | Must match the network above      |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`    | url                    | testnet endpoint    | Browser-facing RPC                |
| `NEXT_PUBLIC_CONTRACT_ADDRESS`   | Stellar contract id    | —                   | `C` + 56 base32 characters        |
| `NEXT_PUBLIC_CONTRACT_ID`        | string                 | —                   | Legacy numeric id                 |
| `NEXT_PUBLIC_CONTRACT_WASM_HASH` | string                 | —                   | Checked by `contractVersionGuard` |
| `NEXT_PUBLIC_RPC_URL`            | url                    | `…_SOROBAN_RPC_URL` | Generic alias                     |
| `NEXT_PUBLIC_API_URL`            | url                    | —                   | External API base URL             |

### Polling and paging

| Variable                                               | Format       | Default | Notes                           |
| ------------------------------------------------------ | ------------ | ------- | ------------------------------- |
| `NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE`                      | int 1–100    | 20      | Campaigns per page on `/causes` |
| `NEXT_PUBLIC_VOTE_EVENTS_POLL_MS`                      | int 1s–10min | 5000    | Vote event polling              |
| `NEXT_PUBLIC_VOTE_TALLIES_POLL_MS`                     | int 1s–10min | 30000   | Tally reconciliation            |
| `NEXT_PUBLIC_POLL_INTERVAL_BALANCE_MS`                 | int 10s–30s  | 15000   | Clamped by `useStellarBalance`  |
| `NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS`                 | int 1s–10min | 60000   | Platform stats                  |
| `NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS`              | int 1s–10min | 30000   | Contribution events             |
| `NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS` | int 0–1e6    | 100000  | Pre-sign fee estimate           |

### Third-party scripts (all opt-in)

| Variable                           | Format    | Notes                                            |
| ---------------------------------- | --------- | ------------------------------------------------ |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER`   | enum      | `plausible` \| `umami`; unset disables analytics |
| `NEXT_PUBLIC_ANALYTICS_SRC`        | https url | Override the vendor script URL                   |
| `NEXT_PUBLIC_ANALYTICS_DOMAIN`     | string    | Plausible site name                              |
| `NEXT_PUBLIC_ANALYTICS_WEBSITE_ID` | string    | Umami website id                                 |
| `NEXT_PUBLIC_SUPPORT_WIDGET_SRC`   | https url | Loaded on idle, never from `<head>`              |

Unset everything in this group and the app ships zero third-party requests.

### Social login, maintenance, on-ramp

| Variable                                | Format               | Notes                                    |
| --------------------------------------- | -------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`        | string               | Unset hides the social-login buttons     |
| `NEXT_PUBLIC_WEB3AUTH_NETWORK`          | string               | Pins a Web3Auth network                  |
| `NEXT_PUBLIC_MAINTENANCE_MODE`          | boolean              | Show the maintenance page                |
| `NEXT_PUBLIC_MAINTENANCE_ALLOWLIST`     | Stellar address list | Comma-separated `G…` bypasses            |
| `NEXT_PUBLIC_MAINTENANCE_ETA`           | free text            | Shown on the maintenance page            |
| `NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER`      | `ramp` \| `moonpay`  | Unset disables the on-ramp UI            |
| `NEXT_PUBLIC_RAMP_API_KEY`              | string               | Publishable key, never a secret key      |
| `NEXT_PUBLIC_MOONPAY_API_KEY`           | string               | Publishable key, never a secret key      |
| `NEXT_PUBLIC_PLATFORM_TAX_ID`           | string               | Rendered on receipts                     |
| `NEXT_PUBLIC_ERROR_TRACKING_DSN`        | url                  | Client-side error reporting              |
| `NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL` | https url            | **Deprecated** — use the server-only one |

### Server-only

Never inlined into the bundle. All are marked `secret: true` where the value is
a credential, which is what the exposure check keys off.

| Variable                                      | Format             | Notes                                         |
| --------------------------------------------- | ------------------ | --------------------------------------------- |
| `MAINNET_RPC_URL`                             | url                | Secret — may embed an API key                 |
| `TESTNET_RPC_URL`                             | url                | Secret — falls back to the public endpoint    |
| `PINATA_JWT`                                  | JWT                | Secret — IPFS uploads via `/api/upload-image` |
| `CREATOR_EMAIL_WEBHOOK_URL`                   | https url          | Secret — called by `/api/email-opt-in`        |
| `OBSERVABILITY_WEBHOOK_URL`                   | https url          | Secret — `/api/observability/events` target   |
| `METRICS_SECRET_TOKEN`                        | string             | Secret — bearer token for the metrics route   |
| `PLATFORM_ADMIN_ADDRESS`                      | Stellar account id | Server-side admin rights                      |
| `COMMENT_STORE_DRIVER`                        | `memory`\|`file`\|`redis` | Adapter for comments, reports and rate limits |
| `COMMENT_STORE_PATH`                          | string             | File path for the `file` adapter              |
| `COMMENT_STORE_REDIS_REST_URL`                | url                | Secret — shared Redis REST endpoint           |
| `COMMENT_STORE_REDIS_REST_TOKEN`              | string             | Secret — Redis REST auth token                |
| `OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE` | number 0–1         | Default 0.15                                  |
| `OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE` | number 0–1         | Default 0.1                                   |
| `OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE`        | number 0–1         | Default 0.2                                   |

## Not in the contract

A few build-time-only switches are read directly rather than declared, because
they are not runtime configuration:

| Variable              | Read by                                 | Purpose                             |
| --------------------- | --------------------------------------- | ----------------------------------- |
| `SKIP_MOCK_CHECK`     | `scripts/validate-production-build.mjs` | Allow a mock-mode build for testing |
| `SKIP_ENV_VALIDATION` | `src/instrumentation.ts`                | Bypass the boot check entirely      |
| `ANALYZE`             | `next.config.ts`                        | Enable the bundle analyser          |
| `NODE_ENV`            | Next.js                                 | Standard                            |

## Related

- [`.env.example`](../.env.example) — the annotated template
- [docs/SECURITY.md](./SECURITY.md) — the wider security posture
- [docs/DEPENDENCY_SECURITY.md](./DEPENDENCY_SECURITY.md) — dependency pinning and audits
- [docs/DEPLOYMENT_ENVIRONMENTS.md](./DEPLOYMENT_ENVIRONMENTS.md) — per-environment setup
- [docs/THIRD_PARTY_SCRIPTS.md](./THIRD_PARTY_SCRIPTS.md) — the CSP interaction
