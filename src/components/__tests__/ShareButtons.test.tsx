import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShareButtons from "../ShareButtons";

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

describe("ShareButtons", () => {
  it("renders both social share buttons and QR entry point from the same panel", () => {
    render(<ShareButtons url="https://example.com/campaign/1" title="Test Campaign" />);

    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Share on X" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Share on LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show QR code" })).toBeInTheDocument();
  });

  it("toggles the QR panel inline within the share panel", async () => {
    const user = userEvent.setup();
    render(<ShareButtons url="https://example.com/campaign/1" title="Test Campaign" />);

    const qrButton = screen.getByRole("button", { name: "Show QR code" });
    expect(qrButton).toHaveAttribute("aria-expanded", "false");

    await user.click(qrButton);

    expect(qrButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "QR codes" })).toBeInTheDocument();
    expect(screen.getByText("QR Codes")).toBeInTheDocument();
  });

  it("renders wallet QR code when walletAddress is provided", async () => {
    const user = userEvent.setup();
    render(
      <ShareButtons
        url="https://example.com/campaign/1"
        title="Test Campaign"
        walletAddress="GABC12345678901234567890123456789012345678901234567890"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show QR code" }));

    expect(screen.getByAltText("QR code for campaign URL")).toBeInTheDocument();
    expect(screen.getByAltText("QR code for contribution wallet address")).toBeInTheDocument();
  });

  it("has accessible QR panel with aria-controls", () => {
    render(<ShareButtons url="https://example.com/campaign/1" title="Test Campaign" />);

    const qrButton = screen.getByRole("button", { name: "Show QR code" });
    expect(qrButton).toHaveAttribute("aria-controls", "qr-panel");
  });
});
