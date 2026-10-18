/**
 * #1633 — the environment contract.
 *
 * One row per environment variable the app reads, describing what the value is
 * for and what shape it must have. `./envSchema` compiles this table into Zod
 * schemas and `./runtimeEnv` exposes the readers, so a variable cannot be
 * added in one place and forgotten in the other.
 *
 * Rules for editing this file:
 *
 * - `scope: "client"` means the value is inlined into the browser bundle at
 *   build time. Only genuinely public values belong here.
 * - `secret: true` marks a value that must never be client-scoped.
 *   `./envSchema` turns a `NEXT_PUBLIC_`-prefixed leak of any of these into an
 *   error.
 * - `value` is a discriminator into the `format` union. The `format` field is
 *   what the schema is built from — see `ENV_FORMATS` in `./envSchema`.
 * - Keep the ordering grouped by concern and mirror the grouping in
 *   `.env.example` and `docs/ENVIRONMENT_VARIABLES.md`.
 */

/** How a value must be shaped. `EnvContractEntry["value"]` picks one of these. */
export type EnvValueFormat =
  /** `true` / `1` / `yes` / `on` and their negatives, case-insensitive. */
  | "boolean"
  /** A base-10 integer. */
  | "integer"
  /** A base-10 number, fractional allowed. */
  | "number"
  /** One of a fixed set of literals. */
  | "enum"
  /** An absolute `http(s)` URL. */
  | "url"
  /** An absolute `https` URL — required wherever the value is fetched by the browser. */
  | "https-url"
  /** A Stellar account id: `G` + 55 base32 characters. */
  | "stellar-address"
  /** A Stellar contract id: `C` + 56 base32 characters. */
  | "stellar-contract"
  /** Any non-blank string. */
  | "string"
  /** A JWT-shaped string. */
  | "jwt"
  /** A list of Stellar account ids, comma-separated. */
  | "stellar-address-list"
  /** A human-readable timestamp, free-form. */
  | "text";

export type EnvContractEntry = {
  /** The variable name, exactly as it appears in the environment. */
  readonly name: string;
  /** `client` values are inlined into the browser bundle; `server` values are not. */
  readonly scope: "client" | "server";
  /** The accepted shape of the value. */
  readonly value: EnvValueFormat;
  /** A missing value is an error, not a warning. */
  readonly required: boolean;
  /** The value must never be exposed to the browser. */
  readonly secret: boolean;
  /** What the variable controls, for the docs table. */
  readonly description: string;
  /** What an unset value means, when `required` is false. */
  readonly fallback?: string;
  /** Allowed literals, when `value` is `"enum"`. */
  readonly options?: readonly string[];
  /** Inclusive bounds, when `value` is `"integer"` or `"number"`. */
  readonly min?: number;
  readonly max?: number;
};

export const ENV_CONTRACT = [
  // --- Mode -----------------------------------------------------------------
  {
    name: "NEXT_PUBLIC_USE_MOCKS",
    scope: "client",
    value: "boolean",
    required: false,
    secret: false,
    description: "Use mock campaign data instead of live contract calls.",
    fallback: "false — live contract calls",
  },

  // --- Site / network -------------------------------------------------------
  {
    name: "NEXT_PUBLIC_SITE_URL",
    scope: "client",
    value: "url",
    required: false,
    secret: false,
    description: "Canonical site origin, used for metadata, CORS and canonical URLs.",
    fallback: "https://proofofheart.xyz",
  },
  {
    name: "NEXT_PUBLIC_STELLAR_NETWORK",
    scope: "client",
    value: "enum",
    options: ["testnet", "mainnet"],
    required: false,
    secret: false,
    description: "Stellar network the app talks to. Selects RPC host and passphrase.",
    fallback: "testnet",
  },
  {
    name: "NEXT_PUBLIC_NETWORK_PASSPHRASE",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "Network passphrase. Must match the network above when set.",
    fallback: "the well-known passphrase for NEXT_PUBLIC_STELLAR_NETWORK",
  },
  {
    name: "NEXT_PUBLIC_SOROBAN_RPC_URL",
    scope: "client",
    value: "url",
    required: false,
    secret: false,
    description: "Soroban RPC endpoint the browser talks to.",
    fallback: "https://soroban-testnet.stellar.org",
  },
  {
    name: "NEXT_PUBLIC_CONTRACT_ADDRESS",
    scope: "client",
    value: "stellar-contract",
    required: false,
    secret: false,
    description: "Deployed ProofOfHeart Soroban contract id.",
  },
  {
    name: "NEXT_PUBLIC_CONTRACT_ID",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "Legacy numeric contract id kept for older integrations.",
  },
  {
    name: "NEXT_PUBLIC_CONTRACT_WASM_HASH",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "Expected WASM hash of the deployed contract, checked before trusting it.",
  },
  {
    name: "NEXT_PUBLIC_RPC_URL",
    scope: "client",
    value: "url",
    required: false,
    secret: false,
    description: "Generic RPC alias used by older call sites.",
    fallback: "NEXT_PUBLIC_SOROBAN_RPC_URL",
  },
  {
    name: "NEXT_PUBLIC_API_URL",
    scope: "client",
    value: "url",
    required: false,
    secret: false,
    description: "Base URL of an external API consumed by the browser.",
  },

  // --- Poll intervals and paging -------------------------------------------
  {
    name: "NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE",
    scope: "client",
    value: "integer",
    min: 1,
    max: 100,
    required: false,
    secret: false,
    description: "Campaigns fetched per page on the /causes list.",
    fallback: "20",
  },
  {
    name: "NEXT_PUBLIC_VOTE_EVENTS_POLL_MS",
    scope: "client",
    value: "integer",
    min: 1000,
    max: 600_000,
    required: false,
    secret: false,
    description: "Polling interval for vote events while streaming is unavailable.",
    fallback: "5000",
  },
  {
    name: "NEXT_PUBLIC_VOTE_TALLIES_POLL_MS",
    scope: "client",
    value: "integer",
    min: 1000,
    max: 600_000,
    required: false,
    secret: false,
    description: "Polling interval for vote-tally reconciliation.",
    fallback: "30000",
  },
  {
    name: "NEXT_PUBLIC_POLL_INTERVAL_BALANCE_MS",
    scope: "client",
    value: "integer",
    min: 10_000,
    max: 30_000,
    required: false,
    secret: false,
    description: "Wallet XLM balance refresh interval. Clamped to 10–30s by useStellarBalance.",
    fallback: "15000",
  },
  {
    name: "NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS",
    scope: "client",
    value: "integer",
    min: 1000,
    max: 600_000,
    required: false,
    secret: false,
    description: "Polling interval for the platform stats listing.",
    fallback: "60000",
  },
  {
    name: "NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS",
    scope: "client",
    value: "integer",
    min: 1000,
    max: 600_000,
    required: false,
    secret: false,
    description: "Polling interval for contribution events when streaming is unavailable.",
    fallback: "30000",
  },
  {
    name: "NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS",
    scope: "client",
    value: "integer",
    min: 0,
    max: 1_000_000,
    required: false,
    secret: false,
    description: "Estimated Soroban fee shown before a contributor signs, in stroops.",
    fallback: "100000 (0.01 XLM)",
  },

  // --- Third-party scripts (all opt-in) ------------------------------------
  {
    name: "NEXT_PUBLIC_ANALYTICS_PROVIDER",
    scope: "client",
    value: "enum",
    options: ["plausible", "umami"],
    required: false,
    secret: false,
    description: "Privacy-first analytics vendor. Unset disables analytics entirely.",
  },
  {
    name: "NEXT_PUBLIC_ANALYTICS_SRC",
    scope: "client",
    value: "https-url",
    required: false,
    secret: false,
    description: "Override the analytics script URL when self-hosting the vendor.",
    fallback: "the vendor's default CDN URL",
  },
  {
    name: "NEXT_PUBLIC_ANALYTICS_DOMAIN",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "Plausible only — the registered site name.",
  },
  {
    name: "NEXT_PUBLIC_ANALYTICS_WEBSITE_ID",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "Umami only — the website id from the Umami dashboard.",
  },
  {
    name: "NEXT_PUBLIC_SUPPORT_WIDGET_SRC",
    scope: "client",
    value: "https-url",
    required: false,
    secret: false,
    description: "Support/chat widget script URL (Crisp, Tawk, Intercom, …), loaded on idle.",
  },

  // --- Social login / embedded wallet --------------------------------------
  {
    name: "NEXT_PUBLIC_WEB3AUTH_CLIENT_ID",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "Web3Auth client id. Unset hides the social-login buttons.",
  },
  {
    name: "NEXT_PUBLIC_WEB3AUTH_NETWORK",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description:
      "Web3Auth key network, to pin a network other than the default for the app's network.",
    fallback: "sapphire_devnet on testnet, sapphire_mainnet on mainnet",
  },

  // --- Maintenance mode -----------------------------------------------------
  {
    name: "NEXT_PUBLIC_MAINTENANCE_MODE",
    scope: "client",
    value: "boolean",
    required: false,
    secret: false,
    description: "Show the maintenance page to all visitors.",
    fallback: "false",
  },
  {
    name: "NEXT_PUBLIC_MAINTENANCE_ALLOWLIST",
    scope: "client",
    value: "stellar-address-list",
    required: false,
    secret: false,
    description: "Comma-separated wallet addresses that bypass the maintenance page.",
  },
  {
    name: "NEXT_PUBLIC_MAINTENANCE_ETA",
    scope: "client",
    value: "text",
    required: false,
    secret: false,
    description: "Human-readable ETA shown on the maintenance page.",
  },

  // --- Fiat on-ramp ---------------------------------------------------------
  {
    name: "NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER",
    scope: "client",
    value: "enum",
    options: ["ramp", "moonpay"],
    required: false,
    secret: false,
    description: "Fiat-to-XLM on-ramp vendor. Unset disables the on-ramp UI.",
  },
  {
    name: "NEXT_PUBLIC_RAMP_API_KEY",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "Ramp publishable host key. Never a secret key.",
  },
  {
    name: "NEXT_PUBLIC_MOONPAY_API_KEY",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "MoonPay publishable key. Never a secret key.",
  },

  // --- Misc public ----------------------------------------------------------
  {
    name: "NEXT_PUBLIC_PLATFORM_TAX_ID",
    scope: "client",
    value: "string",
    required: false,
    secret: false,
    description: "Platform tax identifier rendered on receipts.",
  },
  {
    name: "NEXT_PUBLIC_ERROR_TRACKING_DSN",
    scope: "client",
    value: "url",
    required: false,
    secret: false,
    description: "Error-tracking DSN for client-side reporting.",
  },
  {
    name: "NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL",
    scope: "client",
    value: "https-url",
    required: false,
    secret: false,
    description: "Deprecated: use the server-only CREATOR_EMAIL_WEBHOOK_URL instead.",
  },

  // --- Server-only RPC ------------------------------------------------------
  {
    name: "MAINNET_RPC_URL",
    scope: "server",
    value: "url",
    required: false,
    secret: true,
    description: "Mainnet RPC with API key. Server-side only; may embed a credential.",
  },
  {
    name: "TESTNET_RPC_URL",
    scope: "server",
    value: "url",
    required: false,
    secret: true,
    description: "Server-side testnet RPC. Falls back to the public endpoint.",
  },

  // --- Server-only webhooks and uploads ------------------------------------
  {
    name: "PINATA_JWT",
    scope: "server",
    value: "jwt",
    required: false,
    secret: true,
    description: "Pinata JWT for server-side IPFS uploads via /api/upload-image.",
  },
  {
    name: "CREATOR_EMAIL_WEBHOOK_URL",
    scope: "server",
    value: "https-url",
    required: false,
    secret: true,
    description: "Webhook called server-side by /api/email-opt-in.",
  },
  {
    name: "OBSERVABILITY_WEBHOOK_URL",
    scope: "server",
    value: "https-url",
    required: false,
    secret: true,
    description: "Webhook that /api/observability/events forwards structured events to.",
  },
  {
    name: "METRICS_SECRET_TOKEN",
    scope: "server",
    value: "string",
    required: false,
    secret: true,
    description: "Bearer token guarding the metrics endpoint.",
  },
  {
    name: "PLATFORM_ADMIN_ADDRESS",
    scope: "server",
    value: "stellar-address",
    required: false,
    secret: false,
    description: "Stellar address granted platform-admin rights server-side.",
  },

  // --- Comment / report persistence -----------------------------------------
  {
    name: "COMMENT_STORE_DRIVER",
    scope: "server",
    value: "enum",
    options: ["memory", "file", "redis"],
    required: false,
    secret: false,
    description:
      "Adapter backing the comment, report and rate-limit store. Redis is shared across instances.",
    fallback: "file (memory when NODE_ENV=test, or when Redis credentials are set)",
  },
  {
    name: "COMMENT_STORE_PATH",
    scope: "server",
    value: "string",
    required: false,
    secret: false,
    description: "JSON file path used by the file store adapter.",
    fallback: ".data/poh-store.json",
  },
  {
    name: "COMMENT_STORE_REDIS_REST_URL",
    scope: "server",
    value: "url",
    required: false,
    secret: true,
    description: "Upstash-compatible Redis REST endpoint backing the shared store.",
  },
  {
    name: "COMMENT_STORE_REDIS_REST_TOKEN",
    scope: "server",
    value: "string",
    required: false,
    secret: true,
    description: "Auth token for COMMENT_STORE_REDIS_REST_URL.",
  },

  // --- Observability thresholds ---------------------------------------------
  {
    name: "OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE",
    scope: "server",
    value: "number",
    min: 0,
    max: 1,
    required: false,
    secret: false,
    description: "Simulation-failure rate, 0–1, that raises an alert over a 5-minute window.",
    fallback: "0.15",
  },
  {
    name: "OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE",
    scope: "server",
    value: "number",
    min: 0,
    max: 1,
    required: false,
    secret: false,
    description: "Submission-failure rate, 0–1, that raises an alert.",
    fallback: "0.1",
  },
  {
    name: "OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE",
    scope: "server",
    value: "number",
    min: 0,
    max: 1,
    required: false,
    secret: false,
    description: "RPC-timeout rate, 0–1, that raises an alert.",
    fallback: "0.2",
  },
] as const satisfies readonly EnvContractEntry[];
