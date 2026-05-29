import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import AdminClient from "@/app/[locale]/admin/AdminClient";
import CauseDetailClient from "@/app/[locale]/causes/[id]/CauseDetailClient";
import HomeClient from "@/app/[locale]/HomeClient";
import { Category, type Campaign } from "@/types";

const ADMIN = "GADMIN11111111111111111111111111111111111111111111111111";
const CREATOR = "GCREATOR1111111111111111111111111111111111111111111111111";

const mockConnectWallet = jest.fn();
const mockUseWallet = jest.fn();
const mockUseCampaign = jest.fn();
const mockUseCampaigns = jest.fn();

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@stellar/stellar-sdk", () => ({
  StrKey: {
    isValidEd25519PublicKey: jest.fn(() => true),
  },
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <p>{children}</p>,
}));

jest.mock("remark-gfm", () => ({}));

jest.mock("rehype-sanitize", () => ({}));

jest.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

jest.mock("@/hooks/useCampaign", () => ({
  useCampaign: (id: number) => mockUseCampaign(id),
}));

jest.mock("@/hooks/useCampaigns", () => ({
  useCampaigns: () => mockUseCampaigns(),
}));

jest.mock("@/hooks/usePlatformFee", () => ({
  usePlatformFee: () => ({ platformFeeBps: 300, isLoading: false, isFallback: false }),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
    showWarning: jest.fn(),
  }),
}));

jest.mock("@/components/CampaignActions", () => ({
  __esModule: true,
  default: () => <div data-testid="campaign-actions" />,
}));

jest.mock("@/components/VotingComponent", () => ({
  __esModule: true,
  default: () => <div data-testid="voting-component" />,
}));

jest.mock("@/components/UpdatesSection", () => ({
  __esModule: true,
  default: () => <div data-testid="updates-section" />,
}));

jest.mock("@/components/ShareButtons", () => ({
  __esModule: true,
  default: () => <div data-testid="share-buttons" />,
}));

jest.mock("@/components/ReportModal", () => ({
  __esModule: true,
  default: () => <div data-testid="report-modal" />,
}));

jest.mock("@/components/DonationModal", () => ({
  __esModule: true,
  default: () => <div data-testid="donation-modal" />,
}));

jest.mock("@/components/DeadlineCountdown", () => ({
  __esModule: true,
  default: () => <span>deadline countdown</span>,
}));

jest.mock("@/components/FundingProgressBar", () => ({
  __esModule: true,
  default: () => <div data-testid="funding-progress" />,
}));

jest.mock("@/components/RevenueSharingPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="revenue-sharing" />,
}));

jest.mock("@/components/cancelCampaignModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/lib/contractClient", () => ({
  getAdmin: jest.fn(() => Promise.resolve(ADMIN)),
  getPlatformFee: jest.fn(() => Promise.resolve(300)),
  updateAdmin: jest.fn(),
  updatePlatformFee: jest.fn(),
  verifyCampaign: jest.fn(),
  cancelCampaign: jest.fn(),
  voteOnCampaign: jest.fn(),
  getApproveVotes: jest.fn(() => Promise.resolve(7)),
  getRejectVotes: jest.fn(() => Promise.resolve(3)),
  hasVoted: jest.fn(() => Promise.resolve(false)),
  getMinVotesQuorum: jest.fn(() => Promise.resolve(10)),
  getApprovalThresholdBps: jest.fn(() => Promise.resolve(5000)),
  verifyCampaignWithVotes: jest.fn(),
  getContribution: jest.fn(() => Promise.resolve(15_000_000n)),
  claimRefund: jest.fn(),
}));

jest.mock("@/lib/adminLog", () => ({
  appendAdminAuditLog: jest.fn(),
  getAdminAuditLog: jest.fn(() => []),
}));

jest.mock("@/lib/campaignReports", () => ({
  getAllReports: jest.fn(() => []),
  markReportReviewed: jest.fn(),
  REPORT_REASON_LABELS: { spam: "Spam" },
}));

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 101,
    creator: CREATOR,
    title: "Solar Classroom",
    description: "Fund solar-powered classroom kits for learners.",
    created_at: 1_700_000_000,
    status: "active",
    funding_goal: 100_000_000n,
    deadline: Math.floor(Date.now() / 1000) + 86_400,
    amount_raised: 25_000_000n,
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

describe("app page components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue({
      publicKey: ADMIN,
      isWalletConnected: true,
      connectWallet: mockConnectWallet,
      isLoading: false,
    });
    mockUseCampaign.mockReturnValue({
      campaign: makeCampaign(),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseCampaigns.mockReturnValue({
      campaigns: [makeCampaign()],
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("renders the home page campaign CTA and connects wallet before starting a campaign", async () => {
    mockUseWallet.mockReturnValue({
      publicKey: null,
      isWalletConnected: false,
      connectWallet: mockConnectWallet,
      isLoading: false,
    });

    render(<HomeClient />);
    await userEvent.click(screen.getByRole("link", { name: /startCampaign/i }));

    expect(screen.getByRole("heading", { name: "heroTitle" })).toBeInTheDocument();
    expect(mockConnectWallet).toHaveBeenCalledTimes(1);
  });

  it("renders the cause detail page with campaign data, voting, actions, and refund state", async () => {
    mockUseCampaign.mockReturnValue({
      campaign: makeCampaign({ status: "cancelled", is_active: false, is_cancelled: true }),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<CauseDetailClient id="101" />);

    expect(screen.getByRole("heading", { name: "Solar Classroom" })).toBeInTheDocument();
    expect(screen.getByText(/Fund solar-powered classroom kits/)).toBeInTheDocument();
    expect(screen.getByTestId("voting-component")).toBeInTheDocument();
    expect(screen.getByTestId("campaign-actions")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /claim refund/i })).toBeInTheDocument();
  });

  it("renders the admin dashboard queue and aggregate campaign stats for the admin wallet", async () => {
    render(<AdminClient />);

    expect(await screen.findByText("title")).toBeInTheDocument();
    expect(screen.getByText("Solar Classroom")).toBeInTheDocument();
    expect(screen.getByText("totalCampaigns")).toBeInTheDocument();
    expect(screen.getByText("verificationQueue")).toBeInTheDocument();
  });
});
