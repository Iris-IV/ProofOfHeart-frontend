import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider, useWallet } from "../WalletContext";
import { useToast } from "../ToastProvider";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.mock("../ToastProvider", () => ({
  useToast: jest.fn(),
}));

// Mock the wallet adapters module so we control isAvailable / getAddress
jest.mock("@/lib/walletAdapters", () => {
  const freighterAdapter = {
    id: "freighter",
    name: "Freighter",
    installUrl: "https://www.freighter.app/",
    icon: "🚀",
    isAvailable: jest.fn().mockResolvedValue(true),
    getAddress: jest.fn().mockResolvedValue("G-FREIGHTER-ADDRESS"),
    signTransaction: jest.fn(),
    watchChanges: jest.fn(),
    stopWatching: jest.fn(),
  };

  return {
    WALLET_ADAPTERS: [freighterAdapter],
    MockAdapter: jest.fn().mockImplementation((key: string) => ({
      id: "mock",
      name: "Mock Wallet",
      isAvailable: jest.fn().mockResolvedValue(true),
      getAddress: jest.fn().mockResolvedValue(key),
      signTransaction: jest.fn(),
      watchChanges: jest.fn(),
      stopWatching: jest.fn(),
    })),
    UserCancelledError: class UserCancelledError extends Error {
      constructor() {
        super("Transaction cancelled");
        this.name = "UserCancelledError";
      }
    },
  };
});

// Mock contractClient.setActiveWalletAdapter so we don't pull in the full module
jest.mock("@/lib/contractClient", () => ({
  setActiveWalletAdapter: jest.fn(),
}));

// Mock the freighter-api isAllowed (used in handleAdapterSelected for freighter)
jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn().mockResolvedValue({ isConnected: false }),
  isAllowed: jest.fn().mockResolvedValue(true),
  getAddress: jest.fn().mockResolvedValue({ address: "" }),
  getNetwork: jest.fn().mockResolvedValue({ networkPassphrase: "" }),
  WatchWalletChanges: jest.fn().mockImplementation(() => ({
    watch: jest.fn(),
    stop: jest.fn(),
  })),
  signTransaction: jest.fn(),
}));

// Mock WalletSelectionModal — capture the onSelect callback so tests can invoke it
let capturedOnSelect: ((walletId: string) => void) | null = null;
jest.mock("../WalletSelectionModal", () => ({
  __esModule: true,
  default: ({
    isOpen,
    onSelect,
    onClose,
  }: {
    isOpen: boolean;
    onSelect: (id: string) => void;
    onClose: () => void;
  }) => {
    if (!isOpen) return null;
    capturedOnSelect = onSelect;
    return (
      <div data-testid="wallet-selection-modal">
        <button onClick={() => onSelect("freighter")}>Select Freighter</button>
        <button onClick={onClose}>Close Modal</button>
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockShowSuccess = jest.fn();

const mockUseToast = useToast as jest.Mock;

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const TestComponent = () => {
  const {
    publicKey,
    isWalletConnected,
    connectWallet,
    disconnectWallet,
    isLoading,
    activeWalletId,
  } = useWallet();
  return (
    <div>
      <div data-testid="publicKey">{publicKey}</div>
      <div data-testid="isConnected">{isWalletConnected.toString()}</div>
      <div data-testid="isLoading">{isLoading.toString()}</div>
      <div data-testid="activeWalletId">{activeWalletId ?? ""}</div>
      <button onClick={connectWallet}>Connect</button>
      <button onClick={disconnectWallet}>Disconnect</button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WalletContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    capturedOnSelect = null;

    mockUseToast.mockReturnValue({
      showError: mockShowError,
      showWarning: mockShowWarning,
      showSuccess: mockShowSuccess,
    });

    global.window.open = jest.fn();
  });

  it("starts disconnected with no public key", async () => {
    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(screen.getByTestId("publicKey")).toHaveTextContent("");
    expect(screen.getByTestId("activeWalletId")).toHaveTextContent("");
  });

  it("shows wallet selection modal when connectWallet is called", async () => {
    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("wallet-selection-modal")).toBeInTheDocument();
  });

  it("connects Freighter after user selects it in the modal", async () => {
    const { WALLET_ADAPTERS } = await import("@/lib/walletAdapters");
    const freighterAdapter = WALLET_ADAPTERS[0] as jest.Mocked<(typeof WALLET_ADAPTERS)[0]>;
    (freighterAdapter.isAvailable as jest.Mock).mockResolvedValue(true);
    (freighterAdapter.getAddress as jest.Mock).mockResolvedValue("G-FREIGHTER-CONNECTED");

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    // Open modal
    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    // Pick Freighter
    await act(async () => {
      fireEvent.click(screen.getByText("Select Freighter"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-FREIGHTER-CONNECTED");
    expect(screen.getByTestId("activeWalletId")).toHaveTextContent("freighter");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBe("G-FREIGHTER-CONNECTED");
    expect(localStorage.getItem("stellar_active_wallet")).toBe("freighter");
    expect(mockShowSuccess).toHaveBeenCalledWith("Freighter connected successfully.");
  });

  it("shows warning when chosen adapter is not installed", async () => {
    const { WALLET_ADAPTERS } = await import("@/lib/walletAdapters");
    const freighterAdapter = WALLET_ADAPTERS[0] as jest.Mocked<(typeof WALLET_ADAPTERS)[0]>;
    (freighterAdapter.isAvailable as jest.Mock).mockResolvedValue(false);

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Select Freighter"));
    });

    await waitFor(() => {
      expect(mockShowWarning).toHaveBeenCalledWith(expect.stringContaining("not found"));
    });

    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
  });

  it("shows error when getAddress throws", async () => {
    const { WALLET_ADAPTERS } = await import("@/lib/walletAdapters");
    const freighterAdapter = WALLET_ADAPTERS[0] as jest.Mocked<(typeof WALLET_ADAPTERS)[0]>;
    (freighterAdapter.isAvailable as jest.Mock).mockResolvedValue(true);
    (freighterAdapter.getAddress as jest.Mock).mockRejectedValue(new Error("Extension error"));

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Select Freighter"));
    });

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith("Failed to connect wallet. Please try again.");
    });

    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
  });

  it("dismisses modal without connecting when closed", async () => {
    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("wallet-selection-modal")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Close Modal"));
    });

    expect(screen.queryByTestId("wallet-selection-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
  });

  it("disconnects wallet and clears state", async () => {
    const { WALLET_ADAPTERS } = await import("@/lib/walletAdapters");
    const freighterAdapter = WALLET_ADAPTERS[0] as jest.Mocked<(typeof WALLET_ADAPTERS)[0]>;
    (freighterAdapter.isAvailable as jest.Mock).mockResolvedValue(true);
    (freighterAdapter.getAddress as jest.Mock).mockResolvedValue("G-TO-DISCONNECT");

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    // Connect first
    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Select Freighter"));
    });
    await waitFor(() => expect(screen.getByTestId("isConnected")).toHaveTextContent("true"));

    // Then disconnect
    await act(async () => {
      fireEvent.click(screen.getByText("Disconnect"));
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(screen.getByTestId("activeWalletId")).toHaveTextContent("");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBeNull();
    expect(localStorage.getItem("stellar_active_wallet")).toBeNull();
    expect(mockShowWarning).toHaveBeenCalledWith(expect.stringContaining("Disconnected"));
  });

  it("restores connection from localStorage on mount", async () => {
    localStorage.setItem("stellar_wallet_public_key", "G-RESTORED");
    localStorage.setItem("stellar_active_wallet", "freighter");

    const { WALLET_ADAPTERS } = await import("@/lib/walletAdapters");
    const freighterAdapter = WALLET_ADAPTERS[0] as jest.Mocked<(typeof WALLET_ADAPTERS)[0]>;
    (freighterAdapter.isAvailable as jest.Mock).mockResolvedValue(true);
    (freighterAdapter.getAddress as jest.Mock).mockResolvedValue("G-RESTORED");

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-RESTORED");
    expect(screen.getByTestId("activeWalletId")).toHaveTextContent("freighter");
  });

  it("throws error when used outside of WalletProvider", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useWallet must be used within a WalletProvider");

    consoleSpy.mockRestore();
  });
});
