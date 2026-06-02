import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VotingComponent from "@/components/VotingComponent";
import { Campaign, Category } from "@/types";

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
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
  const mockOnVerifyWithVotes = jest.fn();
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
    );

    const approveBtn = screen.getByRole("button", { name: "approveCampaignAria" });
    const rejectBtn = screen.getByRole("button", { name: "rejectCampaignAria" });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(screen.getByText("connectWalletPrompt")).toBeInTheDocument();
  });
});
