import { MAINTENANCE_COOKIE, BYPASS_COOKIE_MAX_AGE } from "@/lib/maintenanceConfig";

describe("maintenanceConfig", () => {
  it("exposes a 24 hour max age, in seconds", () => {
    expect(BYPASS_COOKIE_MAX_AGE).toBe(60 * 60 * 24);
  });

  it("exposes the maintenance bypass cookie name", () => {
    expect(MAINTENANCE_COOKIE).toBe("maintenance_bypass");
  });
});
