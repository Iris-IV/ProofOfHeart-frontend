import { render } from "@testing-library/react";

/**
 * `@/middleware` transitively pulls in `next-intl/middleware`, which ships
 * ESM Jest can't parse — stub the two exported constants it actually uses
 * instead of importing the real module (issue #1109).
 */
jest.mock("@/middleware", () => ({
  MAINTENANCE_COOKIE: "maintenance_bypass",
  BYPASS_COOKIE_MAX_AGE: 86400,
}));

const mockUseWallet = jest.fn();
jest.mock("@/components/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

const ALLOWLISTED_KEY = "GADMIN1111111111111111111111111111111111111111111111111111";

// `MaintenanceBypass` reads NEXT_PUBLIC_MAINTENANCE_ALLOWLIST into a
// module-level constant at import time, so the env var must be set before
// the module is first required — hence a plain `require` here (after the
// assignment) rather than a hoisted `import`.
process.env.NEXT_PUBLIC_MAINTENANCE_ALLOWLIST = ALLOWLISTED_KEY.toLowerCase();
const MaintenanceBypass = require("@/components/MaintenanceBypass").default;

describe("MaintenanceBypass cookie (issue #1109)", () => {
  let cookieWrites: string[];

  beforeEach(() => {
    cookieWrites = [];
    jest.spyOn(document, "cookie", "set").mockImplementation((value: string) => {
      cookieWrites.push(value);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sets the bypass cookie with the shared max-age when the wallet is allowlisted", () => {
    mockUseWallet.mockReturnValue({ publicKey: ALLOWLISTED_KEY });

    render(<MaintenanceBypass />);

    expect(cookieWrites).toHaveLength(1);
    expect(cookieWrites[0]).toContain(`maintenance_bypass=${ALLOWLISTED_KEY.toLowerCase()}`);
    expect(cookieWrites[0]).toContain("max-age=86400");
  });

  it("does not set a cookie for a wallet outside the allowlist", () => {
    mockUseWallet.mockReturnValue({
      publicKey: "GNOTALLOWED0000000000000000000000000000000000000000000000",
    });

    render(<MaintenanceBypass />);

    expect(cookieWrites).toHaveLength(0);
  });
});
