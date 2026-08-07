import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstallFreighterModal from "@/components/InstallFreighterModal";

const originalUserAgent = navigator.userAgent;

beforeEach(() => {
  Object.defineProperty(navigator, "userAgent", {
    value: originalUserAgent,
    configurable: true,
  });
});

afterAll(() => {
  Object.defineProperty(navigator, "userAgent", {
    value: originalUserAgent,
    configurable: true,
  });
});

describe("InstallFreighterModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onRetry: jest.fn(),
  };

  it("renders the desktop install flow by default", () => {
    render(<InstallFreighterModal {...defaultProps} />);
    expect(screen.getByText("Freighter Wallet Required")).toBeInTheDocument();
    expect(screen.getByText("Install Freighter")).toBeInTheDocument();
    expect(screen.getByText("I installed it — check again")).toBeInTheDocument();
  });

  it("shows mobile guidance when on a mobile browser", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });

    render(<InstallFreighterModal {...defaultProps} />);
    expect(screen.getByText("Use a desktop browser")).toBeInTheDocument();
    expect(screen.queryByText("Install Freighter")).not.toBeInTheDocument();
    expect(screen.queryByText("I installed it — check again")).not.toBeInTheDocument();
  });

  it("hides the retry button on mobile", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36",
      configurable: true,
    });

    render(<InstallFreighterModal {...defaultProps} />);
    expect(screen.queryByText("I installed it — check again")).not.toBeInTheDocument();
  });

  it("calls onClose when Not now is clicked", async () => {
    const onClose = jest.fn();
    render(<InstallFreighterModal {...defaultProps} onClose={onClose} />);

    await userEvent.click(screen.getByText("Not now"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    const { container } = render(<InstallFreighterModal {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
