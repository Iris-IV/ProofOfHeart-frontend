import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { contribute } from "@/lib/contractClient";
import DonationModal from "@/components/DonationModal";
import { Category, type Campaign } from "@/types";

jest.mock("@/lib/contractClient", () => ({
  contribute: jest.fn(),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
  }),
}));

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => ({
    publicKey: "GCONTRIB1111111111111111111111111111111111111111111111111",
  }),
}));

jest.mock("@/hooks/usePlatformFee", () => ({
  usePlatformFee: () => ({
    platformFeeBps: 300,
    isLoading: false,
    isFallback: false,
  }),
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: "Fund This Cause",
      confirmedTitle: "Donation Confirmed",
      amountLabel: "Amount (XLM)",
      percentFunded: `${values?.percent}% funded`,
      afterDonation: `After your donation: ${values?.percent}% funded`,
      goalReached: "Goal reached!",
      contributionLine: "Contribution",
      networkFeeLine: "Est. network fee",
      totalLine: "Total from your wallet",
      donate: "Donate",
      donateAmount: `Donate ${values?.amount} XLM`,
      platformFeeNote: `A platform fee of ${values?.feePercent} is deducted from funds when withdrawn by the creator. Your full donation goes toward the campaign total.`,
      networkFeeNote: "Network fee note",
      waitingSignature: "Waiting for Freighter signature…",
      waitingConfirmation: "Waiting for ledger confirmation…",
      submitting: "Submitting transaction to the network…",
      donatedSuccess: `${values?.amount} XLM donated successfully`,
      thankYou: "Thank you for supporting this cause.",
      viewExplorer: "View on Stellar Explorer →",
      close: "Close",
    };
    return map[key] ?? key;
  },
}));

jest.mock("@/lib/analytics", () => ({
  trackClickContribute: jest.fn(),
  trackEnterAmount: jest.fn(),
  trackReviewContribution: jest.fn(),
  trackSignTransaction: jest.fn(),
  trackContributionConfirmed: jest.fn(),
  trackContributionError: jest.fn(),
}));

const mockContribute = contribute as jest.MockedFunction<typeof contribute>;

const CREATOR = "GCREATOR1111111111111111111111111111111111111111111111111";
const CONTRIBUTOR = "GCONTRIB1111111111111111111111111111111111111111111111111";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: CREATOR,
    title: "Help Build a School",
    description: "Desc",
    created_at: 1,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: 9_999_999_999,
    amount_raised: BigInt(10_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: true,
    category: Category.Educator,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    ...overrides,
  };
}

const defaultProps = {
  campaign: makeCampaign(),
  onClose: jest.fn(),
  onSuccess: jest.fn(),
};

describe("DonationModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects zero amounts by disabling submit", () => {
    render(<DonationModal {...defaultProps} />);

    const input = screen.getByLabelText("Amount (XLM)");
    fireEvent.change(input, { target: { value: "0" } });

    expect(screen.getByRole("button", { name: /Donate/ })).toBeDisabled();
  });

  it("rejects negative and non-numeric amounts", () => {
    render(<DonationModal {...defaultProps} />);

    const input = screen.getByLabelText("Amount (XLM)");
    const button = screen.getByRole("button", { name: /Donate/ });

    fireEvent.change(input, { target: { value: "-5" } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "abc" } });
    expect(button).toBeDisabled();
  });

  it("renders the platform fee explanation", () => {
    render(<DonationModal {...defaultProps} />);

    expect(
      screen.getByText(/A platform fee of 3% is deducted from funds when withdrawn by the creator/),
    ).toBeInTheDocument();
  });

  it("shows estimated network fee and total wallet cost when amount is entered", () => {
    render(<DonationModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

    expect(screen.getByText("Est. network fee")).toBeInTheDocument();
    expect(screen.getByText("Total from your wallet")).toBeInTheDocument();
    expect(screen.getByText(/10\.01\s*XLM/)).toBeInTheDocument();
  });

  it("calls contribute with amount converted to stroops", async () => {
    mockContribute.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("mock-tx-hash"), 50)),
    );

    render(<DonationModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /Donate 10 XLM/ }));

    await waitFor(() =>
      expect(mockContribute).toHaveBeenCalledWith(1, CONTRIBUTOR, BigInt(100_000_000), {
        onStatus: expect.any(Function),
      }),
    );
  });

  it("hides submit controls while a transaction is in flight", async () => {
    mockContribute.mockImplementation(() => new Promise(() => {}));

    render(<DonationModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Donate 5 XLM/ }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Donate/ })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Submitting transaction to the network/)).toBeInTheDocument();
  });
});
