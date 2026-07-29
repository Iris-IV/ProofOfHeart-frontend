import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CommentItem from "@/components/CommentItem";
import { useWallet } from "@/components/WalletContext";

jest.mock("@/components/WalletContext", () => ({
  useWallet: jest.fn(),
}));

jest.mock("@/lib/campaignComments", () => ({
  verifyCommentSignature: jest.fn().mockResolvedValue(true),
}));

describe("CommentItem", () => {
  const mockComment = {
    id: "c1",
    campaignId: 1,
    content: "Test comment",
    authorAddress: "GCREATOR12345678901234567890123456789012345678901234567890",
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
    render(
      <CommentItem
        comment={mockComment}
        isCreator={false}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.getByText("Test comment")).toBeInTheDocument();
    expect(screen.getByText("GCREAT...7890")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Verified")).toBeInTheDocument();
    });
  });

  it("shows pinned status", () => {
    render(
      <CommentItem
        comment={{ ...mockComment, isPinned: true }}
        isCreator={false}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.getByText("Pinned by Creator")).toBeInTheDocument();
  });

  it("shows reported status and hides content", () => {
    render(
      <CommentItem
        comment={{ ...mockComment, isReported: true }}
        isCreator={false}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
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
    const { rerender } = render(
      <CommentItem
        comment={mockComment}
        isCreator={true}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
        onPin={mockOnPin}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.getByTitle("Pin Comment")).toBeInTheDocument();

    // Re-render as non-creator
    rerender(
      <CommentItem
        comment={mockComment}
        isCreator={false}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
        onPin={mockOnPin}
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.queryByTitle("Pin Comment")).not.toBeInTheDocument();
  });

  it("calls onReport when report button is clicked", () => {
    render(
      <CommentItem
        comment={mockComment}
        isCreator={false}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    fireEvent.click(screen.getByTitle("Report Comment"));
    expect(mockOnReport).toHaveBeenCalledWith("c1");
  });

  it("opens reply form when Reply is clicked", () => {
    (useWallet as jest.Mock).mockReturnValue({
      publicKey: "GCREATOR12345678901234567890123456789012345678901234567890",
    });

    render(
      <CommentItem
        comment={mockComment}
        isCreator={true}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Answer/i }));
    expect(screen.getByPlaceholderText("Write your answer...")).toBeInTheDocument();
  });

  it("renders replies correctly", () => {
    const reply = {
      ...mockComment,
      id: "c2",
      content: "A reply",
      parentId: "c1",
    };

    render(
      <CommentItem
        comment={mockComment}
        replies={[reply]}
        isCreator={false}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(screen.getByText("Test comment")).toBeInTheDocument();
    expect(screen.getByText("A reply")).toBeInTheDocument();
    expect(screen.getAllByText("Creator answer").length).toBeGreaterThan(0);
  });

  it("renders XSS payloads as inert text without executable markup", async () => {
    const xssComment = {
      ...mockComment,
      content: '<img src=x onerror="alert(1)"><script>alert(1)</script>',
    };

    const { container } = render(
      <CommentItem
        comment={xssComment}
        isCreator={false}
        creatorAddress="GCREATOR12345678901234567890123456789012345678901234567890"
        onReply={mockOnReply}
        onReport={mockOnReport}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(await screen.findByText(/onerror="alert\(1\)"/)).toBeInTheDocument();
  });
});
