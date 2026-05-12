import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CauseCard from "@/components/CauseCard";
import { Campaign, Category, Vote } from "@/types";

// ── Child-component mocks ────────────────────────────────────────────────────

jest.mock("@/components/VotingComponent", () => ({
  __esModule: true,
  default: ({
    onVote,
    campaign,
  }: {
    campaign: Campaign;
    onVote: (id: number, t: "upvote" | "downvote") => Promise<void>;
    [k: string]: unknown;
  }) => (
    <button data-testid="voting-component" onClick={() => onVote(campaign.id, "upvote")}>
      Vote
    </button>
  ),
}));

jest.mock("@/components/CampaignStatusBadge", () => ({
  __esModule: true,
  default: ({ campaign }: { campaign: Pick<Campaign, "status"> }) => (
    <span data-testid="status-badge">{campaign.status}</span>
  ),
}));

jest.mock("@/components/FundingProgressBar", () => ({
  __esModule: true,
  default: () => <div data-testid="funding-progress-bar" />,
}));

jest.mock("@/components/DeadlineCountdown", () => ({
  __esModule: true,
  default: () => <span data-testid="deadline-countdown" />,
}));

jest.mock("@/components/cancelCampaignModal", () => ({
  __esModule: true,
  default: ({
    isOpen,
    onConfirm,
    onClose,
    campaignTitle,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onClose: () => void;
    campaignTitle: string;
    isCancelling: boolean;
  }) =>
    isOpen ? (
      <div data-testid="cancel-modal">
        <p>{campaignTitle}</p>
        <button onClick={onConfirm}>Confirm cancel</button>
        <button onClick={onClose}>Close modal</button>
      </div>
    ) : null,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const CREATOR = "GCREATOR1111111111111111111111111111111111111111111111111";
const CONTRIBUTOR = "GCONTRIB1111111111111111111111111111111111111111111111111";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: CREATOR,
    title: "Test Campaign",
    description: "A test campaign description.",
    created_at: 1_700_000_000,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86_400,
    amount_raised: BigInt(50_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    ...overrides,
  };
}

function renderCard(
  campaign: Campaign,
  userWalletAddress: string | null = null,
  {
    onVote = jest.fn(() => Promise.resolve()),
    onCancel = jest.fn(() => Promise.resolve()),
    onClaimRefund = jest.fn(() => Promise.resolve()),
    userVote,
  }: {
    onVote?: jest.Mock;
    onCancel?: jest.Mock;
    onClaimRefund?: jest.Mock;
    userVote?: Vote;
  } = {},
) {
  return render(
    <CauseCard
      campaign={campaign}
      userWalletAddress={userWalletAddress}
      onVote={onVote}
      onCancel={onCancel}
      onClaimRefund={onClaimRefund}
      userVote={userVote}
    />,
  );
}

// ── Progress math ─────────────────────────────────────────────────────────────

describe("progress percentage", () => {
  it("shows 50% when half the goal is raised", () => {
    renderCard(
      makeCampaign({ amount_raised: BigInt(50_000_000), funding_goal: BigInt(100_000_000) }),
    );
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("shows 0% when nothing has been raised", () => {
    renderCard(makeCampaign({ amount_raised: BigInt(0), funding_goal: BigInt(100_000_000) }));
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("caps at 100% when over-funded", () => {
    renderCard(
      makeCampaign({ amount_raised: BigInt(200_000_000), funding_goal: BigInt(100_000_000) }),
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows 0% when funding goal is zero (no division by zero)", () => {
    renderCard(makeCampaign({ amount_raised: BigInt(0), funding_goal: BigInt(0) }));
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("hides FundingProgressBar when goal is zero", () => {
    renderCard(makeCampaign({ funding_goal: BigInt(0) }));
    expect(screen.queryByTestId("funding-progress-bar")).not.toBeInTheDocument();
  });

  it("shows FundingProgressBar when goal is positive", () => {
    renderCard(makeCampaign({ funding_goal: BigInt(100_000_000) }));
    expect(screen.getByTestId("funding-progress-bar")).toBeInTheDocument();
  });
});

// ── Creator identity badge ────────────────────────────────────────────────────

describe('"You" badge', () => {
  it('shows the "You" badge when the connected wallet matches the creator', () => {
    renderCard(makeCampaign(), CREATOR);
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it('does not show the "You" badge for a non-creator wallet', () => {
    renderCard(makeCampaign(), CONTRIBUTOR);
    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  it('does not show the "You" badge when no wallet is connected', () => {
    renderCard(makeCampaign(), null);
    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });
});

// ── Cancel button visibility ──────────────────────────────────────────────────

describe("Cancel Campaign button", () => {
  it("is visible for the creator on an active campaign", () => {
    renderCard(makeCampaign({ status: "active" }), CREATOR);
    expect(screen.getByRole("button", { name: /cancel campaign/i })).toBeInTheDocument();
  });

  it("is hidden for a non-creator", () => {
    renderCard(makeCampaign({ status: "active" }), CONTRIBUTOR);
    expect(screen.queryByRole("button", { name: /cancel campaign/i })).not.toBeInTheDocument();
  });

  it("is hidden when no wallet is connected", () => {
    renderCard(makeCampaign({ status: "active" }), null);
    expect(screen.queryByRole("button", { name: /cancel campaign/i })).not.toBeInTheDocument();
  });

  it("is hidden for the creator when the campaign is already cancelled", () => {
    renderCard(makeCampaign({ status: "cancelled" }), CREATOR);
    expect(screen.queryByRole("button", { name: /cancel campaign/i })).not.toBeInTheDocument();
  });

  it("is hidden for the creator when funds have already been withdrawn", () => {
    renderCard(makeCampaign({ status: "funded", funds_withdrawn: true }), CREATOR);
    expect(screen.queryByRole("button", { name: /cancel campaign/i })).not.toBeInTheDocument();
  });

  it("opens the confirmation modal on click", () => {
    renderCard(makeCampaign({ status: "active" }), CREATOR);
    fireEvent.click(screen.getByRole("button", { name: /cancel campaign/i }));
    expect(screen.getByTestId("cancel-modal")).toBeInTheDocument();
  });

  it("calls onCancel with the campaign id when the modal is confirmed", async () => {
    const onCancel = jest.fn(() => Promise.resolve());
    renderCard(makeCampaign({ id: 42, status: "active" }), CREATOR, { onCancel });
    fireEvent.click(screen.getByRole("button", { name: /cancel campaign/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm cancel/i }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(42));
  });

  it("closes the modal without calling onCancel when dismissed", () => {
    const onCancel = jest.fn(() => Promise.resolve());
    renderCard(makeCampaign({ status: "active" }), CREATOR, { onCancel });
    fireEvent.click(screen.getByRole("button", { name: /cancel campaign/i }));
    fireEvent.click(screen.getByRole("button", { name: /close modal/i }));
    expect(screen.queryByTestId("cancel-modal")).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

// ── Claim Refund button visibility ────────────────────────────────────────────

describe("Claim Refund button", () => {
  it("is visible for a contributor on a cancelled campaign", () => {
    renderCard(makeCampaign({ status: "cancelled" }), CONTRIBUTOR);
    expect(screen.getByRole("button", { name: /claim refund/i })).toBeInTheDocument();
  });

  it("is hidden for the creator on a cancelled campaign", () => {
    renderCard(makeCampaign({ status: "cancelled" }), CREATOR);
    expect(screen.queryByRole("button", { name: /claim refund/i })).not.toBeInTheDocument();
  });

  it("is hidden when no wallet is connected", () => {
    renderCard(makeCampaign({ status: "cancelled" }), null);
    expect(screen.queryByRole("button", { name: /claim refund/i })).not.toBeInTheDocument();
  });

  it("is hidden for a contributor on an active campaign", () => {
    renderCard(makeCampaign({ status: "active" }), CONTRIBUTOR);
    expect(screen.queryByRole("button", { name: /claim refund/i })).not.toBeInTheDocument();
  });

  it("calls onClaimRefund with the campaign id when clicked", async () => {
    const onClaimRefund = jest.fn(() => Promise.resolve());
    renderCard(makeCampaign({ id: 7, status: "cancelled" }), CONTRIBUTOR, { onClaimRefund });
    fireEvent.click(screen.getByRole("button", { name: /claim refund/i }));
    await waitFor(() => expect(onClaimRefund).toHaveBeenCalledWith(7));
  });
});

// ── Voting / cancelled-banner visibility ──────────────────────────────────────

describe("voting and cancelled banner", () => {
  it("shows VotingComponent on an active campaign", () => {
    renderCard(makeCampaign({ status: "active" }));
    expect(screen.getByTestId("voting-component")).toBeInTheDocument();
  });

  it("shows VotingComponent on a funded campaign", () => {
    renderCard(makeCampaign({ status: "funded" }));
    expect(screen.getByTestId("voting-component")).toBeInTheDocument();
  });

  it("hides VotingComponent and shows cancelled banner on a cancelled campaign", () => {
    renderCard(makeCampaign({ status: "cancelled" }));
    expect(screen.queryByTestId("voting-component")).not.toBeInTheDocument();
    expect(screen.getByText(/this campaign has been cancelled/i)).toBeInTheDocument();
  });

  it("does not show the cancelled banner on an active campaign", () => {
    renderCard(makeCampaign({ status: "active" }));
    expect(screen.queryByText(/this campaign has been cancelled/i)).not.toBeInTheDocument();
  });
});

// ── Vote propagation ──────────────────────────────────────────────────────────

describe("vote propagation", () => {
  it("calls onVote with the correct campaign id when VotingComponent fires", async () => {
    const onVote = jest.fn(() => Promise.resolve());
    renderCard(makeCampaign({ id: 5, status: "active" }), CONTRIBUTOR, { onVote });
    fireEvent.click(screen.getByTestId("voting-component"));
    await waitFor(() => expect(onVote).toHaveBeenCalledWith(5, "upvote"));
  });
});

// ── Category label and icon fallback ─────────────────────────────────────────

describe("category label", () => {
  it('shows "Learner" for Category.Learner', () => {
    renderCard(makeCampaign({ category: Category.Learner }));
    expect(screen.getByText(/Learner/)).toBeInTheDocument();
  });

  it('shows "Educator" for Category.Educator', () => {
    renderCard(makeCampaign({ category: Category.Educator }));
    expect(screen.getByText(/Educator/)).toBeInTheDocument();
  });

  it('shows "Educational Startup" for Category.EducationalStartup', () => {
    renderCard(makeCampaign({ category: Category.EducationalStartup }));
    expect(screen.getByText(/Educational Startup/)).toBeInTheDocument();
  });

  it('shows "Publisher" for Category.Publisher', () => {
    renderCard(makeCampaign({ category: Category.Publisher }));
    expect(screen.getByText(/Publisher/)).toBeInTheDocument();
  });

  it("falls back to the raw category value when no label is defined", () => {
    // Cast an unknown numeric value to bypass TypeScript — simulates a future on-chain category
    const unknown = 99 as unknown as Category;
    renderCard(makeCampaign({ category: unknown }));
    expect(screen.getByText(/99/)).toBeInTheDocument();
  });
});

// ── Static content ────────────────────────────────────────────────────────────

describe("static card content", () => {
  it("renders the campaign title", () => {
    renderCard(makeCampaign({ title: "My Great Cause" }));
    expect(screen.getByText("My Great Cause")).toBeInTheDocument();
  });

  it("renders the campaign description", () => {
    renderCard(makeCampaign({ description: "Helping the world." }));
    expect(screen.getByText("Helping the world.")).toBeInTheDocument();
  });

  it("renders a truncated creator address", () => {
    renderCard(makeCampaign({ creator: "GABCDE123456789WXYZ" }));
    // formatAddress keeps first 6 and last 4 chars
    expect(screen.getByText(/GABCDE.*WXYZ/)).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    renderCard(makeCampaign({ status: "funded" }));
    expect(screen.getByTestId("status-badge")).toHaveTextContent("funded");
  });
});
