import { render, screen, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider, useWallet } from "../WalletContext";
import { useToast } from "../ToastProvider";

// Wrap children in a fresh QueryClient to satisfy WalletProvider's useQueryClient call.
const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

// ---------------------------------------------------------------------------
// Mock wallet adapters
// ---------------------------------------------------------------------------

const mockFreighterConnect = jest.fn();
const mockFreighterIsConnected = jest.fn();
const mockFreighterIsAvailable = jest.fn();
const mockFreighterGetPublicKey = jest.fn();

const mockLobstrIsAvailable = jest.fn().mockReturnValue(false);
const mockXBullIsAvailable = jest.fn().mockReturnValue(false);

jest.mock("@/lib/walletAdapters", () => ({
  ALL_ADAPTERS: [
    {
      id: "freighter",
      name: "Freighter",
      installUrl: "https://www.freighter.app/",
      isAvailable: () => mockFreighterIsAvailable(),
      isConnected: () => mockFreighterIsConnected(),
      connect: () => mockFreighterConnect(),
      getPublicKey: () => mockFreighterGetPublicKey(),
      signTransaction: jest.fn(),
    },
    {
      id: "lobstr",
      name: "LOBSTR",
      installUrl: "https://lobstr.co/signer-extension/",
      isAvailable: () => mockLobstrIsAvailable(),
      isConnected: jest.fn().mockResolvedValue(false),
      connect: jest.fn(),
      getPublicKey: jest.fn(),
      signTransaction: jest.fn(),
    },
    {
      id: "xbull",
      name: "xBull",
      installUrl: "https://xbull.app/",
      isAvailable: () => mockXBullIsAvailable(),
      isConnected: jest.fn().mockResolvedValue(false),
      connect: jest.fn(),
      getPublicKey: jest.fn(),
      signTransaction: jest.fn(),
    },
  ],
  WALLET_DESCRIPTORS: {
    freighter: {
      id: "freighter",
      name: "Freighter",
      description: "SDF wallet",
      installUrl: "https://www.freighter.app/",
      icon: "🚀",
    },
    lobstr: {
      id: "lobstr",
      name: "LOBSTR",
      description: "LOBSTR wallet",
      installUrl: "https://lobstr.co/signer-extension/",
      icon: "🦞",
    },
    xbull: {
      id: "xbull",
      name: "xBull",
      description: "xBull wallet",
      installUrl: "https://xbull.app/",
      icon: "🐂",
    },
  },
  getAdapter: (id: string) => {
    const adapters: Record<string, object> = {
      freighter: {
        id: "freighter",
        name: "Freighter",
        installUrl: "https://www.freighter.app/",
        isAvailable: () => mockFreighterIsAvailable(),
        isConnected: () => mockFreighterIsConnected(),
        connect: () => mockFreighterConnect(),
        getPublicKey: () => mockFreighterGetPublicKey(),
        signTransaction: jest.fn(),
      },
    };
    return adapters[id];
  },
}));

// Mock Freighter getNetwork (used for network passphrase check)
jest.mock("@stellar/freighter-api", () => ({
  getNetwork: jest.fn().mockResolvedValue({ networkPassphrase: "" }),
}));

// ---------------------------------------------------------------------------
// Other mocks
// ---------------------------------------------------------------------------

jest.mock("../ToastProvider", () => ({
  useToast: jest.fn(),
}));

jest.mock("../WalletSelectModal", () => ({
  __esModule: true,
  default: ({
    isOpen,
    onSelect,
    onClose,
  }: {
    isOpen: boolean;
    onSelect: (id: string) => void;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="wallet-select-modal">
        <button onClick={() => onSelect("freighter")}>Select Freighter</button>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

const mockUseToast = useToast as jest.Mock;

const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockShowSuccess = jest.fn();

// ---------------------------------------------------------------------------
// Test component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Render helper (wraps WalletProvider in the required QueryClientProvider)
// ---------------------------------------------------------------------------

const renderWithProviders = (ui: React.ReactElement) => {
  const Wrapper = createWrapper();
  return render(<Wrapper>{ui}</Wrapper>);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WalletContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseToast.mockReturnValue({
      showError: mockShowError,
      showWarning: mockShowWarning,
      showSuccess: mockShowSuccess,
    });
    // Default: Freighter is available but not connected
    mockFreighterIsAvailable.mockReturnValue(true);
    mockFreighterIsConnected.mockResolvedValue(false);
    mockFreighterGetPublicKey.mockResolvedValue("GB...");
    mockFreighterConnect.mockResolvedValue("GB...");
  });

  it("silently restores from localStorage on mount when previously connected", async () => {
    localStorage.setItem("stellar_wallet_id", "freighter");
    localStorage.setItem("stellar_wallet_public_key", "G-RESTORED");
    mockFreighterIsConnected.mockResolvedValue(true);
    mockFreighterGetPublicKey.mockResolvedValue("G-RESTORED");

    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-RESTORED");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
  });

  it("starts disconnected when no localStorage entry exists", async () => {
    await act(async () => {
      renderWithProviders(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );
    });

    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(screen.getByTestId("publicKey")).toHaveTextContent("");
  });

  it("connectWallet opens the wallet selection modal", async () => {
    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("wallet-select-modal")).toBeInTheDocument();
  });

  it("selecting a wallet in the modal connects and persists the key", async () => {
    mockFreighterConnect.mockResolvedValue("G-MO-DEV-CONNECT-SUCCESS");

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

    expect(screen.getByTestId("publicKey")).toHaveTextContent("G-MO-DEV-CONNECT-SUCCESS");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("true");
    expect(mockShowSuccess).toHaveBeenCalledWith("Wallet connected successfully.");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBe("G-MO-DEV-CONNECT-SUCCESS");
    expect(localStorage.getItem("stellar_wallet_id")).toBe("freighter");
  });

  it("shows error toast when wallet connection fails", async () => {
    mockFreighterConnect.mockRejectedValue(new Error("User rejected"));

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

    expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining("Failed to connect wallet"));
    expect(screen.getByTestId("isLoading")).toHaveTextContent("false");
  });

  it("closing the modal without selecting does not connect", async () => {
    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Close Modal"));
    });

    expect(screen.queryByTestId("wallet-select-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
  });

  it("disconnectWallet clears state and localStorage", async () => {
    localStorage.setItem("stellar_wallet_id", "freighter");
    localStorage.setItem("stellar_wallet_public_key", "G-DISCONNECT");
    mockFreighterIsConnected.mockResolvedValue(true);
    mockFreighterGetPublicKey.mockResolvedValue("G-DISCONNECT");

    renderWithProviders(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>,
    );

    await act(async () => {}); // Wait for silent restore

    await act(async () => {
      fireEvent.click(screen.getByText("Disconnect"));
    });

    expect(screen.getByTestId("publicKey")).toHaveTextContent("");
    expect(screen.getByTestId("isConnected")).toHaveTextContent("false");
    expect(localStorage.getItem("stellar_wallet_public_key")).toBeNull();
    expect(localStorage.getItem("stellar_wallet_id")).toBeNull();
    expect(mockShowWarning).toHaveBeenCalledWith(expect.stringContaining("Disconnected"));
  });

  it("throws error when used outside of Provider", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useWallet must be used within a WalletProvider");

    consoleSpy.mockRestore();
  });
});
