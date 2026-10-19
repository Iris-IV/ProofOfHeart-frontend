import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider, useWallet } from "../WalletContext";
import { isConnected, isAllowed, getAddress, getNetwork } from "@stellar/freighter-api";
import { useToast } from "../ToastProvider";
import { saveWalletPreference, clearWalletPreference } from "@/lib/stellar";

// Mock dependencies
jest.mock("../ToastProvider", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/lib/socialWallet", () => ({
  connectSocialWallet: jest.fn(),
  disconnectSocialWallet: jest.fn(),
  isSocialLoginConfigured: jest.fn().mockReturnValue(false),
  restoreSocialWallet: jest.fn().mockResolvedValue(null),
  socialSigner: null,
}));

const mockIsConnected = isConnected as jest.Mock;
const mockIsAllowed = isAllowed as jest.Mock;
const mockGetAddress = getAddress as jest.Mock;
const mockGetNetwork = getNetwork as jest.Mock;
const mockUseToast = useToast as jest.Mock;

const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockShowSuccess = jest.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

// Test component
const TestComponent = () => {
  const { publicKey, isWalletConnected, walletKind } = useWallet();
  return (
    <div>
      <div data-testid="publicKey">{publicKey}</div>
      <div data-testid="isConnected">{isWalletConnected.toString()}</div>
      <div data-testid="walletKind">{walletKind ?? "null"}</div>
    </div>
  );
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

describe("WalletContext auto-reconnect (#1532)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockUseToast.mockReturnValue({
      showError: mockShowError,
      showWarning: mockShowWarning,
      showSuccess: mockShowSuccess,
    });
    // Default to Freighter connected
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "GDEFAULT" });
    mockGetNetwork.mockResolvedValue({ network: "testnet", networkPassphrase: "" });
  });

  it("auto-reconnects Freighter on mount when a fresh preference exists", async () => {
    // Persist a Freighter preference
    saveWalletPreference("freighter", "GAUTO-RECONNECT");

    // Mock Freighter as connected with that address
    mockGetAddress.mockResolvedValue({ address: "GAUTO-RECONNECT" });

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    // The context should restore the connection
    expect(screen.getByTestId("publicKey")).toHaveTextContent("GAUTO-RECONNECT");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
    expect(screen.getByTestId("walletKind")).toHaveTextContent("freighter");
  });

  it("discards stale preference (older than 7 days)", async () => {
    // Save a preference with a timestamp 8 days ago
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      "stellar_wallet_preference",
      JSON.stringify({
        vendor: "freighter",
        publicKey: "GSTALE",
        savedAt: eightDaysAgo,
      }),
    );

    // Freighter is not connected
    mockIsConnected.mockResolvedValue({ isConnected: false });
    mockIsAllowed.mockResolvedValue({ isAllowed: false });

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    // The stale preference should be cleared and the wallet not connected
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(localStorage.getItem("stellar_wallet_preference")).toBeNull();
  });

  it("clears preference on explicit disconnect", async () => {
    saveWalletPreference("freighter", "GDISCONNECT-TEST");
    mockGetAddress.mockResolvedValue({ address: "GDISCONNECT-TEST" });

    const DisconnectTestComponent = () => {
      const { disconnectWallet } = useWallet();
      return (
        <div>
          <TestComponent />
          <button onClick={disconnectWallet}>Disconnect</button>
        </div>
      );
    };

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <DisconnectTestComponent />
        </WalletProvider>,
      );
    });

    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");

    // Disconnect
    await act(async () => {
      screen.getByText("Disconnect").click();
    });

    // Preference should be cleared
    expect(localStorage.getItem("stellar_wallet_preference")).toBeNull();
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
  });

  it("saves preference when Freighter connects", async () => {
    // Start with no connection
    mockIsConnected.mockResolvedValue({ isConnected: false });
    mockIsAllowed.mockResolvedValue({ isAllowed: false });

    const ConnectTestComponent = () => {
      const { connectWallet } = useWallet();
      return (
        <div>
          <TestComponent />
          <button onClick={connectWallet}>Connect</button>
        </div>
      );
    };

    renderWithProviders(
      <WalletProvider>
        <ConnectTestComponent />
      </WalletProvider>,
    );

    // Simulate Freighter becoming available
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "GCONNECT-NEW" });

    await act(async () => {
      screen.getByText("Connect").click();
    });

    // Preference should be saved
    const raw = localStorage.getItem("stellar_wallet_preference");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.vendor).toBe("freighter");
    expect(parsed.publicKey).toBe("GCONNECT-NEW");
  });

  it("clears preference on network mismatch", async () => {
    saveWalletPreference("freighter", "GWRONG-NETWORK");

    // Freighter connected but on wrong network
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "GWRONG-NETWORK" });
    mockGetNetwork.mockResolvedValue({
      network: "public",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    // The preference should be cleared due to network mismatch
    expect(localStorage.getItem("stellar_wallet_preference")).toBeNull();
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
  });
});
