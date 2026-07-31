import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UpdateComposer from "@/components/UpdateComposer";
import { ToastProvider } from "@/components/ToastProvider";

// react-markdown ships ESM this Jest setup does not transform, so the markdown
// renderer is stubbed the same way AppPageComponents.test.tsx does.
jest.mock("@/components/SafeMarkdown", () => ({
  __esModule: true,
  default: ({ children, className }: { children: string; className?: string }) => (
    <div data-testid="safe-markdown" className={className}>
      {children}
    </div>
  ),
}));

const mockOnSubmit = jest.fn();

const renderWithToastProvider = (ui: React.ReactElement) => {
  return render(<ToastProvider>{ui}</ToastProvider>);
};

/** Click the collapsed composer button (text is split across elements). */
function clickWriteButton() {
  fireEvent.click(screen.getByRole("button", { name: /Write an update to your supporters/i }));
}

describe("UpdateComposer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the composer with write button initially", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Write an update to your supporters/i }),
    ).toBeInTheDocument();
  });

  it('shows "Post an Update" heading and info text', () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );
    expect(screen.getByText("Post an Update")).toBeInTheDocument();
    expect(screen.getByText("Visible to all contributors")).toBeInTheDocument();
  });

  it("expands to show textarea when write button is clicked", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();

    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveFocus();
  });

  it("shows character count when typing", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    fireEvent.change(textarea, { target: { value: "Hello world" } });

    expect(screen.getByText("11 / 2000")).toBeInTheDocument();
  });

  it("disables submit button when content is too short", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    fireEvent.change(textarea, { target: { value: "Too short" } });

    expect(screen.getByText("Post Update")).toBeDisabled();
  });

  it("enables submit button when content meets minimum length", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    fireEvent.change(textarea, {
      target: { value: "This is a valid update message" },
    });

    expect(screen.getByText("Post Update")).not.toBeDisabled();
  });

  it("disables submit button when content exceeds maximum length", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    const longContent = "a".repeat(2001);
    fireEvent.change(textarea, { target: { value: longContent } });

    expect(screen.getByText("Post Update")).toBeDisabled();
  });

  it("shows over-limit character count when content exceeds maximum length", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    const longContent = "a".repeat(2001);
    fireEvent.change(textarea, { target: { value: longContent } });

    expect(screen.getByText("2001 / 2000")).toBeInTheDocument();
  });

  it("calls onSubmit with trimmed content and notify flag on successful submit", async () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    fireEvent.change(textarea, {
      target: { value: "  Valid update content with spaces  " },
    });
    fireEvent.click(screen.getByText("Post Update"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith("Valid update content with spaces", true);
    });
  });

  it("shows submitting state while isSubmitting is true", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={true}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    fireEvent.change(textarea, { target: { value: "Valid content here" } });

    expect(screen.getByText("Posting...")).toBeInTheDocument();
    expect(screen.getByText("Posting...")).toBeDisabled();
  });

  it("shows cancel button when expanded", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("clears content and collapses when cancel is clicked", () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    fireEvent.change(textarea, { target: { value: "Some content" } });
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByPlaceholderText(/Share progress, milestones, or news/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Write an update to your supporters/i }),
    ).toBeInTheDocument();
  });

  it("clears content after successful submission", async () => {
    renderWithToastProvider(
      <UpdateComposer
        campaignId={1}
        creatorAddress="GABC123"
        onSubmit={async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }}
        isSubmitting={false}
      />,
    );

    clickWriteButton();
    const textarea = screen.getByPlaceholderText(/Share progress, milestones, or news/i);

    fireEvent.change(textarea, { target: { value: "Valid update content" } });
    fireEvent.click(screen.getByText("Post Update"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Write an update to your supporters/i }),
      ).toBeInTheDocument();
    });
  });
});
