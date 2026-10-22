import { fireEvent, render, screen } from "@testing-library/react";
import InstallFreighterModal, { getFreighterStatus } from "@/components/InstallFreighterModal";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import Modal from "@/components/ui/Modal";

const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

afterEach(() => setUserAgent(CHROME_UA));

describe("getFreighterStatus", () => {
  it.each([
    [{ isLocked: true, browser: { name: "Safari", supported: false } }, "locked"],
    [{ isLocked: false, browser: { name: "Safari", supported: false } }, "unsupported"],
    [{ isLocked: false, browser: { name: "Chrome", supported: true } }, "notInstalled"],
    [{ isLocked: false, browser: { name: "", supported: false } }, "notInstalled"],
  ] as const)("%j → %s", (input, expected) => {
    expect(getFreighterStatus(input)).toBe(expected);
  });
});

describe("Modal drawer variant", () => {
  it("renders a glass drawer panel instead of the centred card", () => {
    render(
      <Modal onClose={jest.fn()} variant="drawer" ariaLabelledBy="t">
        <h2 id="t">Drawer</h2>
      </Modal>,
    );
    const panel = screen.getByRole("dialog", { name: "Drawer" });
    expect(panel).toHaveAttribute("data-variant", "drawer");
    expect(panel).toHaveClass(
      "backdrop-blur-xl",
      "ui-slide-up",
      "rounded-t-3xl",
      "sm:rounded-l-3xl",
    );
    expect(panel).not.toHaveClass("bg-white");
    expect(screen.getByTestId("modal-overlay")).toHaveClass("items-end", "sm:justify-end");
  });

  it("keeps the dialog look by default", () => {
    render(
      <Modal onClose={jest.fn()} ariaLabelledBy="t">
        <h2 id="t">Dialog</h2>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-variant", "dialog");
    expect(screen.getByTestId("modal-overlay")).toHaveClass("items-center", "justify-center");
  });
});

describe("InstallFreighterModal (wallet drawer)", () => {
  const props = { isOpen: true, onClose: jest.fn(), onRetry: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it("shows the Freighter option with a Not detected badge on a supported browser", () => {
    setUserAgent(CHROME_UA);
    render(<InstallFreighterModal {...props} />);

    expect(
      screen.getByRole("dialog", { name: "Freighter Wallet Required" }),
    ).toHaveAccessibleDescription(/requires the Freighter browser extension/);
    const badge = screen.getByTestId("freighter-status");
    expect(badge).toHaveTextContent("Not detected");
    expect(badge).toHaveAttribute("data-status", "notInstalled");
    expect(screen.getByRole("link", { name: "Install Freighter" })).toHaveAttribute(
      "href",
      "https://www.freighter.app/",
    );
    expect(screen.getByRole("region", { name: "Freighter" })).toHaveClass("gradient-border");
  });

  it("flags an unsupported browser", () => {
    setUserAgent(SAFARI_UA);
    render(<InstallFreighterModal {...props} />);
    expect(screen.getByTestId("freighter-status")).toHaveTextContent("Browser not supported");
    expect(screen.getByText(/Freighter does not support/)).toHaveTextContent("Safari");
  });

  it("explains a locked wallet", () => {
    render(<InstallFreighterModal {...props} isLocked />);
    expect(screen.getByTestId("freighter-status")).toHaveTextContent("Locked");
    expect(screen.getByRole("heading", { name: "Freighter Wallet Locked" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Install Freighter" })).toBeNull();
    expect(screen.getByRole("button", { name: "I unlocked it — check again" })).toBeInTheDocument();
  });

  it("closes from the close button and from Not now", () => {
    render(<InstallFreighterModal {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("re-checks for the extension", async () => {
    jest.useFakeTimers();
    render(<InstallFreighterModal {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "I installed it — check again" }));
    expect(screen.getByRole("button", { name: "Checking..." })).toBeDisabled();
    await jest.advanceTimersByTimeAsync(500);
    expect(props.onRetry).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("lists the social options with an embedded-wallet badge", () => {
    render(
      <InstallFreighterModal
        {...props}
        socialLogin={<SocialLoginButtons available onSelect={jest.fn()} />}
      />,
    );
    expect(screen.getByRole("heading", { name: "Connect a wallet" })).toBeInTheDocument();
    const google = screen.getByRole("button", { name: /continueWithGoogle/ });
    expect(google).toHaveTextContent("embeddedWalletBadge");
    expect(screen.getByRole("button", { name: /continueWithX/ })).toBeInTheDocument();
  });
});
