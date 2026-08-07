import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationSettings from "@/components/NotificationSettings";
import { useWallet } from "@/components/WalletContext";

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showWarning: jest.fn(),
    showInfo: jest.fn(),
    showToast: jest.fn(),
    showToastWithAction: jest.fn(),
  }),
}));

jest.mock("@/components/WalletContext", () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockPublicKey = "GCONTRIB1111111111111111111111111111111111111111111111111";

const mockLocalStorage: Record<string, string> = {};
let getItemSpy: jest.SpyInstance;
let setItemSpy: jest.SpyInstance;

beforeEach(() => {
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  getItemSpy = jest.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => mockLocalStorage[key] ?? null);
  setItemSpy = jest.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
    mockLocalStorage[key] = value;
  });
  mockUseWallet.mockReturnValue({
    publicKey: mockPublicKey,
    isWalletConnected: true,
    isLoading: false,
    walletNetworkWarning: null,
    connectWallet: jest.fn(),
    disconnectWallet: jest.fn(),
    walletKind: "freighter",
    socialProfile: null,
    isSocialLoginAvailable: false,
    connectWithSocial: jest.fn(),
  });
});

afterEach(() => {
  getItemSpy?.mockRestore();
  setItemSpy?.mockRestore();
});

describe("NotificationSettings", () => {
  beforeEach(() => {
    mockLocalStorage[`notif_prefs_${mockPublicKey.toLowerCase()}`] = JSON.stringify({
      contributions: true,
      verified: true,
      refundAvailable: true,
      revenueDeposited: true,
    });
  });

  it("renders toggle switches for all notification events", async () => {
    render(<NotificationSettings />);

    const settingsButton = screen.getByRole("button", { name: /settingsAriaLabel/i });
    await userEvent.click(settingsButton);

    expect(screen.getByText("prefContributions")).toBeInTheDocument();
    expect(screen.getByText("prefVerified")).toBeInTheDocument();
    expect(screen.getByText("prefRefundAvailable")).toBeInTheDocument();
    expect(screen.getByText("prefRevenueDeposited")).toBeInTheDocument();
  });

  it("toggles a preference and persists to localStorage", async () => {
    render(<NotificationSettings />);

    const settingsButton = screen.getByRole("button", { name: /settingsAriaLabel/i });
    await userEvent.click(settingsButton);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();

    await userEvent.click(checkboxes[0]);

    const stored = JSON.parse(
      mockLocalStorage[`notif_prefs_${mockPublicKey.toLowerCase()}`],
    );
    expect(stored.contributions).toBe(false);
  });

  it("returns null when no wallet is connected", () => {
    mockUseWallet.mockReturnValue({
      publicKey: null,
      isWalletConnected: false,
      isLoading: false,
      walletNetworkWarning: null,
      connectWallet: jest.fn(),
      disconnectWallet: jest.fn(),
      walletKind: null,
      socialProfile: null,
      isSocialLoginAvailable: false,
      connectWithSocial: jest.fn(),
    });

    const { container } = render(<NotificationSettings />);
    expect(container).toBeEmptyDOMElement();
  });
});
