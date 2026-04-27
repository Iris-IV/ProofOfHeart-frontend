import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import DonationModal from "../../../src/components/DonationModal";
import { useWallet } from "../../../src/components/WalletContext";
import { useToast } from "../../../src/components/ToastProvider";
import { contribute } from "../../../src/lib/contractClient";

// Mock dependencies
jest.mock("../../../src/components/WalletContext", () => ({
  useWallet: jest.fn(),
}));

jest.mock("../../../src/components/ToastProvider", () => ({
  useToast: jest.fn(),
}));

jest.mock("../../../src/lib/contractClient", () => ({
  contribute: jest.fn(),
}));

const mockCampaign = {
  id: 1,
  title: "Test Campaign",
  funding_goal: 100000000, // 10 XLM in stroops (1 XLM = 10,000,000 stroops)
  amount_raised: 50000000, // 5 XLM in stroops
};

describe("DonationModal", () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockShowError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue({ publicKey: "G_TEST_PUBLIC_KEY" });
    (useToast as jest.Mock).mockReturnValue({ showError: mockShowError });
    (contribute as jest.Mock).mockResolvedValue("test_tx_hash");
  });

  const renderModal = () => {
    return render(
      <DonationModal
        campaign={mockCampaign as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
  };

  it("renders correctly in the input step", () => {
    renderModal();
    expect(screen.getByText("Fund This Cause")).toBeInTheDocument();
    expect(screen.getByText("Test Campaign")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (XLM)")).toBeInTheDocument();
  });

  it("validates amount <= 0 by disabling donate button", () => {
    renderModal();
    
    const input = screen.getByLabelText("Amount (XLM)");
    const donateBtn = screen.getByRole("button", { name: /Donate/i });
    
    // Initial empty state
    expect(donateBtn).toBeDisabled();

    // 0 amount
    fireEvent.change(input, { target: { value: "0" } });
    expect(donateBtn).toBeDisabled();

    // Negative amount
    fireEvent.change(input, { target: { value: "-5" } });
    expect(donateBtn).toBeDisabled();

    // Valid amount
    fireEvent.change(input, { target: { value: "10" } });
    expect(donateBtn).not.toBeDisabled();
  });

  it("progresses through steps on successful donation", async () => {
    renderModal();
    
    const input = screen.getByLabelText("Amount (XLM)");
    fireEvent.change(input, { target: { value: "10" } });
    
    const donateBtn = screen.getByRole("button", { name: "Donate 10 XLM" });
    fireEvent.click(donateBtn);
    
    // Pending step
    expect(screen.getByText("Waiting for Freighter signature and transaction confirmation…")).toBeInTheDocument();
    expect(contribute).toHaveBeenCalledWith(1, "G_TEST_PUBLIC_KEY", BigInt(100000000));
    
    // Wait for the confirmed step
    await waitFor(() => {
      expect(screen.getByText("Donation Confirmed")).toBeInTheDocument();
    });
    
    expect(screen.getByText("10 XLM donated successfully")).toBeInTheDocument();
    expect(screen.getByText("View on Stellar Explorer →")).toHaveAttribute("href", expect.stringContaining("test_tx_hash"));
    
    // Close button on confirmed step
    fireEvent.click(screen.getByText("Close"));
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it("handles error during donation", async () => {
    (contribute as jest.Mock).mockRejectedValue(new Error("Transaction failed"));
    
    renderModal();
    
    const input = screen.getByLabelText("Amount (XLM)");
    fireEvent.change(input, { target: { value: "5" } });
    
    const donateBtn = screen.getByRole("button", { name: "Donate 5 XLM" });
    fireEvent.click(donateBtn);
    
    expect(screen.getByText("Waiting for Freighter signature and transaction confirmation…")).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText("Fund This Cause")).toBeInTheDocument();
    });
    
    expect(mockShowError).toHaveBeenCalled();
    expect(screen.getByText(/Transaction failed/)).toBeInTheDocument();
  });

  it("closes on ESC key press when not pending", () => {
    renderModal();
    
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT close on ESC key press when pending", async () => {
    let resolveContribute: any;
    (contribute as jest.Mock).mockImplementation(() => new Promise((resolve) => {
      resolveContribute = resolve;
    }));
    
    renderModal();
    
    const input = screen.getByLabelText("Amount (XLM)");
    fireEvent.change(input, { target: { value: "5" } });
    
    const donateBtn = screen.getByRole("button", { name: "Donate 5 XLM" });
    fireEvent.click(donateBtn);
    
    expect(screen.getByText("Waiting for Freighter signature and transaction confirmation…")).toBeInTheDocument();
    
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).not.toHaveBeenCalled();
    
    // Clean up promise
    await act(async () => {
      resolveContribute("hash");
    });
  });

  it("traps focus and handles Tab and Shift+Tab", () => {
    renderModal();
    
    const closeBtn = screen.getByLabelText("Close");
    const input = screen.getByLabelText("Amount (XLM)");
    
    // Fill to enable donate button
    fireEvent.change(input, { target: { value: "5" } });
    const donateBtn = screen.getByRole("button", { name: "Donate 5 XLM" });
    
    // Focus first element
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);
    
    // Shift+Tab on first element loops to last
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(donateBtn);
    
    // Tab on last element loops to first
    fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("restores focus on unmount", () => {
    const triggerBtn = document.createElement("button");
    triggerBtn.textContent = "Trigger";
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();
    
    const { unmount } = renderModal();
    expect(document.body.style.overflow).toBe("hidden");
    
    unmount();
    
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(triggerBtn);
    
    document.body.removeChild(triggerBtn);
  });
  
  it("covers backdrop click and keydown", async () => {
    renderModal();
    const backdrop = screen.getByRole("presentation");
    
    // Cover click on backdrop
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Cover Escape on backdrop
    fireEvent.keyDown(backdrop, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
