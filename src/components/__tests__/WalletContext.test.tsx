import { render, screen, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider, useWallet } from "../WalletContext";
import { isConnected, isAllowed, getAddress } from "@stellar/freighter-api";
import { useToast } from "../ToastProvider";

// Mock dependencies
jest.mock("../ToastProvider", () => ({
  useToast: jest.fn(),
}));

const mockIsConnected = isConnected as jest.Mock;
const mockIsAllowed = isAllowed as jest.Mock;
const mockGetAddress = getAddress as jest.Mock;
const mockUseToast = useToast as jest.Mock;

const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockShowSuccess = jest.fn();

// Dummy component to test the context
const TestComponent = () => {
  const { publicKey, isWalletConnected, connectWallet, disconnectWallet, isLoading } = useWallet();
  return (
    <div>
      <div data-testid="publicKey">{publicKey}</div>
      <div data-testid="isConnected">{isWalletConnected.toString()}</div>
      <div data-testid="isLoading">{isLoading.toString()}</div>
      <button onClick={connectWallet}>Connect</button>
      <button onClick={disconnectWallet}>Disconnect</button>
    </div>
  );
};

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("WalletContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseToast.mockReturnValue({
      showError: mockShowError,
      showWarning: mockShowWarning,
      showSuccess: mockShowSuccess,
    });
    // Default to not connected
    // isConnected returns { isConnected: bool } per the Freighter API
    mockIsConnected.mockResolvedValue({ isConnected: false });
    mockIsAllowed.mockResolvedValue(false);
    mockGetAddress.mockResolvedValue({ address: "GB..." });

    // Mock window.open
    global.window.open = jest.fn();
  });

  it("checks wallet connection on mount - success path", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue(true);
    mockGetAddress.mockResolvedValue({ address: "G-MO-DEV-SUCCESS" });

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-MO-DEV-SUCCESS");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBe("G-MO-DEV-SUCCESS");
  });

  it("checks wallet connection on mount - failure path (not allowed)", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue(false);

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBeNull();
  });

  it("connectWallet - success path", async () => {
    // On mount: not connected; on connect click: connected
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue(true);
    mockGetAddress.mockResolvedValue({ address: "G-MO-DEV-CONNECT-SUCCESS" });

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-MO-DEV-CONNECT-SUCCESS");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
    expect(mockShowSuccess).toHaveBeenCalledWith("Wallet connected successfully.");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBe("G-MO-DEV-CONNECT-SUCCESS");
  });

  it("connectWallet - freighter not installed", async () => {
    // isFreighterInstalled checks result.isConnected; { isConnected: false } → not installed
    mockIsConnected.mockResolvedValue({ isConnected: false });

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    // Component shows InstallFreighterModal (setShowInstallPrompt) instead of window.open
    // Verify wallet stays disconnected and loading clears
    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
  });

  it("connectWallet - not allowed", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue(false);

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(mockShowWarning).toHaveBeenCalledWith("Please allow Freighter to connect to this site.");
    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
  });

  it("connectWallet - error path", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue(true);
    mockGetAddress.mockRejectedValue(new Error("Failed"));

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(mockShowError).toHaveBeenCalledWith("Failed to connect wallet. Please try again.");
    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
  });

  it("disconnectWallet", async () => {
    // Start with a connected wallet
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue(true);
    mockGetAddress.mockResolvedValue({ address: "G-DISCONNECT" });

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    // Initial connected state
    await act(async () => {}); // Wait for useEffect
    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");

    await act(async () => {
      fireEvent.click(screen.getByText("Disconnect"));
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBeNull();
    expect(mockShowWarning).toHaveBeenCalledWith(
      "Disconnected. To fully revoke Freighter access, open the extension and remove this site from Connected Sites.",
    );
  });

  it("throws error when used outside of Provider", () => {
    // Silence console.error for this test as we expect an error
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useWallet must be used within a WalletProvider");

    consoleSpy.mockRestore();
  });
});
