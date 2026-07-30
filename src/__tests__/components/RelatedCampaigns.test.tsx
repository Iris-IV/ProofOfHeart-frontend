import { render, screen } from "@testing-library/react";
import RelatedCampaigns from "@/components/RelatedCampaigns";
import { Campaign, Category } from "@/types";

const mockUseCampaigns = jest.fn();

jest.mock("@/hooks/useCampaigns", () => ({
  useCampaigns: () => mockUseCampaigns(),
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/hooks/useSavedCampaigns", () => ({
  useSavedCampaigns: () => ({ isSaved: () => false, toggleSaved: jest.fn() }),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showError: jest.fn(), showWarning: jest.fn() }),
}));

jest.mock("@/components/VotingComponent", () => ({
  __esModule: true,
  default: () => <div data-testid="voting-component" />,
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

const CREATOR = "GCREATOR1111111111111111111111111111111111111111111111111";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: CREATOR,
    title: "Test Campaign",
    description: "Description test.",
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

describe("RelatedCampaigns component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading skeletons when isLoading is true", () => {
    mockUseCampaigns.mockReturnValue({
      campaigns: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <RelatedCampaigns
        currentCampaignId={1}
        category={Category.Learner}
        userWalletAddress={null}
        onVote={jest.fn()}
        onCancel={jest.fn()}
        onClaimRefund={jest.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Related Causes" })).toBeInTheDocument();
  });

  it("renders nothing when no related campaigns match the category", () => {
    mockUseCampaigns.mockReturnValue({
      campaigns: [
        makeCampaign({ id: 1, category: Category.Learner }),
        makeCampaign({ id: 2, category: Category.Educator }),
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { container } = render(
      <RelatedCampaigns
        currentCampaignId={1}
        category={Category.Learner}
        userWalletAddress={null}
        onVote={jest.fn()}
        onCancel={jest.fn()}
        onClaimRefund={jest.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders related campaigns in the same category excluding current campaign and cancelled campaigns", () => {
    const c1 = makeCampaign({ id: 1, title: "Current Campaign", category: Category.Learner });
    const c2 = makeCampaign({ id: 2, title: "Related Cause 1", category: Category.Learner });
    const c3 = makeCampaign({
      id: 3,
      title: "Cancelled Cause",
      category: Category.Learner,
      status: "cancelled",
      is_cancelled: true,
    });
    const c4 = makeCampaign({ id: 4, title: "Related Cause 2", category: Category.Learner });
    const c5 = makeCampaign({ id: 5, title: "Other Category Cause", category: Category.Educator });

    mockUseCampaigns.mockReturnValue({
      campaigns: [c1, c2, c3, c4, c5],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <RelatedCampaigns
        currentCampaignId={1}
        category={Category.Learner}
        userWalletAddress={null}
        onVote={jest.fn()}
        onCancel={jest.fn()}
        onClaimRefund={jest.fn()}
      />,
    );

    expect(screen.getByText("Related Cause 1")).toBeInTheDocument();
    expect(screen.getByText("Related Cause 2")).toBeInTheDocument();

    expect(screen.queryByText("Current Campaign")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled Cause")).not.toBeInTheDocument();
    expect(screen.queryByText("Other Category Cause")).not.toBeInTheDocument();
  });

  it("respects the limit prop", () => {
    const campaigns = [
      makeCampaign({ id: 1, title: "Current", category: Category.Learner }),
      makeCampaign({ id: 2, title: "Cause 1", category: Category.Learner }),
      makeCampaign({ id: 3, title: "Cause 2", category: Category.Learner }),
      makeCampaign({ id: 4, title: "Cause 3", category: Category.Learner }),
    ];

    mockUseCampaigns.mockReturnValue({
      campaigns,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <RelatedCampaigns
        currentCampaignId={1}
        category={Category.Learner}
        userWalletAddress={null}
        onVote={jest.fn()}
        onCancel={jest.fn()}
        onClaimRefund={jest.fn()}
        limit={2}
      />,
    );

    expect(screen.getByText("Cause 1")).toBeInTheDocument();
    expect(screen.getByText("Cause 2")).toBeInTheDocument();
    expect(screen.queryByText("Cause 3")).not.toBeInTheDocument();
  });
});
