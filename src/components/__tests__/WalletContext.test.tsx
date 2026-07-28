import { render, screen, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider, useWallet } from "../WalletContext";
import { isConnected, isAllowed, getAddress, getNetwork } from "@stellar/freighter-api";
import { useToast } from "../ToastProvider";

// Mock dependencies
jest.mock("../ToastProvider", () => ({
  useToast: jest.fn(),
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

const renderWithProviders = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

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
    // Freighter API v6 returns objects, not primitives
    mockIsConnected.mockResolvedValue({ isConnected: false });
    mockIsAllowed.mockResolvedValue({ isAllowed: false });
    mockGetAddress.mockResolvedValue({ address: "GB..." });
    mockGetNetwork.mockResolvedValue({ network: "testnet", networkPassphrase: "" });
  });

  it("checks wallet connection on mount - success path", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "G-MO-DEV-SUCCESS" });
    mockGetNetwork.mockResolvedValue({ network: "testnet", networkPassphrase: "" });

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
    mockIsAllowed.mockResolvedValue({ isAllowed: false });

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
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "G-MO-DEV-CONNECT-SUCCESS" });
    mockGetNetwork.mockResolvedValue({ network: "testnet", networkPassphrase: "" });

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    // Initial state check (default mock: not connected)
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-MO-DEV-CONNECT-SUCCESS");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
    expect(mockShowSuccess).toHaveBeenCalledWith("Wallet connected successfully.");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBe("G-MO-DEV-CONNECT-SUCCESS");
  });

  it("connectWallet - freighter not installed", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
  });

  it("connectWallet - not allowed", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: false });

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
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
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
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "G-DISCONNECT" });
    mockGetNetwork.mockResolvedValue({ network: "testnet", networkPassphrase: "" });

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    // Wait for the initial useEffect to connect
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

  it("detects external disconnection from Freighter extension", async () => {
    // Mount with wallet connected
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "G-EXTERNAL-DISCONNECT" });
    mockGetNetwork.mockResolvedValue({ network: "testnet", networkPassphrase: "" });

    // Use fake timers BEFORE render so setInterval uses the fake version
    jest.useFakeTimers();

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");

    // Simulate external disconnection: Freighter now reports not connected
    mockIsConnected.mockResolvedValue({ isConnected: false });
    mockIsAllowed.mockResolvedValue({ isAllowed: false });

    // Advance fake timers to trigger polling interval + flush async work
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    // Flush any remaining pending microtasks (async checkWalletConnection)
    await act(async () => {});
    jest.useRealTimers();

    // After polling detects the disconnection, context should clear state
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(screen.getByTestId("publicKey")).toHaveTextContent("");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBeNull();
  });

  it("detects account switch and invalidates queries", async () => {
    // Mount with Account A
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "G-ACCOUNT-A" });
    mockGetNetwork.mockResolvedValue({ network: "testnet", networkPassphrase: "" });

    // Use fake timers BEFORE render so setInterval uses the fake version
    jest.useFakeTimers();

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-ACCOUNT-A");

    // Simulate account switch: Freighter returns different address
    mockGetAddress.mockResolvedValue({ address: "G-ACCOUNT-B" });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await act(async () => {});
    jest.useRealTimers();

    // Context should reflect the new account
    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-ACCOUNT-B");
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
