import { render, screen, fireEvent } from "@testing-library/react";
import MultiSigWithdrawalPanel from "@/components/MultiSigWithdrawalPanel";
import { Category, type Campaign } from "@/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) return `${key} ${JSON.stringify(values)}`;
    return key;
  },
  useLocale: () => "en",
}));

jest.mock("@/hooks/useMultiSigProposals", () => ({
  useMultiSigProposals: () => ({
    activeProposal: null,
    createProposal: jest.fn(),
    signProposal: jest.fn(),
    cancelProposal: jest.fn(),
    markExecuted: jest.fn(),
  }),
}));

jest.mock("@/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({ invoke: jest.fn(), isPending: () => false }),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showError: jest.fn(), showSuccess: jest.fn() }),
}));

const campaign: Campaign = {
  id: 1,
  creator: "GCREATOR",
  title: "Water well",
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
  has_revenue_sharing: false,
  revenue_share_percentage: 0,
};

describe("MultiSigWithdrawalPanel — accessibility (issue #676)", () => {
  function openSetup() {
    render(
      <MultiSigWithdrawalPanel campaign={campaign} walletAddress="GCREATOR" platformFeeBps={300} />,
    );
    fireEvent.click(screen.getByText("setupProposal"));
  }

  it("gives each signer address input a distinct accessible name", () => {
    openSetup();

    expect(screen.getByLabelText('signerAddressAriaLabel {"index":1}')).toBeInTheDocument();
    expect(screen.getByLabelText('signerAddressAriaLabel {"index":2}')).toBeInTheDocument();
  });

  it("keeps signer accessible names in sync after adding another signer", () => {
    openSetup();
    fireEvent.click(screen.getByText(/addSigner/));

    expect(screen.getByLabelText('signerAddressAriaLabel {"index":3}')).toBeInTheDocument();
  });

  it("associates the threshold input with its label", () => {
    openSetup();
    expect(screen.getByLabelText("thresholdLabel")).toBeInTheDocument();
  });
});
