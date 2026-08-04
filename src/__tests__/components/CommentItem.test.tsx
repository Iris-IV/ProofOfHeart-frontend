import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CommentItem from "@/components/CommentItem";
import { useWallet } from "@/components/WalletContext";
import { ToastProvider } from "@/components/ToastProvider";

import { ToastProvider } from "@/components/ToastProvider";

jest.mock("@/components/WalletContext", () => ({
  useWallet: jest.fn(),
}));

const renderCommentItem = (ui: React.ReactElement) => {
  return render(<ToastProvider>{ui}</ToastProvider>);
};

jest.mock("@/lib/campaignComments", () => ({
  verifyCommentSignature: jest.fn().mockResolvedValue(true),
}));

describe("CommentItem", () => {
  const mockComment = {
    id: "c1",
    campaignId: 1,
    content: "Test comment",
    authorAddress: "GABC12345678901234567890123456789012345678901234567890",
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    parentId: null,
    signature: "mock-sig",
    isPinned: false,
    isReported: false,
  };

  const mockOnReply = jest.fn();
  const mockOnPin = jest.fn();
  const mockOnReport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue({ publicKey: "GUSER123" });
  });

  it("renders author and content correctly", async () => {
    renderCommentItem(
      <CommentItem
        comment={mockComment}
        isCreator={false}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.getByText("Test comment")).toBeInTheDocument();
    expect(screen.getByText("GABC12...7890")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Verified")).toBeInTheDocument();
    });
  });

  it("shows pinned status", () => {
    renderCommentItem(
      <CommentItem
        comment={{ ...mockComment, isPinned: true }}
        isCreator={false}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.getByText("Pinned by Creator")).toBeInTheDocument();
  });

  it("shows reported status and hides content", () => {
    renderCommentItem(
      <CommentItem
        comment={{ ...mockComment, isReported: true }}
        isCreator={false}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(
      screen.getByText("This comment has been reported and is under review."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Test comment")).not.toBeInTheDocument();
  });

  it("shows pin button only for creator on top-level comments", () => {
    const { rerender } = renderCommentItem(
      <CommentItem
        comment={mockComment}
        isCreator={true}
        onPin={mockOnPin}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.getByTitle("Pin Comment")).toBeInTheDocument();

    // Re-render as non-creator
    rerender(
      <ToastProvider>
        <CommentItem
          comment={mockComment}
          isCreator={false}
          onPin={mockOnPin}
          onReply={mockOnReply}
          onReport={mockOnReport}
        />
      </ToastProvider>,
    );

    expect(screen.queryByTitle("Pin Comment")).not.toBeInTheDocument();
  });

  it("calls onReport when report button is clicked", () => {
    renderCommentItem(
      <CommentItem
        comment={mockComment}
        isCreator={false}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    fireEvent.click(screen.getByTitle("Report Comment"));
    expect(mockOnReport).toHaveBeenCalledWith("c1");
  });

  it("opens reply form when Reply is clicked", () => {
    render(
      <ToastProvider>
        <CommentItem
          comment={mockComment}
          isCreator={false}
          onReply={mockOnReply}
          onReport={mockOnReport}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Reply/i }));
    expect(screen.getByPlaceholderText("Write a reply...")).toBeInTheDocument();
  });

  it("renders replies correctly", () => {
    const reply = {
      ...mockComment,
      id: "c2",
      content: "A reply",
      parentId: "c1",
    };

    renderCommentItem(
      <CommentItem
        comment={mockComment}
        replies={[reply]}
        isCreator={false}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.getByText("Test comment")).toBeInTheDocument();
    expect(screen.getByText("A reply")).toBeInTheDocument();
  });

  it("renders XSS payloads as inert text without executable markup", async () => {
    const xssComment = {
      ...mockComment,
      content: '<img src=x onerror="alert(1)"><script>alert(1)</script>',
    };

    const { container } = renderCommentItem(
      <CommentItem
        comment={xssComment}
        isCreator={false}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(await screen.findByText(/onerror="alert\(1\)"/)).toBeInTheDocument();
  });
});
