import { render } from "@testing-library/react";
import MaintenanceBypass from "@/components/MaintenanceBypass";
import { useWallet } from "@/components/WalletContext";
import { MAINTENANCE_COOKIE } from "@/lib/maintenanceConfig";

jest.mock("@/components/WalletContext", () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

function mockWallet(publicKey: string | null) {
  mockUseWallet.mockReturnValue({ publicKey } as unknown as ReturnType<typeof useWallet>);
}

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
