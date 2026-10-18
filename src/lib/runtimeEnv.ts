/**
 * #1633 — the single source of truth for this app's environment contract.
 *
 * Historically every environment variable was read at its point of use, each
 * with its own ad-hoc `Number()` / `=== "true"` parsing. That made typos silent
 * (a misspelled key is indistinguishable from an unset one), let a secret be
 * accidentally prefixed `NEXT_PUBLIC_` and shipped to the browser, and left no
 * single place that could answer "what does this app read from the environment,
 * and what shape must each value have?".
 *
 * This module is that place. It declares `ENV_CONTRACT` — every variable the
 * app reads, with its scope, whether it is required, whether it is a secret,
 * and the shape its value must have — plus the two readers.
 *
 * Validation lives in `./envSchema`, which turns the contract into Zod schemas.
 * That split is deliberate and load-bearing:
 *
 * - This module has **no runtime dependencies**, so it stays importable from
 *   `"use client"` components (`Navbar`, `WalletContext`, `DevMockPanel`).
 * - `zod` is not in the client bundle today: every consumer of `./schemas` is
 *   an API route. Importing Zod from here would add it to the main chunk, so
 *   `./envSchema` is server-only by construction and nothing here imports it.
 *
 * When you add an environment variable, add it to `envContract.ts` and read it
 * through the matching reader. Do not add a bare `process.env.X` read.
 *
 * @see ./envContract for the contract table itself.
 * @see ./envSchema for the Zod schemas and validation entry points.
 * @see docs/ENVIRONMENT_VARIABLES.md for the developer-facing documentation.
 */

import { ENV_CONTRACT, type EnvContractEntry } from "./envContract";

export type { EnvContractEntry } from "./envContract";
export { ENV_CONTRACT } from "./envContract";

/**
 * Base environment record. Every value is `string | undefined` because that is
 * the only shape `process.env` has; typing is applied by `./envSchema`.
 */
export type EnvRecord = Record<string, string | undefined>;

function namesWhere(predicate: (entry: EnvContractEntry) => boolean): readonly string[] {
  return Object.freeze(ENV_CONTRACT.filter(predicate).map((entry) => entry.name));
}

/** Names of every variable declared `scope: "client"`. */
export const CLIENT_ENV_KEYS = namesWhere((e) => e.scope === "client");

/** Names of every variable declared `scope: "server"`. */
export const SERVER_ENV_KEYS = namesWhere((e) => e.scope === "server");

/**
 * Names that must never reach the browser bundle. Declared here rather than in
 * `./envSchema` so the list is reviewed next to the contract instead of buried
 * in validation logic, and so the leak check works without pulling Zod in.
 */
export const SECRET_ENV_KEYS = namesWhere((e) => e.secret);

/** Look up a contract entry by variable name. */
export function getEnvContractEntry(name: string): EnvContractEntry | undefined {
  return ENV_CONTRACT.find((entry) => entry.name === name);
}

/**
 * Read every client-visible variable.
 *
 * `process.env.NEXT_PUBLIC_*` is inlined at build time by literal-text
 * substitution, so these must stay literal property reads — a computed lookup
 * such as `process.env[name]` resolves to `undefined` in the browser bundle.
 * The destructure below is what keeps that true; adding a dynamic helper here
 * would silently break the client build.
 */
export function readClientEnv(): EnvRecord {
  const {
    NEXT_PUBLIC_USE_MOCKS,
    NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SOROBAN_RPC_URL,
    NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_CONTRACT_ADDRESS,
    NEXT_PUBLIC_NETWORK_PASSPHRASE,
    NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE,
    NEXT_PUBLIC_VOTE_EVENTS_POLL_MS,
    NEXT_PUBLIC_VOTE_TALLIES_POLL_MS,
    NEXT_PUBLIC_POLL_INTERVAL_BALANCE_MS,
    NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS,
    NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS,
    NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS,
    NEXT_PUBLIC_ANALYTICS_PROVIDER,
    NEXT_PUBLIC_ANALYTICS_SRC,
    NEXT_PUBLIC_ANALYTICS_DOMAIN,
    NEXT_PUBLIC_ANALYTICS_WEBSITE_ID,
    NEXT_PUBLIC_SUPPORT_WIDGET_SRC,
    NEXT_PUBLIC_WEB3AUTH_CLIENT_ID,
    NEXT_PUBLIC_WEB3AUTH_NETWORK,
    NEXT_PUBLIC_MAINTENANCE_MODE,
    NEXT_PUBLIC_MAINTENANCE_ALLOWLIST,
    NEXT_PUBLIC_MAINTENANCE_ETA,
    NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER,
    NEXT_PUBLIC_RAMP_API_KEY,
    NEXT_PUBLIC_MOONPAY_API_KEY,
    NEXT_PUBLIC_PLATFORM_TAX_ID,
    NEXT_PUBLIC_ERROR_TRACKING_DSN,
    NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_RPC_URL,
    NEXT_PUBLIC_CONTRACT_ID,
    NEXT_PUBLIC_CONTRACT_WASM_HASH,
    NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL,
  } = process.env;

  return {
    NEXT_PUBLIC_USE_MOCKS,
    NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SOROBAN_RPC_URL,
    NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_CONTRACT_ADDRESS,
    NEXT_PUBLIC_NETWORK_PASSPHRASE,
    NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE,
    NEXT_PUBLIC_VOTE_EVENTS_POLL_MS,
    NEXT_PUBLIC_VOTE_TALLIES_POLL_MS,
    NEXT_PUBLIC_POLL_INTERVAL_BALANCE_MS,
    NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS,
    NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS,
    NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS,
    NEXT_PUBLIC_ANALYTICS_PROVIDER,
    NEXT_PUBLIC_ANALYTICS_SRC,
    NEXT_PUBLIC_ANALYTICS_DOMAIN,
    NEXT_PUBLIC_ANALYTICS_WEBSITE_ID,
    NEXT_PUBLIC_SUPPORT_WIDGET_SRC,
    NEXT_PUBLIC_WEB3AUTH_CLIENT_ID,
    NEXT_PUBLIC_WEB3AUTH_NETWORK,
    NEXT_PUBLIC_MAINTENANCE_MODE,
    NEXT_PUBLIC_MAINTENANCE_ALLOWLIST,
    NEXT_PUBLIC_MAINTENANCE_ETA,
    NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER,
    NEXT_PUBLIC_RAMP_API_KEY,
    NEXT_PUBLIC_MOONPAY_API_KEY,
    NEXT_PUBLIC_PLATFORM_TAX_ID,
    NEXT_PUBLIC_ERROR_TRACKING_DSN,
    NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_RPC_URL,
    NEXT_PUBLIC_CONTRACT_ID,
    NEXT_PUBLIC_CONTRACT_WASM_HASH,
    NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL,
  };
}

/**
 * Every server-only variable. These are never inlined, so a plain property read
 * is correct — and nothing in this list can reach the browser.
 */
export function readServerEnv(): EnvRecord {
  const {
    MAINNET_RPC_URL,
    TESTNET_RPC_URL,
    PINATA_JWT,
    CREATOR_EMAIL_WEBHOOK_URL,
    OBSERVABILITY_WEBHOOK_URL,
    METRICS_SECRET_TOKEN,
    PLATFORM_ADMIN_ADDRESS,
    COMMENT_STORE_DRIVER,
    COMMENT_STORE_PATH,
    COMMENT_STORE_REDIS_REST_URL,
    COMMENT_STORE_REDIS_REST_TOKEN,
    OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE,
    OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE,
    OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE,
  } = process.env;

  return {
    MAINNET_RPC_URL,
    TESTNET_RPC_URL,
    PINATA_JWT,
    CREATOR_EMAIL_WEBHOOK_URL,
    OBSERVABILITY_WEBHOOK_URL,
    METRICS_SECRET_TOKEN,
    PLATFORM_ADMIN_ADDRESS,
    COMMENT_STORE_DRIVER,
    COMMENT_STORE_PATH,
    COMMENT_STORE_REDIS_REST_URL,
    COMMENT_STORE_REDIS_REST_TOKEN,
    OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE,
    OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE,
    OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE,
  };
}

/** Read both scopes in one call. */
export function readRuntimeEnv(): { client: EnvRecord; server: EnvRecord } {
  return { client: readClientEnv(), server: readServerEnv() };
}

/**
 * `NEXT_PUBLIC_USE_MOCKS` is the one flag every entry point needs before the
 * rest of the environment can be validated, and it is read by `"use client"`
 * components, so it stays a plain boolean read here rather than going through
 * `./envSchema`.
 *
 * Behaviour is unchanged from before #1633: any value other than the exact
 * string `"true"` means "off".
 */
export const IS_MOCK_MODE =
  typeof process !== "undefined" && process.env["NEXT_PUBLIC_USE_MOCKS"] === "true";

let asserted = false;

/**
 * Startup guard for production contract configuration.
 *
 * Runs at most once per process, and only blocks in production, which is the
 * behaviour it had before #1633 — including the original error message, so
 * existing runbooks keep matching. Full environment validation is a separate
 * concern and lives in `./envSchema`, invoked from the server boot hook
 * (`src/instrumentation.ts`) where the Zod import is free.
 */
export function assertProductionContractConfig(): void {
  if (asserted) return;
  asserted = true;

  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "production" &&
    process.env["NEXT_PUBLIC_USE_MOCKS"] === "true"
  ) {
    throw new Error(
      "Mock mode is disabled in production. Set NEXT_PUBLIC_USE_MOCKS=false before building or running the app.",
    );
  }
}

/** Reset the once-per-process latch. Intended for tests. */
export function resetProductionContractConfigAssertion(): void {
  asserted = false;
}
