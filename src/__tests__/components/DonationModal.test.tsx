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

const mockUsePlatformFee = jest.fn(() => ({
  platformFeeBps: 300,
  isLoading: false,
  isFallback: false,
  isError: false,
}));

jest.mock("@/hooks/usePlatformFee", () => ({
  usePlatformFee: (...args: unknown[]) => mockUsePlatformFee(...args),
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: "Fund This Cause",
      confirmedTitle: "Donation Confirmed",
      closeAriaLabel: "Close",
      amountLabel: "Amount (XLM)",
      amountPlaceholder: "e.g. 10",
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
      feeUnavailable: "Unable to load fee — proceeding may incur platform fees.",
      waitingSignature: "Waiting for Freighter signature…",
      waitingConfirmation: "Waiting for ledger confirmation…",
      submitting: "Submitting transaction to the network…",
      donatedSuccess: `${values?.amount} XLM donated successfully`,
      thankYou: "Thank you for supporting this cause.",
      viewExplorer: "View on Stellar Explorer →",
      close: "Close",
      scientificNotation: "Scientific notation is not allowed.",
      invalidNumber: "Please enter a valid number.",
      invalidAmount: "Please enter a valid amount.",
      amountMustBePositive: "Amount must be greater than zero.",
      invalidNumberFormat: "Invalid number format.",
      maxDecimalPlaces: "Maximum 7 decimal places allowed.",
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
    mockUsePlatformFee.mockReturnValue({
      platformFeeBps: 300,
      isLoading: false,
      isFallback: false,
      isError: false,
    });
  });

  it("rejects zero amounts by disabling submit", () => {
    render(<DonationModal {...defaultProps} />);

    const input = screen.getByLabelText("Amount (XLM)");
    fireEvent.change(input, { target: { value: "0" } });

    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();
  });

  it("rejects negative and non-numeric amounts", () => {
    render(<DonationModal {...defaultProps} />);

    const input = screen.getByLabelText("Amount (XLM)");
    const button = screen.getByRole("button", { name: /donate/i });

    fireEvent.change(input, { target: { value: "-5" } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "abc" } });
    expect(button).toBeDisabled();
  });

  it("associates amount validation errors with the input", () => {
    render(<DonationModal {...defaultProps} />);

    const input = screen.getByLabelText("Amount (XLM)");
    fireEvent.change(input, { target: { value: "0" } });

    // aria-invalid is set for inline validation feedback
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "donation-amount-error");
    // submit button is disabled when amount is invalid
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();
  });

  it("renders the platform fee explanation", () => {
    render(<DonationModal {...defaultProps} />);

    expect(
      screen.getByText(/A platform fee of .* is deducted from funds/),
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
    fireEvent.click(screen.getByRole("button", { name: /donate 10 xlm/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /donate 5 xlm/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /donate/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Submitting transaction to the network…")).toBeInTheDocument();
  });

  it("shows fee-unavailable warning when isError is true", () => {
    mockUsePlatformFee.mockReturnValue({
      platformFeeBps: 300,
      isLoading: false,
      isFallback: true,
      isError: true,
    });

    render(<DonationModal {...defaultProps} />);

    const warning = screen.getByRole("alert");
    expect(warning).toHaveTextContent(
      "Unable to load fee — proceeding may incur platform fees.",
    );
  });

  it("does not show fee-unavailable warning when isError is false", () => {
    render(<DonationModal {...defaultProps} />);

    expect(
      screen.queryByText("Unable to load fee — proceeding may incur platform fees."),
    ).not.toBeInTheDocument();
  });
});
