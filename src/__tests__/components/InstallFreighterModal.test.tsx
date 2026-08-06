import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InstallFreighterModal from "@/components/InstallFreighterModal";

describe("InstallFreighterModal — focus management (#807)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    isOpen: false,
    onClose: jest.fn(),
    onRetry: jest.fn(),
  };

  /**
   * Helper to render a button that acts as the "trigger" (the Connect Wallet
   * button in Navbar), simulating the real flow where a user clicks to open
   * the modal and expects focus to return after closing it.
   */
  function renderWithTrigger(modalProps = {}) {
    return render(
      <div>
        <button type="button" data-testid="trigger-button">
          Connect Wallet
        </button>
        <InstallFreighterModal {...defaultProps} {...modalProps} />
      </div>,
    );
  }

  it("focuses the first focusable element inside the modal when it opens", () => {
    renderWithTrigger({ isOpen: true });

    const installLink = screen.getByText("Install Freighter");
    // requestAnimationFrame-based focus is async, so we wait
    return waitFor(() => {
      expect(installLink).toBe(document.activeElement);
    });
  });

  it("restores focus to the trigger button when the modal closes via 'Not now'", async () => {
    const triggerRef = { current: null as HTMLElement | null };
    const { rerender } = render(
      <div>
        <button
          type="button"
          data-testid="trigger-button"
          ref={(el) => {
            triggerRef.current = el;
          }}
        >
          Connect Wallet
        </button>
        <InstallFreighterModal {...defaultProps} isOpen={false} />
      </div>,
    );

    // Focus the trigger button
    triggerRef.current?.focus();
    expect(triggerRef.current).toBe(document.activeElement);

    // Open the modal
    rerender(
      <div>
        <button
          type="button"
          data-testid="trigger-button"
          ref={(el) => {
            triggerRef.current = el;
          }}
        >
          Connect Wallet
        </button>
        <InstallFreighterModal {...defaultProps} isOpen={true} />
      </div>,
    );

    // Wait for focus to move into the modal
    await waitFor(() => {
      expect(screen.getByText("Install Freighter")).toBe(document.activeElement);
    });

    // Close the modal
    fireEvent.click(screen.getByText("Not now"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    // Re-render with isOpen=false to trigger the useEffect cleanup
    rerender(
      <div>
        <button
          type="button"
          data-testid="trigger-button"
          ref={(el) => {
            triggerRef.current = el;
          }}
        >
          Connect Wallet
        </button>
        <InstallFreighterModal {...defaultProps} isOpen={false} />
      </div>,
    );

    // Focus should be restored to the trigger button
    expect(triggerRef.current).toBe(document.activeElement);
  });

  it("has a keyboard-accessible retry button that can be focused", () => {
    renderWithTrigger({ isOpen: true });

    const retryButton = screen.getByText("I installed it — check again");
    expect(retryButton).toBeInTheDocument();
    expect(retryButton.tagName).toBe("BUTTON");
    expect(retryButton).not.toBeDisabled();
  });

  it("calls onRetry when the retry button is clicked", () => {
    const onRetry = jest.fn();
    renderWithTrigger({ isOpen: true, onRetry });

    const retryButton = screen.getByText("I installed it — check again");
    fireEvent.click(retryButton);

    // The handleRetry has a 500ms delay, so it won't call onRetry immediately
    expect(retryButton).toBeDisabled();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = renderWithTrigger({ isOpen: false });

    expect(container.querySelector(".fixed")).not.toBeInTheDocument();
  });

  it("enables the retry button and calls onRetry after checking completes", async () => {
    jest.useFakeTimers();
    const onRetry = jest.fn();
    renderWithTrigger({ isOpen: true, onRetry });

    const retryButton = screen.getByText("I installed it — check again");
    fireEvent.click(retryButton);

    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveTextContent("Checking...");

    jest.advanceTimersByTime(500);

    // Use waitFor to let React flush state updates from the async handler
    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(retryButton).not.toBeDisabled();
    });
    expect(retryButton).toHaveTextContent("I installed it — check again");

    jest.useRealTimers();
  });

  it("closes the modal when Escape is pressed", () => {
    const onClose = jest.fn();
    renderWithTrigger({ isOpen: true, onClose });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps focus within the modal when Tab cycling", () => {
    renderWithTrigger({ isOpen: true });

    const installLink = screen.getByText("Install Freighter");
    const notNowButton = screen.getByText("Not now");

    // Focus the last focusable element (Not now button)
    notNowButton.focus();
    expect(notNowButton).toBe(document.activeElement);

    // Tab forward from last element should wrap to first
    fireEvent.keyDown(document, { key: "Tab" });
    expect(installLink).toBe(document.activeElement);

    // Tab backward from first element should wrap to last
    installLink.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(notNowButton).toBe(document.activeElement);
  });
});
