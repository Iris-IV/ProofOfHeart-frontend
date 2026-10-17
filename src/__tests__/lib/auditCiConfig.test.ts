/**
 * #1618 — the dependency-security policy check.
 *
 * The two invariants enforced here are the ones that rot silently: an
 * `audit-ci` allowlist entry that quietly outlives its expiry, and a second
 * package manager's lockfile creeping back in next to `package-lock.json`, so
 * contributors and CI resolve different dependency trees (#1663).
 *
 * `checkAuditPolicy` is called with an explicit `today` so the expiry cases are
 * deterministic rather than dependent on the day the suite runs.
 */

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS build script, no type declarations to import
import {
  FOREIGN_LOCKFILES,
  checkAuditPolicy,
  normaliseExpiry,
  validateAuditCiConfig,
  validateSinglePackageManager,
} from "../../../scripts/check-audit-policy.mjs";

const TODAY = "2026-09-27";
const ROOT = join(__dirname, "..", "..", "..");

type PolicyIssue = { severity: "error" | "warning"; source: string; message: string };

/** Validate a config, returning only the messages so tests read cleanly. */
function messages(config: unknown, today = TODAY): string[] {
  return validateAuditCiConfig(config as Record<string, unknown>, { today }).map(
    (issue) => issue.message,
  );
}

function errorsOnly(config: unknown, today = TODAY): PolicyIssue[] {
  return validateAuditCiConfig(config as Record<string, unknown>, { today }).filter(
    (issue) => issue.severity === "error",
  );
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

    expect(issues[0]?.message).toContain("has 2 keys");
  });

  it("requires notes on every entry", () => {
    const issues = errorsOnly({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: [{ toml: { active: true, expiry: "2030-01-01" } }],
    });

    expect(issues[0]?.message).toContain("has no notes");
  });

  it("requires an expiry on every entry", () => {
    const issues = errorsOnly({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: [{ toml: { active: true, notes: "dev only" } }],
    });

    expect(issues[0]?.message).toContain("has no expiry");
  });

  it("fails an entry whose expiry has passed", () => {
    const issues = errorsOnly({
      critical: true,
      high: true,
      "package-manager": "npm",
      allowlist: [{ toml: { active: true, notes: "dev only", expiry: "2026-01-01" } }],
    });

    expect(issues[0]?.message).toContain("expired on 2026-01-01");
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
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.message).toContain("expires today");
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

    expect(issues[0]?.message).toContain("unreadable expiry");
  });

  it("warns about a bare-string allowlist entry", () => {
    const issues = validateAuditCiConfig(
      { critical: true, high: true, "package-manager": "npm", allowlist: ["toml"] },
      { today: TODAY },
    );

    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.message).toContain("bare string");
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

    expect(issues[0]?.message).toContain('"active": false');
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

describe("validateSinglePackageManager", () => {
  it("accepts npm with no foreign lockfiles", () => {
    expect(validateSinglePackageManager({ files: [], packageManager: "npm@10.9.0" })).toEqual([]);
  });

  it("reports each foreign lockfile that is present", () => {
    const issues = validateSinglePackageManager({
      files: ["pnpm-lock.yaml", "yarn.lock"],
      packageManager: "npm@10.9.0",
    });

    expect(issues.map((issue: PolicyIssue) => issue.source)).toEqual([
      "pnpm-lock.yaml",
      "yarn.lock",
    ]);
    expect(issues.every((issue: PolicyIssue) => issue.severity === "error")).toBe(true);
  });

  it("requires packageManager to name npm", () => {
    for (const packageManager of [undefined, "", "pnpm@9.0.0", "yarn@4.0.0", "npm"]) {
      const issues = validateSinglePackageManager({ files: [], packageManager });
      expect(issues).toHaveLength(1);
      expect(issues[0]?.source).toBe("package.json");
    }
  });
});

describe("checkAuditPolicy lockfile check", () => {
  it("fails when a pnpm lockfile is added back", () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-policy-"));
    try {
      cpSync(join(ROOT, "audit-ci.json"), join(dir, "audit-ci.json"));
      cpSync(join(ROOT, "package.json"), join(dir, "package.json"));
      expect(checkAuditPolicy({ root: dir, today: TODAY }).issues).toEqual([]);

      writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      const issues = checkAuditPolicy({ root: dir, today: TODAY }).issues;

      expect(issues).toHaveLength(1);
      expect(issues[0]?.source).toBe("pnpm-lock.yaml");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

  it("commits package-lock.json and no other lockfile", () => {
    expect(existsSync(join(ROOT, "package-lock.json"))).toBe(true);
    for (const file of FOREIGN_LOCKFILES) {
      expect(existsSync(join(ROOT, file))).toBe(false);
    }
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
