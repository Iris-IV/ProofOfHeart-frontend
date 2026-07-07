import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WalletSelectionModal from "@/components/WalletSelectionModal";
import type { WalletId } from "@/lib/walletAdapters";

// ---------------------------------------------------------------------------
// Mock the adapter registry — adapters must be defined inside the factory
// because jest.mock() is hoisted above variable declarations.
// ---------------------------------------------------------------------------

jest.mock("@/lib/walletAdapters", () => {
  const makeAdapter = (id: string, name: string, installUrl: string, icon: string) => ({
    id,
    name,
    installUrl,
    icon,
    isAvailable: jest.fn().mockResolvedValue(true),
    getAddress: jest.fn(),
    signTransaction: jest.fn(),
    watchChanges: jest.fn(),
    stopWatching: jest.fn(),
  });

  return {
    WALLET_ADAPTERS: [
      makeAdapter("freighter", "Freighter", "https://www.freighter.app/", "🚀"),
      makeAdapter("lobstr", "LOBSTR", "https://lobstr.co/uni/", "⭐"),
      makeAdapter("xbull", "xBull", "https://xbull.app/", "🐂"),
    ],
    UserCancelledError: class UserCancelledError extends Error {},
  };
});

// ---------------------------------------------------------------------------
// Helpers — grab the adapter mocks after jest.mock has run
// ---------------------------------------------------------------------------

function getAdapters() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WALLET_ADAPTERS } = require("@/lib/walletAdapters");
  return WALLET_ADAPTERS as Array<{
    id: string;
    name: string;
    installUrl: string;
    isAvailable: jest.Mock;
  }>;
}

const defaultProps = {
  isOpen: true,
  onSelect: jest.fn(),
  onClose: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WalletSelectionModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all adapters to available
    getAdapters().forEach((a) => a.isAvailable.mockResolvedValue(true));
    global.window.open = jest.fn();
  });

  it("renders nothing when isOpen is false", () => {
    render(<WalletSelectionModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog with all three wallet options", () => {
    render(<WalletSelectionModal {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Freighter")).toBeInTheDocument();
    expect(screen.getByText("LOBSTR")).toBeInTheDocument();
    expect(screen.getByText("xBull")).toBeInTheDocument();
  });

  it("shows 'Installed' badge after availability resolves to true", async () => {
    render(<WalletSelectionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText("Installed")).toHaveLength(3);
    });
  });

  it("shows 'Install →' badge when a wallet is not available", async () => {
    const adapters = getAdapters();
    adapters.find((a) => a.id === "lobstr")!.isAvailable.mockResolvedValue(false);

    render(<WalletSelectionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Install →")).toBeInTheDocument();
      expect(screen.getAllByText("Installed")).toHaveLength(2);
    });
  });

  it("calls onSelect with the correct wallet id when an installed wallet is clicked", async () => {
    render(<WalletSelectionModal {...defaultProps} />);

    await waitFor(() => expect(screen.getAllByText("Installed")).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: /connect with freighter/i }));

    expect(defaultProps.onSelect).toHaveBeenCalledWith("freighter" as WalletId);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("opens the install URL when clicking a not-installed wallet", async () => {
    const adapters = getAdapters();
    adapters.find((a) => a.id === "lobstr")!.isAvailable.mockResolvedValue(false);

    render(<WalletSelectionModal {...defaultProps} />);

    await waitFor(() => expect(screen.getByText("Install →")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /install lobstr/i }));

    expect(global.window.open).toHaveBeenCalledWith(
      "https://lobstr.co/uni/",
      "_blank",
      "noopener,noreferrer",
    );
    expect(defaultProps.onSelect).not.toHaveBeenCalled();
  });

  it("calls onClose when the × button is clicked", () => {
    render(<WalletSelectionModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /close wallet selection/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking the backdrop", () => {
    render(<WalletSelectionModal {...defaultProps} />);
    const backdrop = screen.getByRole("presentation");
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    render(<WalletSelectionModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("has accessible dialog role and label", () => {
    render(<WalletSelectionModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "wallet-modal-title");
    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
  });
});
