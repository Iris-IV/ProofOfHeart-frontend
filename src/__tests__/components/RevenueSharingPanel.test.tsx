import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RevenueSharingPanel from "@/components/RevenueSharingPanel";
import { useWallet } from "@/components/WalletContext";
import { claimRevenue, depositRevenue } from "@/lib/contractClient";
import { useRevenueSharing } from "@/hooks/useRevenueSharing";
import { Category, type Campaign } from "@/types";

jest.mock("@/components/WalletContext", () => ({
  useWallet: jest.fn(),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
    showWarning: jest.fn(),
  }),
}));

jest.mock("@/hooks/useRevenueSharing", () => ({
  useRevenueSharing: jest.fn(),
}));

jest.mock("@/lib/contractClient", () => ({
  claimRevenue: jest.fn(),
  depositRevenue: jest.fn(),
}));

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseRevenueSharing = useRevenueSharing as jest.MockedFunction<typeof useRevenueSharing>;
const mockDepositRevenue = depositRevenue as jest.MockedFunction<typeof depositRevenue>;
const mockClaimRevenue = claimRevenue as jest.MockedFunction<typeof claimRevenue>;

const CREATOR = "GCREATOR1111111111111111111111111111111111111111111111111";
const CONTRIBUTOR = "GCONTRIBUTOR11111111111111111111111111111111111111111111";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 7,
    creator: CREATOR,
    title: "Revenue Campaign",
    description: "A startup campaign with revenue sharing.",
    created_at: 1_700_000_000,
    status: "funded",
    funding_goal: BigInt(200_000_000),
    deadline: Math.floor(Date.now() / 1000) - 3600,
    amount_raised: BigInt(200_000_000),
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

function mockWallet(publicKey: string | null) {
  mockUseWallet.mockReturnValue({
    publicKey,
    connectWallet: jest.fn(),
    disconnectWallet: jest.fn(),
    isWalletConnected: !!publicKey,
    isLoading: false,
    walletNetworkWarning: null,
  });
}

function mockRevenueSharing(overrides = {}) {
  mockUseRevenueSharing.mockReturnValue({
    revenuePool: BigInt(100_000_000),
    contribution: BigInt(20_000_000),
    claimed: BigInt(2_500_000),
    contributorShare: BigInt(10_000_000),
    claimable: BigInt(7_500_000),
    isLoading: false,
    refetch: jest.fn(),
    ...overrides,
  });
}

describe("RevenueSharingPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDepositRevenue.mockResolvedValue("deposit-tx");
    mockClaimRevenue.mockResolvedValue("claim-tx");
    mockWallet(CONTRIBUTOR);
    mockRevenueSharing();
  });

  it("renders pro-rata revenue sharing math from fixtures", () => {
    render(<RevenueSharingPanel campaign={makeCampaign()} />);

    expect(screen.getByText("Total Pool")).toBeInTheDocument();
    expect(screen.getByText("10 XLM")).toBeInTheDocument();
    expect(screen.getByText("Your Share")).toBeInTheDocument();
    expect(screen.getByText("1 XLM")).toBeInTheDocument();
    expect(screen.getByText("Already Claimed")).toBeInTheDocument();
    expect(screen.getByText("0.25 XLM")).toBeInTheDocument();
    expect(screen.getByText("Claimable Now")).toBeInTheDocument();
    expect(screen.getByText("0.75 XLM")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.textContent === "2 XLM contribution × 10 XLM pool ÷ 20 XLM raised = 1 XLM",
      ),
    ).toBeInTheDocument();
  });

  it("calls depositRevenue with the campaign id and stroop amount for creators", async () => {
    mockWallet(CREATOR);
    render(<RevenueSharingPanel campaign={makeCampaign()} />);

    fireEvent.change(screen.getByPlaceholderText("Amount in XLM"), {
      target: { value: "1.25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deposit Revenue" }));

    await waitFor(() => {
      expect(mockDepositRevenue).toHaveBeenCalledWith(
        7,
        BigInt(12_500_000),
        expect.objectContaining({ onStatus: expect.any(Function) }),
      );
    });
  });

  it("calls claimRevenue with the campaign id and contributor wallet", async () => {
    render(<RevenueSharingPanel campaign={makeCampaign()} />);

    fireEvent.click(screen.getByRole("button", { name: "Claim Revenue" }));

    await waitFor(() => {
      expect(mockClaimRevenue).toHaveBeenCalledWith(
        7,
        CONTRIBUTOR,
        expect.objectContaining({ onStatus: expect.any(Function) }),
      );
    });
  });

  it("only renders for EducationalStartup campaigns with revenue sharing enabled", () => {
    const { container, rerender } = render(
      <RevenueSharingPanel
        campaign={makeCampaign({
          category: Category.Learner,
          has_revenue_sharing: true,
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(mockUseRevenueSharing).toHaveBeenLastCalledWith(
      7,
      CONTRIBUTOR,
      BigInt(200_000_000),
      false,
    );

    rerender(
      <RevenueSharingPanel
        campaign={makeCampaign({
          category: Category.EducationalStartup,
          has_revenue_sharing: false,
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(mockUseRevenueSharing).toHaveBeenLastCalledWith(
      7,
      CONTRIBUTOR,
      BigInt(200_000_000),
      false,
    );

    rerender(<RevenueSharingPanel campaign={makeCampaign()} />);

    expect(screen.getByRole("heading", { name: "Revenue Sharing" })).toBeInTheDocument();
    expect(mockUseRevenueSharing).toHaveBeenLastCalledWith(
      7,
      CONTRIBUTOR,
      BigInt(200_000_000),
      true,
    );
  });
});
