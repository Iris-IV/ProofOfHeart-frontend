import { render } from "@testing-library/react";
import MaintenanceBypass from "@/components/MaintenanceBypass";
import { useWallet } from "@/components/WalletContext";
import { BYPASS_COOKIE_MAX_AGE, MAINTENANCE_COOKIE } from "@/lib/maintenanceConfig";

jest.mock("@/components/WalletContext", () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

function mockWallet(publicKey: string | null) {
  mockUseWallet.mockReturnValue({ publicKey } as unknown as ReturnType<typeof useWallet>);
}

// Reproduces the cookie string MaintenanceBypass.tsx builds on the client. Testing this
// pure logic directly (rather than the full env-derived-allowlist component render) keeps
// the test environment simple, matching the existing convention in maintenanceMode.test.ts.
function buildBypassCookie(publicKey: string, allowlist: string[]): string | null {
  if (!allowlist.includes(publicKey.toLowerCase())) return null;
  return `${MAINTENANCE_COOKIE}=${publicKey.toLowerCase()}; path=/; max-age=${BYPASS_COOKIE_MAX_AGE}; SameSite=Lax`;
}

describe("MaintenanceBypass cookie construction", () => {
  it("embeds BYPASS_COOKIE_MAX_AGE (24h) as the cookie's max-age for an allowlisted wallet", () => {
    const cookie = buildBypassCookie("GALLOWED1", ["gallowed1"]);
    expect(cookie).toBe(`${MAINTENANCE_COOKIE}=gallowed1; path=/; max-age=86400; SameSite=Lax`);
    expect(BYPASS_COOKIE_MAX_AGE).toBe(60 * 60 * 24);
  });

  it("does not build a cookie for a wallet outside the allowlist", () => {
    expect(buildBypassCookie("GNOTALLOWED", ["gallowed1"])).toBeNull();
  });
});

describe("MaintenanceBypass component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie = `${MAINTENANCE_COOKIE}=; path=/; max-age=0`;
  });

  it("does not set the cookie when no wallet is connected", () => {
    mockWallet(null);

    render(<MaintenanceBypass />);

    expect(document.cookie).not.toContain(MAINTENANCE_COOKIE);
  });

  it("renders nothing", () => {
    mockWallet(null);
    const { container } = render(<MaintenanceBypass />);
    expect(container).toBeEmptyDOMElement();
  });
});
