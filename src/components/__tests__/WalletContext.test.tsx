import { isConnected, isAllowed, getAddress } from "@stellar/freighter-api";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useToast } from "../ToastProvider";
import { WalletProvider, useWallet } from "../WalletContext";

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
    mockIsConnected.mockResolvedValue(false);
    mockIsAllowed.mockResolvedValue(false);
    mockGetAddress.mockResolvedValue({ address: "GB..." });
    
    // Mock window.open
    global.window.open = jest.fn();
  });

  it("checks wallet connection on mount - success path", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockIsAllowed.mockResolvedValue(true);
    mockGetAddress.mockResolvedValue({ address: "G-MO-DEV-SUCCESS" });

    await act(async () => {
      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-MO-DEV-SUCCESS");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBe("G-MO-DEV-SUCCESS");
  });

  it("checks wallet connection on mount - failure path (not allowed)", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockIsAllowed.mockResolvedValue(false);

    await act(async () => {
      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      );
    });

    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBeNull();
  });

  it("connectWallet - success path", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockIsAllowed.mockResolvedValue(true);
    mockGetAddress.mockResolvedValue({ address: "G-MO-DEV-CONNECT-SUCCESS" });

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    // Initial state check
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
    mockIsConnected.mockResolvedValue(false);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(mockShowWarning).toHaveBeenCalledWith("Freighter wallet not found. Opening install page…");
    expect(global.window.open).toHaveBeenCalledWith("https://www.freighter.app/", "_blank");
    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
  });

  it("connectWallet - not allowed", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockIsAllowed.mockResolvedValue(false);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(mockShowWarning).toHaveBeenCalledWith("Please allow Freighter to connect to this site.");
    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
  });

  it("connectWallet - error path", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockIsAllowed.mockResolvedValue(true);
    mockGetAddress.mockRejectedValue(new Error("Failed"));

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(mockShowError).toHaveBeenCalledWith("Failed to connect wallet. Please try again.");
    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
  });

  it("disconnectWallet", async () => {
    // Start with a connected wallet
    mockIsConnected.mockResolvedValue(true);
    mockIsAllowed.mockResolvedValue(true);
    mockGetAddress.mockResolvedValue({ address: "G-DISCONNECT" });

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
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
      "Disconnected. To fully revoke Freighter access, open the extension and remove this site from Connected Sites."
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
