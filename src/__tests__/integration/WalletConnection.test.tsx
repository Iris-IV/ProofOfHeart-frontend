import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isConnected, isAllowed, getAddress } from "@stellar/freighter-api";
import { ToastProvider } from "@/components/ToastProvider";
import WalletConnection from "@/components/WalletConnection";

jest.mock("@stellar/freighter-api");

const mockIsConnected = isConnected as jest.MockedFunction<typeof isConnected>;
const mockIsAllowed = isAllowed as jest.MockedFunction<typeof isAllowed>;
const mockGetAddress = getAddress as jest.MockedFunction<typeof getAddress>;

const TEST_ADDRESS = "GABCDE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678901234";

function renderWalletConnection() {
  const onWalletConnected = jest.fn();
  const onWalletDisconnected = jest.fn();

  render(
    <ToastProvider>
      <WalletConnection
        onWalletConnected={onWalletConnected}
        onWalletDisconnected={onWalletDisconnected}
      />
    </ToastProvider>,
  );

  return { onWalletConnected, onWalletDisconnected };
}

describe("WalletConnection — Connect Wallet flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: Freighter not connected on page load
    mockIsConnected.mockResolvedValue({ isConnected: false });
    mockIsAllowed.mockResolvedValue({ isAllowed: false });
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });
  });

  it('renders the "Connect Wallet" button initially', async () => {
    renderWalletConnection();
    expect(await screen.findByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("shows a loading state while connecting", async () => {
    let resolveConnect!: (v: { isConnected: boolean; error?: unknown }) => void;

    // First call is from the mount check (not connected → stay on connect screen)
    // Second call is from the button click (we hold it pending to observe loading state)
    mockIsConnected.mockResolvedValueOnce({ isConnected: false }).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveConnect = r;
        }),
    );
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    renderWalletConnection();
    const button = await screen.findByRole("button", { name: /connect wallet/i });

    // Use synchronous fireEvent so we can observe the loading state before the async call resolves
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /connecting/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connecting/i })).toBeDisabled();

    // Resolve so the component can finish cleanly
    await act(async () => {
      resolveConnect({ isConnected: true });
    });
  });

  it("shows a warning toast and opens install page when Freighter is not installed", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);

    renderWalletConnection();
    const button = await screen.findByRole("button", { name: /connect wallet/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith("https://www.freighter.app/", "_blank");
    });

    openSpy.mockRestore();
  });

  it("shows a warning toast when Freighter is installed but site is not allowed", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: false });

    renderWalletConnection();
    const button = await screen.findByRole("button", { name: /connect wallet/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/allow freighter/i);
    });
  });

  it("shows the formatted address and disconnect button after successful connection", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    const { onWalletConnected } = renderWalletConnection();
    const button = await screen.findByRole("button", { name: /connect wallet/i });
    await userEvent.click(button);

    // Address should be formatted as first 6 chars + '...' + last 4 chars
    const expectedFormatted = `${TEST_ADDRESS.slice(0, 6)}...${TEST_ADDRESS.slice(-4)}`;
    await waitFor(() => {
      expect(screen.getByText(expectedFormatted)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    expect(onWalletConnected).toHaveBeenCalledWith(TEST_ADDRESS);
  });

  it("auto-connects when the wallet is already connected on mount", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    const { onWalletConnected } = renderWalletConnection();

    const expectedFormatted = `${TEST_ADDRESS.slice(0, 6)}...${TEST_ADDRESS.slice(-4)}`;
    await waitFor(() => {
      expect(screen.getByText(expectedFormatted)).toBeInTheDocument();
    });

    expect(onWalletConnected).toHaveBeenCalledWith(TEST_ADDRESS);
  });

  it("returns to the disconnected state after clicking Disconnect", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    const { onWalletDisconnected } = renderWalletConnection();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /disconnect/i }));

    expect(await screen.findByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(onWalletDisconnected).toHaveBeenCalledTimes(1);
  });
});
