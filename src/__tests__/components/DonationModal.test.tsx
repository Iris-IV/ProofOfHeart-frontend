import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

jest.mock("@/lib/analytics", () => ({
  trackClickContribute: jest.fn(),
  trackEnterAmount: jest.fn(),
  trackReviewContribution: jest.fn(),
  trackSignTransaction: jest.fn(),
  trackContributionConfirmed: jest.fn(),
  trackContributionError: jest.fn(),
}));

import { contribute } from "@/lib/contractClient";

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
});
