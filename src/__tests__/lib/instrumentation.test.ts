/**
 * #1633 — the server boot hook.
 *
 * `register()` is the only place the environment is validated on a real server
 * boot, and the asymmetry matters: a broken environment must stop a production
 * server, but must not make a developer's `.env.local` unusable or break the
 * test run. These tests pin that behaviour down rather than trusting it.
 *
 * The module reads `process.env` at call time, so every case patches the
 * environment for the duration of the assertion.
 */

type Instrumentation = typeof import("@/instrumentation");

const TOUCHED_KEYS = [
  "NODE_ENV",
  "NEXT_RUNTIME",
  "SKIP_ENV_VALIDATION",
  "NEXT_PUBLIC_USE_MOCKS",
  "NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_ANALYTICS_PROVIDER",
  "NEXT_PUBLIC_CONTRACT_ADDRESS",
  "NEXT_PUBLIC_PINATA_JWT",
] as const;

/** Run `fn` with only the given environment variables set. */
async function boot(
  env: Partial<Record<(typeof TOUCHED_KEYS)[number], string>>,
  fn: (mod: Instrumentation) => Promise<void>,
): Promise<void> {
  const original = process.env;
  const patched: NodeJS.ProcessEnv = { ...original };
  for (const key of TOUCHED_KEYS) delete patched[key];
  Object.assign(patched, { NEXT_RUNTIME: "nodejs" }, env);

  process.env = patched;
  try {
    let mod!: Instrumentation;
    jest.isolateModules(() => {
      mod = require("@/instrumentation");
    });
    await fn(mod);
  } finally {
    process.env = original;
  }
}

describe("register", () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    error = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  /** Everything logged, as one string, for readable assertions. */
  const logged = () => warn.mock.calls.map((call) => call.join(" ")).join("\n");

  it("does nothing outside the nodejs runtime", async () => {
    await boot({ NEXT_RUNTIME: "edge" }, async (mod) => {
      await expect(mod.register()).resolves.toBeUndefined();
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("does nothing when validation is skipped", async () => {
    await boot({ NODE_ENV: "production", SKIP_ENV_VALIDATION: "true" }, async (mod) => {
      await expect(mod.register()).resolves.toBeUndefined();
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("is silent for a fully configured production environment", async () => {
    await boot(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_USE_MOCKS: "false",
        NEXT_PUBLIC_CONTRACT_ADDRESS: `C${"A".repeat(56)}`,
      },
      async (mod) => {
        await expect(mod.register()).resolves.toBeUndefined();
      },
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it("throws in production when the environment is unusable", async () => {
    await boot(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_USE_MOCKS: "false",
        NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "0",
      },
      async (mod) => {
        await expect(mod.register()).rejects.toThrow("Invalid environment configuration");
      },
    );

    expect(logged()).toContain("NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE");
  });

  it("rejects mock mode in production", async () => {
    await boot({ NODE_ENV: "production", NEXT_PUBLIC_USE_MOCKS: "true" }, async (mod) => {
      await expect(mod.register()).rejects.toThrow(/Mock mode is disabled in production/);
    });
  });

  it("only warns about an error-severity problem outside production", async () => {
    await boot({ NODE_ENV: "development", NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE: "0" }, async (mod) => {
      await expect(mod.register()).resolves.toBeUndefined();
    });

    expect(logged()).toContain("NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE");
    expect(logged()).toContain("Not enforced outside production");
  });

  it("reports a warning without failing in production", async () => {
    await boot(
      { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://proofofheart.xyz" },
      async (mod) => {
        await expect(mod.register()).resolves.toBeUndefined();
      },
    );

    expect(logged()).toContain("NEXT_PUBLIC_SITE_URL");
    expect(logged()).toContain("WARNING");
  });

  it("fails production on a secret exposed to the browser", async () => {
    await boot(
      { NODE_ENV: "production", NEXT_PUBLIC_USE_MOCKS: "false", NEXT_PUBLIC_PINATA_JWT: "a.b.c" },
      async (mod) => {
        await expect(mod.register()).rejects.toThrow(/NEXT_PUBLIC_PINATA_JWT/);
      },
    );
  });

  it("summarises the network and variable count it booted with", async () => {
    await boot(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_USE_MOCKS: "false",
        NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
        NEXT_PUBLIC_NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015",
      },
      async (mod) => {
        await mod.register();
      },
    );

    // MAINNET_RPC_URL is unset, which is the warning that makes this boot log.
    // The counts are derived from the contract so this assertion cannot drift
    // when variables are added.
    const { CLIENT_ENV_KEYS, SERVER_ENV_KEYS } = await import("@/lib/runtimeEnv");
    expect(logged()).toContain(
      `Validated ${CLIENT_ENV_KEYS.length} client and ${SERVER_ENV_KEYS.length} server environment variables on mainnet`,
    );
    expect(logged()).toContain("MAINNET_RPC_URL");
  });

  it("does not warn about a mainnet RPC while the app is on testnet", async () => {
    await boot(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_USE_MOCKS: "false",
        NEXT_PUBLIC_CONTRACT_ADDRESS: `C${"A".repeat(56)}`,
      },
      async (mod) => {
        await mod.register();
      },
    );

    expect(logged()).not.toContain("MAINNET_RPC_URL");
  });
});
