/**
 * #1618 — the dependency-security policy check.
 *
 * The two invariants enforced here are the ones that rot silently: an
 * `audit-ci` allowlist entry that quietly outlives its expiry, and an `overrides`
 * pin that exists in `package.json` but not in `pnpm-workspace.yaml` (or the
 * reverse), so npm and pnpm resolve different versions and the pin protects only
 * whichever one CI happens to use.
 *
 * `checkAuditPolicy` is called with an explicit `today` so the expiry cases are
 * deterministic rather than dependent on the day the suite runs.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS build script, no type declarations to import
import {
  checkAuditPolicy,
  flattenOverrides,
  normaliseExpiry,
  parsePnpmOverrides,
  validateAuditCiConfig,
  validateOverrideParity,
} from "../../../scripts/check-audit-policy.mjs";

const TODAY = "2026-09-27";
const ROOT = join(__dirname, "..", "..", "..");

type PolicyIssue = { severity: "error" | "warning"; source: string; message: string };

/** Validate a config, returning only the messages so tests read cleanly. */
function messages(config: unknown, today = TODAY): string[] {
  return validateAuditCiConfig(config, { today }).map((issue) => issue.message);
}

function errorsOnly(config: unknown, today = TODAY): PolicyIssue[] {
  return validateAuditCiConfig(config, { today }).filter((issue) => issue.severity === "error");
}

describe("validateAuditCiConfig", () => {
  it("rejects a config that is not an object", () => {
    expect(messages(undefined)).toEqual(["is not a JSON object"]);
  });

  it("requires high and critical to gate", () => {
    const issues = messages({ critical: false, high: false });

    expect(issues).toContain('must set "critical": true');
    expect(issues).toContain('must set "high": true');
  });

  it("requires a pinned package manager", () => {
    expect(messages({ critical: true, high: true }).join("\n")).toContain(
      'must pin "package-manager"',
    );
  });

  it("accepts a minimal correct config", () => {
    expect(errorsOnly({ critical: true, high: true, "package-manager": "npm" })).toEqual([]);
  });

  it("rejects an allowlist that is an object", () => {
    const issues = messages({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: { toml: { active: true } },
    });

    // This is the exact shape that makes audit-ci exit 1 with a TypeError.
    expect(issues).toContain(
      '"allowlist" must be an array; audit-ci rejects an object with "recordsOrIds is not iterable"',
    );
  });

  it("rejects an allowlist entry with more than one module", () => {
    const issues = errorsOnly({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: [
        { a: { expiry: "2030-01-01", notes: "n" }, b: { expiry: "2030-01-01", notes: "n" } },
      ],
    });

    expect(issues[0].message).toContain("has 2 keys");
  });

  it("requires notes on every entry", () => {
    const issues = errorsOnly({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: [{ toml: { active: true, expiry: "2030-01-01" } }],
    });

    expect(issues[0].message).toContain("has no notes");
  });

  it("requires an expiry on every entry", () => {
    const issues = errorsOnly({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: [{ toml: { active: true, notes: "dev only" } }],
    });

    expect(issues[0].message).toContain("has no expiry");
  });

  it("fails an entry whose expiry has passed", () => {
    const issues = errorsOnly({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: [{ toml: { active: true, notes: "dev only", expiry: "2026-01-01" } }],
    });

    expect(issues[0].message).toContain("expired on 2026-01-01");
  });

  it("warns on an entry that expires today", () => {
    const issues = validateAuditCiConfig(
      {
        critical: true,
        high: true,
        "package-manager": "npm",
        allowlist: [{ toml: { active: true, notes: "dev only", expiry: TODAY } }],
      },
      { today: TODAY },
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("expires today");
  });

  it("accepts an entry whose expiry is still in the future", () => {
    expect(
      errorsOnly({
        critical: true,
        high: true,
        "package-manager": "npm",
        allowlist: [{ toml: { active: true, notes: "dev only", expiry: "2026-12-31" } }],
      }),
    ).toEqual([]);
  });

  it("rejects an unreadable expiry", () => {
    const issues = errorsOnly({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: [{ toml: { active: true, notes: "dev only", expiry: "someday" } }],
    });

    expect(issues[0].message).toContain("unreadable expiry");
  });

  it("warns about a bare-string allowlist entry", () => {
    const issues = validateAuditCiConfig(
      { critical: true, high: true, "package-manager": "npm", allowlist: ["toml"] },
      { today: TODAY },
    );

    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("bare string");
  });

  it("warns about an entry marked inactive", () => {
    const issues = validateAuditCiConfig(
      {
        critical: true,
        high: true,
        "package-manager": "npm",
        allowlist: [{ toml: { active: false, notes: "dev only", expiry: "2030-01-01" } }],
      },
      { today: TODAY },
    );

    expect(issues[0].message).toContain('"active": false');
  });
});

describe("normaliseExpiry", () => {
  it("passes an ISO date through", () => {
    expect(normaliseExpiry("2026-12-31")).toBe("2026-12-31");
  });

  it("resolves a day count against today", () => {
    expect(normaliseExpiry(30, "2026-09-27")).toBe("2026-10-27");
  });

  it("resolves zero days to today", () => {
    expect(normaliseExpiry(0, "2026-09-27")).toBe("2026-09-27");
  });

  it("rejects nonsense", () => {
    expect(normaliseExpiry("someday")).toBeNull();
    expect(normaliseExpiry(Number.NaN)).toBeNull();
    expect(normaliseExpiry(null)).toBeNull();
  });
});

describe("flattenOverrides", () => {
  it("leaves a flat block alone", () => {
    expect(flattenOverrides({ toml: "^4.3.0" })).toEqual({ toml: "^4.3.0" });
  });

  it("turns a nested object into a path key, the way pnpm spells it", () => {
    expect(flattenOverrides({ "webpack-bundle-analyzer": { ws: "^7.5.11" } })).toEqual({
      "webpack-bundle-analyzer>ws": "^7.5.11",
    });
  });

  it("flattens more than one level", () => {
    expect(flattenOverrides({ a: { b: { c: "1" } } })).toEqual({ "a>b>c": "1" });
  });
});

describe("validateOverrideParity", () => {
  it("accepts identical flat blocks", () => {
    expect(
      validateOverrideParity({ overrides: { toml: "^4.3.0" }, pnpmOverrides: { toml: "^4.3.0" } }),
    ).toEqual([]);
  });

  it("accepts a nested npm block that matches the pnpm path form", () => {
    expect(
      validateOverrideParity({
        overrides: { "webpack-bundle-analyzer": { ws: "^7.5.11" } },
        pnpmOverrides: { "webpack-bundle-analyzer>ws": "^7.5.11" },
      }),
    ).toEqual([]);
  });

  it("reports a pin missing from pnpm", () => {
    const issues = validateOverrideParity({
      overrides: { toml: "^4.3.0" },
      pnpmOverrides: {},
    });

    expect(issues[0].message).toContain('is missing the "toml" pin');
  });

  it("reports a pin missing from package.json", () => {
    const issues = validateOverrideParity({
      overrides: {},
      pnpmOverrides: { toml: "^4.3.0" },
    });

    expect(issues[0].source).toBe("package.json");
    expect(issues[0].message).toContain('is missing the "toml" pin');
  });

  it("reports a pin whose version differs", () => {
    const issues = validateOverrideParity({
      overrides: { toml: "^4.3.0" },
      pnpmOverrides: { toml: "^3.0.0" },
    });

    expect(issues[0].message).toContain(
      'pins "toml" to "^3.0.0" but package.json pins it to "^4.3.0"',
    );
  });

  it("reports a missing block on either side", () => {
    expect(validateOverrideParity({ overrides: null, pnpmOverrides: {} })[0].message).toContain(
      'has no "overrides"',
    );
    expect(validateOverrideParity({ overrides: {}, pnpmOverrides: null })[0].message).toContain(
      'has no "overrides"',
    );
  });
});

describe("parsePnpmOverrides", () => {
  it("reads a flat block and ignores unquoted scalars", () => {
    const parsed = parsePnpmOverrides(
      ["overrides:", '  toml: "^4.3.0"', "  ws: ^8.21.0", "  'brace-expansion@1': ^1.1.17"].join(
        "\n",
      ),
    );

    expect(parsed).toEqual({
      toml: "^4.3.0",
      ws: "^8.21.0",
      "brace-expansion@1": "^1.1.17",
    });
  });

  it("stops at the next top-level key", () => {
    const parsed = parsePnpmOverrides(
      ["overrides:", "  toml: ^4.3.0", "somethingElse:", "  other: 1"].join("\n"),
    );

    expect(parsed).toEqual({ toml: "^4.3.0" });
  });

  it("returns null when there is no block", () => {
    expect(parsePnpmOverrides("allowBuilds:\n  sharp: true\n")).toBeNull();
  });

  it("throws rather than silently misreading a nested list", () => {
    expect(() => parsePnpmOverrides(["overrides:", "  - a", "  - b"].join("\n"))).toThrow(
      /nested list/,
    );
  });
});

describe("this repository", () => {
  const report = () => checkAuditPolicy({ root: ROOT, today: TODAY });

  it("has a policy that holds", () => {
    expect(report().issues).toEqual([]);
  });

  it("gates on high and critical", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "audit-ci.json"), "utf-8"));

    expect(config.high).toBe(true);
    expect(config.critical).toBe(true);
  });

  it("pins the package manager rather than auto-detecting it", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "audit-ci.json"), "utf-8"));

    expect(config["package-manager"]).toBe("npm");
  });

  it("keeps package.json and pnpm-workspace.yaml overrides in sync", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    const yaml = readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf-8");

    expect(
      validateOverrideParity({ overrides: pkg.overrides, pnpmOverrides: parsePnpmOverrides(yaml) }),
    ).toEqual([]);
  });

  it("documents a rationale for every override", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));

    expect(typeof pkg._overridesRationale).toBe("string");
    expect(pkg._overridesRationale.length).toBeGreaterThan(0);
  });

  it("keeps every allowlist entry justified and unexpired", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "audit-ci.json"), "utf-8"));

    expect(Array.isArray(config.allowlist)).toBe(true);
    expect(validateAuditCiConfig(config, { today: TODAY })).toEqual([]);
  });
});
