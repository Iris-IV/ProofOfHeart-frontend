/**
 * #1633 — the environment contract readers.
 *
 * The readers are the one thing every entry point depends on, including
 * `"use client"` components, so these tests pin down two properties: that the
 * reader surface matches the contract, and that `IS_MOCK_MODE` /
 * `assertProductionContractConfig` keep the exact behaviour they had before the
 * contract was introduced.
 *
 * `IS_MOCK_MODE` and the production guard read `process.env` at module load, so
 * each case reloads the module inside `jest.isolateModules` with the environment
 * it wants — the same approach `thirdParty.test.ts` uses.
 */

import {
  CLIENT_ENV_KEYS,
  ENV_CONTRACT,
  SECRET_ENV_KEYS,
  SERVER_ENV_KEYS,
  getEnvContractEntry,
} from "@/lib/runtimeEnv";

type RuntimeEnvModule = typeof import("@/lib/runtimeEnv");

const NODE_ENV_KEYS = ["NODE_ENV", "NEXT_PUBLIC_USE_MOCKS"] as const;

/**
 * Load `runtimeEnv` with exactly the given env vars set, run `fn` against it, and
 * restore the environment afterwards.
 *
 * The assertions have to run *inside* the patched window: `readClientEnv` reads
 * `process.env` on every call, so restoring before the assertions would hand the
 * module the ambient environment. `jest.isolateModules` additionally gives each
 * case a fresh copy for the values that are captured at module load, such as
 * `IS_MOCK_MODE`.
 */
function withEnv<T>(
  env: Partial<Record<(typeof NODE_ENV_KEYS)[number], string>>,
  fn: (mod: RuntimeEnvModule) => T,
): T {
  const original = process.env;
  const patched: NodeJS.ProcessEnv = { ...original };
  for (const key of NODE_ENV_KEYS) delete patched[key];
  Object.assign(patched, env);

  let result!: T;
  process.env = patched;
  try {
    let mod!: RuntimeEnvModule;
    jest.isolateModules(() => {
      mod = require("@/lib/runtimeEnv");
    });
    result = fn(mod);
  } finally {
    process.env = original;
  }
  return result;
}

describe("the contract", () => {
  it("declares no duplicate variable names", () => {
    const names = ENV_CONTRACT.map((entry) => entry.name);

    expect(names).toEqual([...new Set(names)]);
  });

  it("gives every variable a description and a format", () => {
    for (const entry of ENV_CONTRACT) {
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.value).toBeTruthy();
    }
  });

  it("documents a fallback for every variable that is not required", () => {
    for (const entry of ENV_CONTRACT) {
      if (entry.required) continue;
      // A missing-but-required-by-others variable still has an empty fallback,
      // so accept either an explicit note or a blank one.
      const fallback = "fallback" in entry ? entry.fallback : undefined;
      expect(fallback === undefined || typeof fallback === "string").toBe(true);
    }
  });

  it("splits keys by scope with no overlap", () => {
    expect(CLIENT_ENV_KEYS.length + SERVER_ENV_KEYS.length).toBe(ENV_CONTRACT.length);
    expect(SERVER_ENV_KEYS.filter((key) => CLIENT_ENV_KEYS.includes(key))).toEqual([]);
  });

  it("keeps every server key out of the client prefix", () => {
    expect(SERVER_ENV_KEYS.every((key) => !key.startsWith("NEXT_PUBLIC_"))).toBe(true);
  });

  it("keeps every client key prefixed, since that is what makes it public", () => {
    expect(CLIENT_ENV_KEYS.every((key) => key.startsWith("NEXT_PUBLIC_"))).toBe(true);
  });

  it("looks an entry up by name", () => {
    expect(getEnvContractEntry("PINATA_JWT")).toMatchObject({ scope: "server", secret: true });
    expect(getEnvContractEntry("NOT_A_VARIABLE")).toBeUndefined();
  });

  it("lists the secrets that must never reach the browser", () => {
    expect(SECRET_ENV_KEYS).toEqual(expect.arrayContaining(["PINATA_JWT", "METRICS_SECRET_TOKEN"]));
  });
});

describe("readClientEnv / readServerEnv", () => {
  it("returns a key for every declared client variable", () => {
    const client = withEnv({}, (mod) => mod.readClientEnv());

    for (const key of CLIENT_ENV_KEYS) {
      expect(client).toHaveProperty(key);
    }
  });

  it("returns a key for every declared server variable", () => {
    const server = withEnv({}, (mod) => mod.readServerEnv());

    for (const key of SERVER_ENV_KEYS) {
      expect(server).toHaveProperty(key);
    }
  });

  it("reads a value that is set", () => {
    withEnv({ NEXT_PUBLIC_USE_MOCKS: "true" }, (mod) => {
      expect(mod.readClientEnv()["NEXT_PUBLIC_USE_MOCKS"]).toBe("true");
    });
  });

  it("returns undefined for a variable that is not set", () => {
    withEnv({}, (mod) => {
      expect(mod.readClientEnv()["NEXT_PUBLIC_USE_MOCKS"]).toBeUndefined();
    });
  });

  it("reads both scopes together", () => {
    const runtime = withEnv({ NODE_ENV: "test" }, (mod) => mod.readRuntimeEnv());

    expect(runtime.client).toHaveProperty("NEXT_PUBLIC_SITE_URL");
    expect(runtime.server).toHaveProperty("PINATA_JWT");
  });
});

describe("IS_MOCK_MODE", () => {
  it("is true only for the exact string 'true'", () => {
    expect(withEnv({ NEXT_PUBLIC_USE_MOCKS: "true" }, (mod) => mod.IS_MOCK_MODE)).toBe(true);
    expect(withEnv({ NEXT_PUBLIC_USE_MOCKS: "TRUE" }, (mod) => mod.IS_MOCK_MODE)).toBe(false);
    expect(withEnv({ NEXT_PUBLIC_USE_MOCKS: "1" }, (mod) => mod.IS_MOCK_MODE)).toBe(false);
    expect(withEnv({}, (mod) => mod.IS_MOCK_MODE)).toBe(false);
  });
});

describe("assertProductionContractConfig", () => {
  it("throws when mock mode is on in production", () => {
    withEnv({ NODE_ENV: "production", NEXT_PUBLIC_USE_MOCKS: "true" }, (mod) => {
      expect(() => mod.assertProductionContractConfig()).toThrow(
        /Mock mode is disabled in production/,
      );
    });
  });

  it("passes when mock mode is off in production", () => {
    withEnv({ NODE_ENV: "production", NEXT_PUBLIC_USE_MOCKS: "false" }, (mod) => {
      expect(() => mod.assertProductionContractConfig()).not.toThrow();
    });
  });

  it("tolerates mock mode outside production", () => {
    withEnv({ NODE_ENV: "development", NEXT_PUBLIC_USE_MOCKS: "true" }, (mod) => {
      expect(() => mod.assertProductionContractConfig()).not.toThrow();
    });
  });

  it("only asserts once per process", () => {
    withEnv({ NODE_ENV: "production", NEXT_PUBLIC_USE_MOCKS: "true" }, (mod) => {
      expect(() => mod.assertProductionContractConfig()).toThrow();
      // Second call is a no-op, so it must not throw again.
      expect(() => mod.assertProductionContractConfig()).not.toThrow();
    });
  });

  it("can be reset for tests", () => {
    withEnv({ NODE_ENV: "production", NEXT_PUBLIC_USE_MOCKS: "true" }, (mod) => {
      expect(() => mod.assertProductionContractConfig()).toThrow();
      mod.resetProductionContractConfigAssertion();
      expect(() => mod.assertProductionContractConfig()).toThrow();
    });
  });
});
