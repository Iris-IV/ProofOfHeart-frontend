/**
 * Tests for the maintenance-mode logic extracted from middleware.ts.
 * We test the pure helper functions rather than the Next.js middleware
 * runtime to keep the test environment simple.
 */

// ---- helpers copied from middleware (same logic, no Next.js runtime needed) ----

function isMaintenanceEnabled(env: Record<string, string | undefined>): boolean {
  return env["NEXT_PUBLIC_MAINTENANCE_MODE"] === "true";
}

function getAllowlist(env: Record<string, string | undefined>): string[] {
  const raw = env["NEXT_PUBLIC_MAINTENANCE_ALLOWLIST"] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isBypassed(cookieValue: string | undefined, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  return allowlist.includes((cookieValue ?? "").toLowerCase());
}

// ---- tests ----

describe("maintenance mode helpers", () => {
  describe("isMaintenanceEnabled", () => {
    it("returns true when flag is 'true'", () => {
      expect(isMaintenanceEnabled({ NEXT_PUBLIC_MAINTENANCE_MODE: "true" })).toBe(true);
    });

    it("returns false when flag is 'false'", () => {
      expect(isMaintenanceEnabled({ NEXT_PUBLIC_MAINTENANCE_MODE: "false" })).toBe(false);
    });

    it("returns false when flag is absent", () => {
      expect(isMaintenanceEnabled({})).toBe(false);
    });
  });

  describe("getAllowlist", () => {
    it("parses comma-separated addresses", () => {
      expect(getAllowlist({ NEXT_PUBLIC_MAINTENANCE_ALLOWLIST: "GABC, GDEF , gHIJ" })).toEqual([
        "gabc",
        "gdef",
        "ghij",
      ]);
    });

    it("returns empty array when env var is absent", () => {
      expect(getAllowlist({})).toEqual([]);
    });

    it("filters empty strings", () => {
      expect(getAllowlist({ NEXT_PUBLIC_MAINTENANCE_ALLOWLIST: "," })).toEqual([]);
    });
  });

  describe("isBypassed", () => {
    const allowlist = ["gadmin1", "gadmin2"];

    it("returns true when cookie matches an allowlisted address (case-insensitive)", () => {
      expect(isBypassed("GADMIN1", allowlist)).toBe(true);
    });

    it("returns false when cookie is not in allowlist", () => {
      expect(isBypassed("GOTHER", allowlist)).toBe(false);
    });

    it("returns false when allowlist is empty", () => {
      expect(isBypassed("GADMIN1", [])).toBe(false);
    });

    it("returns false when cookie is undefined", () => {
      expect(isBypassed(undefined, allowlist)).toBe(false);
    });
  });

  describe("redirect decision", () => {
    function shouldRedirect(
      env: Record<string, string | undefined>,
      cookieValue: string | undefined,
      pathname: string,
    ): boolean {
      const exempt =
        pathname === "/maintenance" ||
        pathname.startsWith("/api/") ||
        pathname.startsWith("/_next/") ||
        !!pathname.match(/\.(ico|svg|png)$/);

      if (!isMaintenanceEnabled(env)) return false;
      if (exempt) return false;
      if (isBypassed(cookieValue, getAllowlist(env))) return false;
      return true;
    }

    const maintenanceEnv = { NEXT_PUBLIC_MAINTENANCE_MODE: "true" };

    it("redirects a normal visitor during maintenance", () => {
      expect(shouldRedirect(maintenanceEnv, undefined, "/")).toBe(true);
    });

    it("does not redirect when maintenance is off", () => {
      expect(shouldRedirect({}, undefined, "/")).toBe(false);
    });

    it("does not redirect the /maintenance page itself", () => {
      expect(shouldRedirect(maintenanceEnv, undefined, "/maintenance")).toBe(false);
    });

    it("does not redirect API routes", () => {
      expect(shouldRedirect(maintenanceEnv, undefined, "/api/health")).toBe(false);
    });

    it("does not redirect an allowlisted admin", () => {
      const env = {
        ...maintenanceEnv,
        NEXT_PUBLIC_MAINTENANCE_ALLOWLIST: "gadmin",
      };
      expect(shouldRedirect(env, "gadmin", "/")).toBe(false);
    });
  });
});
