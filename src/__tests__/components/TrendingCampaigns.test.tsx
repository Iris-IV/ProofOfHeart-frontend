import { render, screen } from "@testing-library/react";
import TrendingCampaigns from "@/components/TrendingCampaigns";
import { calculateTrendingScore, getTrendingCampaigns } from "@/lib/trendingHeuristic";
import { Campaign, Category } from "@/types";

const mockUseTrendingCampaigns = jest.fn();

jest.mock("@/hooks/useTrendingCampaigns", () => ({
  useTrendingCampaigns: (limit: number) => mockUseTrendingCampaigns(limit),
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

jest.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
    created_at: Math.floor(Date.now() / 1000) - 86400,
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

describe("trendingHeuristic", () => {
  it("gives higher momentum score to active verified campaigns with higher funding percentage", () => {
    const lowProgress = makeCampaign({ id: 1, amount_raised: BigInt(10_000_000) });
    const highProgressVerified = makeCampaign({
      id: 2,
      amount_raised: BigInt(80_000_000),
      is_verified: true,
    });

    expect(calculateTrendingScore(highProgressVerified)).toBeGreaterThan(
      calculateTrendingScore(lowProgress),
    );
  });

  it("assigns negative score to cancelled campaigns", () => {
    const cancelled = makeCampaign({ id: 1, status: "cancelled", is_cancelled: true });
    expect(calculateTrendingScore(cancelled)).toBe(-1);
  });

  it("filters out cancelled campaigns and sorts by score", () => {
    const c1 = makeCampaign({ id: 1, title: "Low Progress", amount_raised: BigInt(10_000_000) });
    const c2 = makeCampaign({ id: 2, title: "High Progress", amount_raised: BigInt(90_000_000) });
    const c3 = makeCampaign({ id: 3, title: "Cancelled", status: "cancelled", is_cancelled: true });

    const result = getTrendingCampaigns([c1, c2, c3], 3);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("High Progress");
    expect(result[1].title).toBe("Low Progress");
  });
});

describe("TrendingCampaigns component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading skeletons when isLoading is true", () => {
    mockUseTrendingCampaigns.mockReturnValue({
      trendingCampaigns: [],
      isLoading: true,
      error: null,
    });

    render(<TrendingCampaigns userWalletAddress={null} />);
    expect(screen.getByRole("heading", { name: "Trending Causes" })).toBeInTheDocument();
  });

  it("renders null when no trending campaigns exist", () => {
    mockUseTrendingCampaigns.mockReturnValue({
      trendingCampaigns: [],
      isLoading: false,
      error: null,
    });

    const { container } = render(<TrendingCampaigns userWalletAddress={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders trending cause cards and view all link when campaigns exist", () => {
    const c1 = makeCampaign({ id: 1, title: "Trending Cause 1" });
    const c2 = makeCampaign({ id: 2, title: "Trending Cause 2" });

    mockUseTrendingCampaigns.mockReturnValue({
      trendingCampaigns: [c1, c2],
      isLoading: false,
      error: null,
    });

    render(<TrendingCampaigns userWalletAddress={null} />);

    expect(screen.getByRole("heading", { name: "Trending Causes" })).toBeInTheDocument();
    expect(screen.getByText("Trending Cause 1")).toBeInTheDocument();
    expect(screen.getByText("Trending Cause 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all causes/i })).toBeInTheDocument();
  });
});
