import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClaimableRevenueSection from "@/components/ClaimableRevenueSection";
import { useContributions, type ContributionHistoryItem } from "@/hooks/useContributions";
import { claimRevenue } from "@/lib/contractClient";
import { Category, type Campaign } from "@/types";

jest.mock("@/hooks/useContributions", () => ({
  useContributions: jest.fn(),
}));

jest.mock("@/lib/contractClient", () => ({
  claimRevenue: jest.fn(),
}));

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    showWarning: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
}));

const mockUseContributions = useContributions as jest.MockedFunction<typeof useContributions>;
const mockClaimRevenue = claimRevenue as jest.MockedFunction<typeof claimRevenue>;
const mockRefetch = jest.fn();

const WALLET = "GCONTRIBUTOR11111111111111111111111111111111111111111111";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GCREATOR",
    title: "Startup campaign",
    description: "Campaign description",
    created_at: 1_700_000_000,
    status: "funded",
    funding_goal: BigInt(100_000_000),
    deadline: Math.floor(Date.now() / 1000) - 3600,
    amount_raised: BigInt(100_000_000),
    is_active: false,
    funds_withdrawn: true,
    is_cancelled: false,
    is_verified: true,
    category: Category.EducationalStartup,
    has_revenue_sharing: true,
    revenue_share_percentage: 1000,
    ...overrides,
  };
}

function makeContribution(
  overrides: Partial<ContributionHistoryItem> = {},
): ContributionHistoryItem {
  const campaign = overrides.campaign ?? makeCampaign();
  return {
    campaign,
    contribution: BigInt(50_000_000),
    status: campaign.status,
    canClaimRefund: false,
    canClaimRevenue: true,
    claimableRevenue: BigInt(25_000_000),
    transactions: [],
    ...overrides,
  };
}

function renderSection(
  contributions: ContributionHistoryItem[],
  state: Partial<ReturnType<typeof useContributions>> = {},
) {
  mockUseContributions.mockReturnValue({
    contributions,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refetch: mockRefetch,
    ...state,
  });
  return render(<ClaimableRevenueSection walletAddress={WALLET} />);
}

describe("ClaimableRevenueSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders a row per EducationalStartup campaign with claimable revenue", () => {
    renderSection([
      makeContribution({
        campaign: makeCampaign({ id: 1, title: "Alpha Startup" }),
        claimableRevenue: BigInt(25_000_000),
      }),
      makeContribution({
        campaign: makeCampaign({ id: 2, title: "Beta Startup" }),
        claimableRevenue: BigInt(10_000_000),
      }),
    ]);

    expect(screen.getByText("Alpha Startup")).toBeInTheDocument();
    expect(screen.getByText("Beta Startup")).toBeInTheDocument();
    // 25_000_000 stroops = 2.5 XLM, 10_000_000 = 1 XLM, total 3.5 XLM
    expect(screen.getByText(/2\.5 XLM claimable/)).toBeInTheDocument();
    expect(screen.getByText(/1 XLM claimable/)).toBeInTheDocument();
    expect(screen.getByText(/3\.5 XLM claimable/)).toBeInTheDocument(); // header total
    expect(screen.getAllByRole("button", { name: /Claim revenue for/ })).toHaveLength(2);
  });

  it("excludes non-EducationalStartup campaigns and zero-claimable rows", () => {
    renderSection([
      makeContribution({
        campaign: makeCampaign({ id: 1, title: "Startup With Revenue" }),
      }),
      makeContribution({
        campaign: makeCampaign({ id: 2, title: "Learner Campaign", category: Category.Learner }),
        canClaimRevenue: true,
        claimableRevenue: BigInt(9_000_000),
      }),
      makeContribution({
        campaign: makeCampaign({ id: 3, title: "Zero Claimable" }),
        canClaimRevenue: false,
        claimableRevenue: BigInt(0),
      }),
    ]);

    expect(screen.getByText("Startup With Revenue")).toBeInTheDocument();
    expect(screen.queryByText("Learner Campaign")).not.toBeInTheDocument();
    expect(screen.queryByText("Zero Claimable")).not.toBeInTheDocument();
  });

  it("claims revenue and refetches on success", async () => {
    mockClaimRevenue.mockResolvedValue("tx-hash-123");
    renderSection([
      makeContribution({ campaign: makeCampaign({ id: 5, title: "Gamma Startup" }) }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Claim revenue for Gamma Startup" }));

    await waitFor(() => {
      expect(mockClaimRevenue).toHaveBeenCalledWith(5, WALLET, expect.any(Object));
    });
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith("Revenue claimed successfully.");
      expect(mockRefetch).toHaveBeenCalled();
    });
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it("surfaces the error on a failed claim", async () => {
    mockClaimRevenue.mockRejectedValue(new Error("Insufficient revenue pool"));
    renderSection([
      makeContribution({ campaign: makeCampaign({ id: 6, title: "Delta Startup" }) }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Claim revenue for Delta Startup" }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith("Insufficient revenue pool");
    });
    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("shows an empty state when there is no claimable revenue", () => {
    renderSection([]);
    expect(screen.getByText(/no claimable revenue right now/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Claim revenue for/ })).not.toBeInTheDocument();
  });

  it("shows a loading state", () => {
    renderSection([], { isLoading: true });
    expect(screen.getByText("Loading claimable revenue...")).toBeInTheDocument();
  });

  it("shows an error state from the hook", () => {
    renderSection([], { error: "Failed to load" });
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("disables sibling claim buttons while one claim is in flight", async () => {
    let resolveClaim: (v: string) => void = () => {};
    mockClaimRevenue.mockImplementation(
      () => new Promise<string>((resolve) => (resolveClaim = resolve)),
    );
    renderSection([
      makeContribution({ campaign: makeCampaign({ id: 1, title: "First Startup" }) }),
      makeContribution({ campaign: makeCampaign({ id: 2, title: "Second Startup" }) }),
    ]);

    const firstBtn = screen.getByRole("button", { name: "Claim revenue for First Startup" });
    const secondBtn = screen.getByRole("button", { name: "Claim revenue for Second Startup" });

    fireEvent.click(firstBtn);

    await waitFor(() => expect(secondBtn).toBeDisabled());
    expect(firstBtn).toBeDisabled();

    resolveClaim("tx");
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });
});
