import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyContributionsSection from "@/components/MyContributionsSection";
import { useContributions, type ContributionHistoryItem } from "@/hooks/useContributions";
import { claimAllRefunds } from "@/lib/contractClient";
import { Category, type Campaign } from "@/types";

jest.mock("@/hooks/useContributions", () => ({
  useContributions: jest.fn(),
}));

jest.mock("@/lib/contractClient", () => ({
  claimRefund: jest.fn(),
  claimAllRefunds: jest.fn(),
  claimRevenue: jest.fn(),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
  }),
}));

const mockUseContributions = useContributions as jest.MockedFunction<typeof useContributions>;
const mockClaimAllRefunds = claimAllRefunds as jest.MockedFunction<typeof claimAllRefunds>;

const WALLET = "GCONTRIBUTOR";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GCREATOR",
    title: "Active campaign",
    description: "Campaign description",
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

function makeContribution(
  overrides: Partial<ContributionHistoryItem> = {},
): ContributionHistoryItem {
  const campaign = overrides.campaign ?? makeCampaign();

  return {
    campaign,
    contribution: BigInt(25_000_000),
    status: campaign.status,
    canClaimRefund: false,
    canClaimRevenue: false,
    claimableRevenue: BigInt(0),
    transactions: [
      {
        walletAddress: WALLET,
        campaignId: campaign.id,
        action: "contribute",
        txHash: `tx-${campaign.id}-abcdef1234567890`,
        timestamp: 1_700_000_000 + campaign.id,
      },
    ],
    ...overrides,
  };
}

function renderSection(contributions: ContributionHistoryItem[]) {
  mockUseContributions.mockReturnValue({
    contributions,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refetch: jest.fn(),
  });

  return render(<MyContributionsSection walletAddress={WALLET} />);
}

describe("MyContributionsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows active, refundable, and revenue-claimable statuses per contribution", () => {
    renderSection([
      makeContribution({
        campaign: makeCampaign({ id: 1, title: "Active campaign", status: "active" }),
      }),
      makeContribution({
        campaign: makeCampaign({ id: 2, title: "Refundable campaign", status: "failed" }),
        canClaimRefund: true,
      }),
      makeContribution({
        campaign: makeCampaign({
          id: 3,
          title: "Revenue campaign",
          status: "funded",
          has_revenue_sharing: true,
        }),
        canClaimRevenue: true,
        claimableRevenue: BigInt(5_000_000),
      }),
    ]);

    expect(screen.getByText("statusActive")).toBeInTheDocument();
    expect(screen.getByText("statusRefundable")).toBeInTheDocument();
    expect(screen.getByText("statusRevenueClaimable")).toBeInTheDocument();
  });

  it("shows claim buttons only for eligible contributions", () => {
    renderSection([
      makeContribution({
        campaign: makeCampaign({ id: 1, title: "Active campaign" }),
      }),
      makeContribution({
        campaign: makeCampaign({ id: 2, title: "Refundable campaign", status: "cancelled" }),
        canClaimRefund: true,
      }),
      makeContribution({
        campaign: makeCampaign({ id: 3, title: "Revenue campaign", status: "funded" }),
        canClaimRevenue: true,
        claimableRevenue: BigInt(7_500_000),
      }),
    ]);

    const activeCard = screen.getByText("Active campaign").closest("li");
    const refundableCard = screen.getByText("Refundable campaign").closest("li");
    const revenueCard = screen.getByText("Revenue campaign").closest("li");

    expect(activeCard).not.toBeNull();
    expect(refundableCard).not.toBeNull();
    expect(revenueCard).not.toBeNull();

    expect(
      within(activeCard!).queryByRole("button", { name: "claimRefund" }),
    ).not.toBeInTheDocument();
    expect(
      within(activeCard!).queryByRole("button", { name: "claimRevenue" }),
    ).not.toBeInTheDocument();
    expect(
      within(refundableCard!).getByRole("button", { name: "claimRefund" }),
    ).toBeInTheDocument();
    expect(
      within(refundableCard!).queryByRole("button", { name: "claimRevenue" }),
    ).not.toBeInTheDocument();
    expect(
      within(revenueCard!).queryByRole("button", { name: "claimRefund" }),
    ).not.toBeInTheDocument();
    expect(within(revenueCard!).getByRole("button", { name: "claimRevenue" })).toBeInTheDocument();
  });

  it("does not show claim all when only one refund is available", () => {
    renderSection([
      makeContribution({
        campaign: makeCampaign({ id: 2, title: "Refundable campaign", status: "cancelled" }),
        canClaimRefund: true,
      }),
    ]);

    expect(screen.queryByRole("button", { name: "claimAll" })).not.toBeInTheDocument();
  });

  it("shows claim all when multiple refunds are available", () => {
    renderSection([
      makeContribution({
        campaign: makeCampaign({ id: 2, title: "Refundable campaign A", status: "cancelled" }),
        canClaimRefund: true,
      }),
      makeContribution({
        campaign: makeCampaign({ id: 4, title: "Refundable campaign B", status: "failed" }),
        canClaimRefund: true,
      }),
    ]);

    expect(screen.getByRole("button", { name: "claimAll" })).toBeInTheDocument();
  });

  it("batches claim refunds through claimAllRefunds", async () => {
    mockClaimAllRefunds.mockResolvedValue(["tx-1", "tx-2"]);
    const user = userEvent.setup();

    renderSection([
      makeContribution({
        campaign: makeCampaign({ id: 2, title: "Refundable campaign A", status: "cancelled" }),
        canClaimRefund: true,
      }),
      makeContribution({
        campaign: makeCampaign({ id: 4, title: "Refundable campaign B", status: "failed" }),
        canClaimRefund: true,
      }),
    ]);

    await user.click(screen.getByRole("button", { name: "claimAll" }));

    expect(mockClaimAllRefunds).toHaveBeenCalledWith(
      [2, 4],
      WALLET,
      expect.objectContaining({
        onStatus: expect.any(Function),
        onProgress: expect.any(Function),
      }),
    );
  });

  it("renders Stellar explorer transaction links for contribution history", () => {
    renderSection([
      makeContribution({
        campaign: makeCampaign({ id: 1, title: "Linked campaign" }),
        transactions: [
          {
            walletAddress: WALLET,
            campaignId: 1,
            action: "contribute",
            txHash: "abc123def4567890abc123def4567890",
            timestamp: 1_700_000_000,
          },
          {
            walletAddress: WALLET,
            campaignId: 1,
            action: "claim_revenue",
            txHash: "revenue1234567890abcdef",
            timestamp: 1_700_000_100,
          },
        ],
      }),
    ]);

    expect(screen.getAllByRole("link", { name: /abc123def4.*f4567890/i })[0]).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/abc123def4567890abc123def4567890",
    );
    expect(screen.getByRole("link", { name: /revenue123.*90abcdef/i })).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/revenue1234567890abcdef",
    );
  });
});
