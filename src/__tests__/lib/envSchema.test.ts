/**
 * #1633 — the Zod environment schemas.
 *
 * Every case passes an explicit `source`, so the suite never depends on the
 * ambient `process.env` of the machine running it.
 */

import {
  ClientEnvSchema,
  EnvValidationError,
  NETWORK_PASSPHRASES,
  ServerEnvSchema,
  assertRuntimeEnv,
  findExposedSecrets,
  formatEnvIssues,
  refineClientEnv,
  resolveEnvFlags,
  validateClientEnv,
  validateRuntimeEnv,
  validateServerEnv,
} from "@/lib/envSchema";
import { CLIENT_ENV_KEYS, SECRET_ENV_KEYS, SERVER_ENV_KEYS } from "@/lib/runtimeEnv";

/** Shorthand: run the client section and return the keys with error issues. */
function errorKeys(source: Record<string, string | undefined>, isProduction = false): string[] {
  return validateClientEnv({ source, isProduction })
    .issues.filter((issue) => issue.severity === "error")
    .map((issue) => issue.key);
}

function issuesFor(
  source: Record<string, string | undefined>,
  isProduction = false,
): { key: string; severity: string; message: string }[] {
  return validateClientEnv({ source, isProduction }).issues.map((issue) => ({
    key: issue.key,
    severity: issue.severity,
    message: issue.message,
  }));
}

const TESTNET_PASSPHRASE = NETWORK_PASSPHRASES.testnet;

describe("per-variable schemas", () => {
  it("treats an empty string as unset, the way .env files spell it", () => {
    const result = validateClientEnv({
      source: { NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "", NEXT_PUBLIC_SITE_URL: "" },
    });

    expect(result.ok).toBe(true);
    expect(result.data.NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE).toBeUndefined();
    expect(result.data.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });

  it.each([
    ["true", true],
    ["1", true],
    ["YES", true],
    [" on ", true],
    ["false", false],
    ["0", false],
    ["no", false],
    ["OFF", false],
  ])("parses %s as the boolean %s", (raw, expected) => {
    const result = validateClientEnv({ source: { NEXT_PUBLIC_USE_MOCKS: raw } });

    expect(result.ok).toBe(true);
    expect(result.data.NEXT_PUBLIC_USE_MOCKS).toBe(expected);
  });

  it("rejects a boolean-looking value that is not one", () => {
    const result = validateClientEnv({ source: { NEXT_PUBLIC_MAINTENANCE_MODE: "maybe" } });

    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe("NEXT_PUBLIC_MAINTENANCE_MODE");
    expect(result.issues[0].message).toContain("must be one of");
  });

  it.each([
    ["abc", "must be an integer"],
    ["12.5", "must be an integer"],
    ["0", "must be 1–100"],
    ["101", "must be 1–100"],
  ])("rejects %s as a page size (%s)", (raw, expectedMessage) => {
    const result = validateClientEnv({ source: { NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: raw } });

    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain(expectedMessage);
  });

  it("accepts an in-range integer", () => {
    const result = validateClientEnv({ source: { NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "50" } });

    expect(result.data.NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE).toBe(50);
  });

  it("rejects an alert threshold outside 0–1", () => {
    const result = validateServerEnv({
      source: { OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE: "1.4" },
    });

    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe("OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE");
    expect(result.issues[0].message).toContain("must be 0–1");
  });

  it("accepts a fractional threshold", () => {
    const result = validateServerEnv({ source: { OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE: "0.25" } });

    expect(result.ok).toBe(true);
    expect(result.data.OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE).toBe(0.25);
  });

  it("rejects a network that is not testnet or mainnet", () => {
    const result = validateClientEnv({ source: { NEXT_PUBLIC_STELLAR_NETWORK: "futurenet" } });

    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("must be one of testnet, mainnet");
  });

  it("normalises network casing", () => {
    const result = validateClientEnv({ source: { NEXT_PUBLIC_STELLAR_NETWORK: "MAINNET" } });

    expect(result.data.NEXT_PUBLIC_STELLAR_NETWORK).toBe("mainnet");
  });

  it("accepts an http RPC url but not a relative one", () => {
    expect(
      validateClientEnv({ source: { NEXT_PUBLIC_SOROBAN_RPC_URL: "http://localhost:8000" } }).ok,
    ).toBe(true);
    expect(validateClientEnv({ source: { NEXT_PUBLIC_SOROBAN_RPC_URL: "/rpc" } }).ok).toBe(false);
  });

  it("requires https for a url the browser fetches", () => {
    const http = validateClientEnv({
      source: { NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "http://widget.test/x.js" },
    });
    const https = validateClientEnv({
      source: { NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "https://widget.test/x.js" },
    });

    expect(http.ok).toBe(false);
    expect(http.issues[0].message).toContain("https");
    expect(https.ok).toBe(true);
  });

  it("validates Stellar contract and account ids", () => {
    const contract = "C" + "A".repeat(56);
    const account = "G" + "A".repeat(55);

    expect(validateClientEnv({ source: { NEXT_PUBLIC_CONTRACT_ADDRESS: contract } }).ok).toBe(true);
    expect(validateServerEnv({ source: { PLATFORM_ADMIN_ADDRESS: account } }).ok).toBe(true);
    expect(validateClientEnv({ source: { NEXT_PUBLIC_CONTRACT_ADDRESS: account } }).ok).toBe(false);
    expect(validateClientEnv({ source: { NEXT_PUBLIC_CONTRACT_ADDRESS: "nope" } }).ok).toBe(false);
  });

  it("splits an allowlist and rejects a non-address entry", () => {
    const good = validateClientEnv({
      source: { NEXT_PUBLIC_MAINTENANCE_ALLOWLIST: `G${"A".repeat(55)}, G${"B".repeat(55)}` },
    });
    const bad = validateClientEnv({
      source: { NEXT_PUBLIC_MAINTENANCE_ALLOWLIST: "not-an-address" },
    });

    expect(good.data.NEXT_PUBLIC_MAINTENANCE_ALLOWLIST).toHaveLength(2);
    expect(bad.ok).toBe(false);
    expect(bad.issues[0].message).toContain("Stellar account id");
  });

  it("rejects a JWT that is not three segments", () => {
    expect(validateServerEnv({ source: { PINATA_JWT: "a.b.c" } }).ok).toBe(true);
    expect(validateServerEnv({ source: { PINATA_JWT: "just-a-token" } }).ok).toBe(false);
  });

  it("validates a completely unset environment without complaint", () => {
    const result = validateClientEnv({ source: {} });

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

describe("cross-variable rules", () => {
  it("rejects a passphrase that disagrees with the configured network", () => {
    const issues = errorKeys({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_NETWORK_PASSPHRASE: TESTNET_PASSPHRASE,
    });

    expect(issues).toContain("NEXT_PUBLIC_NETWORK_PASSPHRASE");
  });

  it("accepts the matching passphrase", () => {
    const issues = errorKeys({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_NETWORK_PASSPHRASE: NETWORK_PASSPHRASES.mainnet,
    });

    expect(issues).toEqual([]);
  });

  it("rejects plausible without a registered domain", () => {
    expect(errorKeys({ NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible" })).toContain(
      "NEXT_PUBLIC_ANALYTICS_PROVIDER",
    );
  });

  it("rejects umami without a website id", () => {
    expect(errorKeys({ NEXT_PUBLIC_ANALYTICS_PROVIDER: "umami" })).toContain(
      "NEXT_PUBLIC_ANALYTICS_PROVIDER",
    );
  });

  it("rejects an analytics id with no provider selected", () => {
    expect(errorKeys({ NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz" })).toContain(
      "NEXT_PUBLIC_ANALYTICS_PROVIDER",
    );
  });

  it("rejects an on-ramp provider without its key", () => {
    expect(errorKeys({ NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER: "ramp" })).toContain(
      "NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER",
    );
    expect(errorKeys({ NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER: "moonpay" })).toContain(
      "NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER",
    );
  });

  it("rejects an on-ramp key with no provider selected", () => {
    expect(errorKeys({ NEXT_PUBLIC_RAMP_API_KEY: "pk_live_x" })).toContain(
      "NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER",
    );
  });

  it("accepts a fully configured on-ramp", () => {
    const issues = errorKeys({
      NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER: "ramp",
      NEXT_PUBLIC_RAMP_API_KEY: "pk_live_x",
    });

    expect(issues).toEqual([]);
  });

  it("rejects maintenance mode with an empty allowlist", () => {
    expect(errorKeys({ NEXT_PUBLIC_MAINTENANCE_MODE: "true" })).toContain(
      "NEXT_PUBLIC_MAINTENANCE_ALLOWLIST",
    );
  });

  it("accepts maintenance mode with an allowlist", () => {
    const issues = errorKeys({
      NEXT_PUBLIC_MAINTENANCE_MODE: "true",
      NEXT_PUBLIC_MAINTENANCE_ALLOWLIST: `G${"A".repeat(55)}`,
    });

    expect(issues).toEqual([]);
  });

  it("warns, but does not block, on the deprecated client-scoped webhook", () => {
    const issues = issuesFor({ NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL: "https://hooks.test/x" });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].key).toBe("NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL");
  });

  it("reports every cross-variable problem at once", () => {
    const issues = errorKeys({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER: "ramp",
      NEXT_PUBLIC_MAINTENANCE_MODE: "true",
    });

    expect(issues).toHaveLength(3);
  });
});

describe("production rules", () => {
  it("blocks mock mode in production", () => {
    const issues = errorKeys({ NEXT_PUBLIC_USE_MOCKS: "true" }, true);

    expect(issues).toContain("NEXT_PUBLIC_USE_MOCKS");
  });

  it("allows mock mode outside production", () => {
    const report = validateClientEnv({
      source: { NEXT_PUBLIC_USE_MOCKS: "true" },
      isProduction: false,
    });

    expect(report.ok).toBe(true);
  });

  it("warns rather than fails when the contract id is missing in production", () => {
    const issues = issuesFor({ NEXT_PUBLIC_USE_MOCKS: "false" }, true);
    const contract = issues.find((issue) => issue.key === "NEXT_PUBLIC_CONTRACT_ADDRESS");

    expect(contract?.severity).toBe("warning");
    expect(
      issuesFor({ NEXT_PUBLIC_USE_MOCKS: "false" }, true).filter((i) => i.severity === "error"),
    ).toEqual([]);
  });

  it("warns about a non-https site url in production", () => {
    const issues = issuesFor({ NEXT_PUBLIC_SITE_URL: "http://proofofheart.xyz" }, true);

    expect(issues.map((i) => i.key)).toContain("NEXT_PUBLIC_SITE_URL");
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
  });

  it("does not apply production rules outside production", () => {
    const report = validateClientEnv({
      source: { NEXT_PUBLIC_USE_MOCKS: "true" },
      isProduction: false,
    });

    expect(report.issues).toHaveLength(0);
  });
});

describe("secret exposure", () => {
  it("flags a secret exported with a NEXT_PUBLIC_ prefix", () => {
    const issues = findExposedSecrets({ NEXT_PUBLIC_PINATA_JWT: "a.b.c" });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].key).toBe("NEXT_PUBLIC_PINATA_JWT");
    expect(issues[0].message).toContain("inlines into the public JavaScript bundle");
  });

  it("ignores an unset or empty secret", () => {
    expect(findExposedSecrets({})).toEqual([]);
    expect(findExposedSecrets({ NEXT_PUBLIC_PINATA_JWT: "" })).toEqual([]);
  });

  it("makes an exposed secret block the whole report", () => {
    const report = validateRuntimeEnv({
      source: { NEXT_PUBLIC_PINATA_JWT: "a.b.c" },
      includeServer: false,
    });

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.key === "NEXT_PUBLIC_PINATA_JWT")).toBe(true);
  });

  it("can be skipped explicitly", () => {
    const report = validateRuntimeEnv({
      source: { NEXT_PUBLIC_PINATA_JWT: "a.b.c" },
      includeServer: false,
      checkSecretExposure: false,
    });

    expect(report.ok).toBe(true);
  });

  it("has nothing to flag for a clean environment", () => {
    expect(
      findExposedSecrets({ PINATA_JWT: "a.b.c", MAINNET_RPC_URL: "https://rpc.test" }),
    ).toEqual([]);
  });
});

describe("reporting", () => {
  it("combines both scopes into one report", () => {
    const report = validateRuntimeEnv({
      source: {
        NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "0",
        PINATA_JWT: "nope",
      },
    });

    expect(report.ok).toBe(false);
    expect(report.client.issues.map((i) => i.key)).toContain("NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE");
    expect(report.server.issues.map((i) => i.key)).toContain("PINATA_JWT");
  });

  it("skips the client scope on request", () => {
    const report = validateRuntimeEnv({
      source: { NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "0" },
      includeClient: false,
    });

    expect(report.ok).toBe(true);
    expect(report.client.issues).toHaveLength(0);
  });

  it("skips the server scope on request", () => {
    const report = validateRuntimeEnv({ source: { PINATA_JWT: "nope" }, includeServer: false });

    expect(report.ok).toBe(true);
  });

  it("reports a skipped server scope as ok", () => {
    const section = validateServerEnv({ enabled: false });

    expect(section).toEqual({ scope: "server", data: {}, issues: [], ok: true });
  });

  it("formats issues as an aligned block", () => {
    const output = formatEnvIssues([
      { scope: "client", key: "A", severity: "error", message: "first" },
      { scope: "client", key: "LONGER_KEY", severity: "warning", message: "second" },
    ]);

    expect(output).toBe("  ERROR   A           first\n  WARNING LONGER_KEY  second");
  });

  it("formats an empty issue list", () => {
    expect(formatEnvIssues([])).toBe("  (no issues)");
  });
});

describe("assertRuntimeEnv", () => {
  it("returns the report for a valid environment", () => {
    const report = assertRuntimeEnv({ source: {}, isProduction: true });

    expect(report.ok).toBe(true);
  });

  it("throws EnvValidationError on a blocking issue", () => {
    expect(() =>
      assertRuntimeEnv({ source: { NEXT_PUBLIC_USE_MOCKS: "true" }, isProduction: true }),
    ).toThrow(EnvValidationError);
  });

  it("carries the blocking issues on the error", () => {
    try {
      assertRuntimeEnv({ source: { NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "0" } });
      throw new Error("expected assertRuntimeEnv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const issues = (error as EnvValidationError).issues;
      expect(issues).toHaveLength(1);
      expect(issues[0].key).toBe("NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE");
    }
  });

  it("ignores warnings by default and enforces them on request", () => {
    const source = { NEXT_PUBLIC_SITE_URL: "http://proofofheart.xyz" };

    expect(assertRuntimeEnv({ source, isProduction: true }).ok).toBe(true);
    expect(() => assertRuntimeEnv({ source, isProduction: true, throwOnWarning: true })).toThrow(
      EnvValidationError,
    );
  });

  it("reports instead of throwing when asked to", () => {
    const report = assertRuntimeEnv({
      source: { NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "0" },
      throwOnError: false,
    });

    expect(report.ok).toBe(false);
  });
});

describe("resolveEnvFlags", () => {
  it("derives the flags the boot hook needs", () => {
    const report = validateRuntimeEnv({
      source: {
        NEXT_PUBLIC_USE_MOCKS: "false",
        NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
        NEXT_PUBLIC_MAINTENANCE_MODE: "true",
        NEXT_PUBLIC_MAINTENANCE_ALLOWLIST: `G${"A".repeat(55)}`,
      },
    });

    expect(resolveEnvFlags(report)).toEqual({
      isMockMode: false,
      isProduction: false,
      stellarNetwork: "mainnet",
      maintenanceMode: true,
    });
  });

  it("defaults the network to testnet when it is unset", () => {
    const report = validateRuntimeEnv({ source: {}, includeServer: false });

    expect(resolveEnvFlags(report).stellarNetwork).toBe("testnet");
  });

  it("falls back to testnet for an unparseable network", () => {
    const report = validateRuntimeEnv({ source: { NEXT_PUBLIC_STELLAR_NETWORK: "futurenet" } });

    expect(resolveEnvFlags(report).stellarNetwork).toBe("testnet");
  });
});

describe("the contract and the schemas agree", () => {
  it("declares a shape for every client variable", () => {
    for (const key of CLIENT_ENV_KEYS) {
      expect(ClientEnvSchema.shape).toHaveProperty(key);
    }
  });

  it("declares a shape for every server variable", () => {
    for (const key of SERVER_ENV_KEYS) {
      expect(ServerEnvSchema.shape).toHaveProperty(key);
    }
  });

  it("keeps scopes disjoint", () => {
    const client = new Set(CLIENT_ENV_KEYS);
    expect(SERVER_ENV_KEYS.filter((key) => client.has(key))).toEqual([]);
  });

  it("never marks a client-scoped variable as a secret", () => {
    const client = new Set(CLIENT_ENV_KEYS);
    expect(SECRET_ENV_KEYS.filter((key) => client.has(key))).toEqual([]);
  });

  it("accepts a valid value for every declared variable", () => {
    // One example per contract row. If a variable is added to the contract
    // without a shape, or a shape stops accepting its own documented value, this
    // fails — which is the whole point of deriving the schemas from the table.
    const sample: Record<string, string> = {
      NEXT_PUBLIC_USE_MOCKS: "false",
      NEXT_PUBLIC_SITE_URL: "https://proofofheart.xyz",
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_CONTRACT_ADDRESS: `C${"A".repeat(56)}`,
      NEXT_PUBLIC_NETWORK_PASSPHRASE: NETWORK_PASSPHRASES.testnet,
      NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "20",
      NEXT_PUBLIC_VOTE_EVENTS_POLL_MS: "5000",
      NEXT_PUBLIC_VOTE_TALLIES_POLL_MS: "30000",
      NEXT_PUBLIC_POLL_INTERVAL_BALANCE_MS: "15000",
      NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS: "60000",
      NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS: "30000",
      NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS: "100000",
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_ANALYTICS_SRC: "https://plausible.io/js/script.js",
      NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
      NEXT_PUBLIC_ANALYTICS_WEBSITE_ID: "umami-website-id",
      NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "https://widget.test/embed.js",
      NEXT_PUBLIC_WEB3AUTH_CLIENT_ID: "web3auth-client-id",
      NEXT_PUBLIC_WEB3AUTH_NETWORK: "sapphire_devnet",
      NEXT_PUBLIC_MAINTENANCE_MODE: "true",
      NEXT_PUBLIC_MAINTENANCE_ALLOWLIST: `G${"A".repeat(55)}`,
      NEXT_PUBLIC_MAINTENANCE_ETA: "2026-06-02 18:00 UTC",
      NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER: "ramp",
      NEXT_PUBLIC_RAMP_API_KEY: "pk_live_example",
      NEXT_PUBLIC_MOONPAY_API_KEY: "pk_live_example",
      NEXT_PUBLIC_PLATFORM_TAX_ID: "XX-XXXXXXX",
      NEXT_PUBLIC_ERROR_TRACKING_DSN: "https://errors.example/1",
      NEXT_PUBLIC_API_URL: "https://api.example",
      NEXT_PUBLIC_RPC_URL: "https://rpc.example",
      NEXT_PUBLIC_CONTRACT_ID: "1",
      NEXT_PUBLIC_CONTRACT_WASM_HASH: "abcdef0123456789",
      NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL: "https://hooks.example/email",
      MAINNET_RPC_URL: "https://rpc.example",
      TESTNET_RPC_URL: "https://rpc.example",
      PINATA_JWT: "header.payload.signature",
      CREATOR_EMAIL_WEBHOOK_URL: "https://hooks.example/email",
      OBSERVABILITY_WEBHOOK_URL: "https://hooks.example/observability",
      METRICS_SECRET_TOKEN: "metrics-token",
      PLATFORM_ADMIN_ADDRESS: `G${"A".repeat(55)}`,
      COMMENT_STORE_DRIVER: "file",
      COMMENT_STORE_PATH: ".data/poh-store.json",
      COMMENT_STORE_REDIS_REST_URL: "https://redis.example",
      COMMENT_STORE_REDIS_REST_TOKEN: "redis-token",
      OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE: "0.15",
      OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE: "0.1",
      OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE: "0.2",
    };

    // Every declared variable has a documented example.
    expect(Object.keys(sample).sort()).toEqual([...CLIENT_ENV_KEYS, ...SERVER_ENV_KEYS].sort());

    const client = validateClientEnv({ source: sample });
    const server = validateServerEnv({ source: sample });

    // Warnings are expected — the deprecated client-scoped webhook is one.
    expect(client.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(server.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("keeps a declared variable's value after parsing", () => {
    const source = { NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "42" };

    expect(validateClientEnv({ source }).data.NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE).toBe(42);
  });

  it("exposes the refinement pass directly for reuse", () => {
    const issues = refineClientEnv({ NEXT_PUBLIC_USE_MOCKS: true }, { isProduction: true });

    expect(issues).toContainEqual(
      expect.objectContaining({ key: "NEXT_PUBLIC_USE_MOCKS", severity: "error" }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ key: "NEXT_PUBLIC_CONTRACT_ADDRESS", severity: "warning" }),
    );
  });
});
