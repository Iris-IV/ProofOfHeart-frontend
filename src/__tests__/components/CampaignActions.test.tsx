import { render, screen, fireEvent } from "@testing-library/react";
import CampaignActions from "@/components/CampaignActions";
import { Category, type Campaign } from "@/types";

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => ({ publicKey: "GCREATOR", connectWallet: jest.fn(), isWalletConnected: true }),
}));

jest.mock("@/hooks/useAdmin", () => ({ useAdmin: () => ({ admin: "GADMIN", isLoading: false }) }));
jest.mock("@/hooks/useContribution", () => ({
  useContribution: () => ({ contribution: BigInt(0), isLoading: false }),
}));
jest.mock("@/hooks/usePlatformFee", () => ({
  usePlatformFee: () => ({ platformFeeBps: 300, isLoading: false, isFallback: false }),
}));
jest.mock("@/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({ invoke: jest.fn(), isPending: () => false }),
}));
jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showSuccess: jest.fn(), showError: jest.fn(), showWarning: jest.fn() }),
}));
jest.mock("@/lib/contractClient", () => ({
  contribute: jest.fn(),
  cancelCampaign: jest.fn(),
  depositRevenue: jest.fn(),
  claimRefund: jest.fn(),
  claimRevenue: jest.fn(),
  verifyCampaign: jest.fn(),
}));

const baseCampaign: Campaign = {
  id: 7,
  creator: "GCREATOR",
  title: "Solar lamps",
  description: "desc",
  created_at: 0,
  status: "active",
  funding_goal: 1000n,
  deadline: 9_999_999_999,
  amount_raised: 1500n,
  is_active: true,
  funds_withdrawn: false,
  is_cancelled: false,
  is_verified: true,
  category: Category.Learner,
  has_revenue_sharing: true,
  revenue_share_percentage: 5,
};

describe("CampaignActions — accessibility (issue #676)", () => {
  it("associates the contribution amount input with its hint text", () => {
    render(<CampaignActions campaign={{ ...baseCampaign, creator: "GSOMEONEELSE" }} />);

    const input = screen.getByLabelText("Contribution amount");
    const hint = screen.getByText(
      "Contributions are made in XLM and recorded on-chain after wallet confirmation.",
    );
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("gives the revenue deposit input an accessible name", () => {
    render(<CampaignActions campaign={baseCampaign} />);
    fireEvent.click(screen.getByRole("button", { name: "Deposit Revenue" }));

    expect(screen.getByLabelText("Revenue deposit amount in XLM")).toBeInTheDocument();
  });
});
