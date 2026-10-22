import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VotingComponent from "@/components/VotingComponent";
import { Campaign, Category } from "@/types";

const mockShowError = jest.fn();

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: mockShowError,
    showWarning: jest.fn(),
  }),
}));

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: "Help Build a School",
    description: "A test campaign description",
    funding_goal: BigInt(100_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400,
    amount_raised: BigInt(10_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: Category.Educator,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    created_at: Math.floor(Date.now() / 1000),
    status: "active",
    ...overrides,
  };
}

describe("VotingComponent Accessibility & Interaction", () => {
  const mockOnVote = jest.fn();
  const campaign = makeCampaign();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders buttons with accessible labels", () => {
    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress="GUSER11111111111111111111111111111111111111111111111111"
        onVote={mockOnVote}
        isVoting={false}
      />,
    );

    const approveBtn = screen.getByRole("button", { name: "approveCampaignAria" });
    const rejectBtn = screen.getByRole("button", { name: "rejectCampaignAria" });

    expect(approveBtn).toBeInTheDocument();
    expect(rejectBtn).toBeInTheDocument();
  });

  it("supports keyboard navigation (tab focus flow)", async () => {
    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress="GUSER11111111111111111111111111111111111111111111111111"
        onVote={mockOnVote}
        isVoting={false}
      />,
    );

    const approveBtn = screen.getByRole("button", { name: "approveCampaignAria" });
    const rejectBtn = screen.getByRole("button", { name: "rejectCampaignAria" });

    // Move focus to the first button (Approve)
    await userEvent.tab();
    expect(approveBtn).toHaveFocus();

    // Move focus to the second button (Reject)
    await userEvent.tab();
    expect(rejectBtn).toHaveFocus();
  });

  it("executes upvoting handler correctly on user trigger", async () => {
    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress="GUSER11111111111111111111111111111111111111111111111111"
        onVote={mockOnVote}
        isVoting={false}
      />,
    );

    const approveBtn = screen.getByRole("button", { name: "approveCampaignAria" });
    await userEvent.click(approveBtn);
    expect(mockOnVote).toHaveBeenCalledWith(campaign.id, "upvote");
  });

  it("executes downvoting handler correctly on user trigger", async () => {
    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress="GUSER11111111111111111111111111111111111111111111111111"
        onVote={mockOnVote}
        isVoting={false}
      />,
    );

    const rejectBtn = screen.getByRole("button", { name: "rejectCampaignAria" });
    await userEvent.click(rejectBtn);
    expect(mockOnVote).toHaveBeenCalledWith(campaign.id, "downvote");
  });

  it("disables voting and shows voted message when user has already voted", () => {
    const userVote = {
      causeId: "1",
      voter: "GUSER1",
      voteType: "upvote" as const,
      timestamp: new Date(),
      transactionHash: "tx123",
    };

    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress="GUSER1"
        onVote={mockOnVote}
        isVoting={false}
        userVote={userVote}
      />,
    );

    const approveBtn = screen.getByRole("button", { name: "approveCampaignAria" });
    const rejectBtn = screen.getByRole("button", { name: "rejectCampaignAria" });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(screen.getByText("votedUpvote")).toBeInTheDocument();
  });

  it("disables voting and shows prompt when user is not a token holder", () => {
    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress="GUSER1"
        onVote={mockOnVote}
        isVoting={false}
        isTokenHolder={false}
      />,
    );

    const approveBtn = screen.getByRole("button", { name: "approveCampaignAria" });
    const rejectBtn = screen.getByRole("button", { name: "rejectCampaignAria" });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(screen.getByText("tokenHoldersOnlyPrompt")).toBeInTheDocument();
  });

  it("disables voting when voting is in progress", () => {
    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress="GUSER1"
        onVote={mockOnVote}
        isVoting={true}
      />,
    );

    const approveBtn = screen.getByRole("button", { name: "approveCampaignAria" });
    const rejectBtn = screen.getByRole("button", { name: "rejectCampaignAria" });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });

  it("disables voting and shows prompt when no wallet is connected", () => {
    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress={null}
        onVote={mockOnVote}
        isVoting={false}
      />,
    );

    const approveBtn = screen.getByRole("button", { name: "approveCampaignAria" });
    const rejectBtn = screen.getByRole("button", { name: "rejectCampaignAria" });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(screen.getByText("connectWalletPrompt")).toBeInTheDocument();
  });

  it("offers a retry action on the error toast when a vote fails (#1347)", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const onVote = jest
      .fn()
      .mockRejectedValueOnce(new Error("RPC timeout"))
      .mockResolvedValueOnce(undefined);
    render(
      <VotingComponent
        campaign={campaign}
        userWalletAddress="GUSER11111111111111111111111111111111111111111111111111"
        onVote={onVote}
        isVoting={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "rejectCampaignAria" }));

    expect(mockShowError).toHaveBeenCalledTimes(1);
    const [, options] = mockShowError.mock.calls[0] as [
      unknown,
      { action: { label: string; onClick: () => void } },
    ];
    expect(options.action.label).toBe("retryVote");

    options.action.onClick();
    await screen.findByText("votedDownvote");
    expect(onVote).toHaveBeenNthCalledWith(2, campaign.id, "downvote");
    consoleSpy.mockRestore();
  });
});
