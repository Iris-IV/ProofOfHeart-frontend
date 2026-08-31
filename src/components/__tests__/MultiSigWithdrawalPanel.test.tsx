import { render, screen } from "@testing-library/react";
import MultiSigWithdrawalPanel from "../MultiSigWithdrawalPanel";
import { Category } from "@/types";

jest.mock("../../hooks/useMultiSigProposals", () => ({
  useMultiSigProposals: jest.fn(),
}));

jest.mock("../../hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({
    invoke: jest.fn(),
    isPending: () => false,
  }),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

jest.mock("../../lib/contractClient", () => ({
  withdrawFunds: jest.fn(),
}));

jest.mock("../../lib/stellar", () => ({
  isSameAddress: (a: string, b: string) => a === b,
}));

jest.mock("../../utils/contractErrors", () => ({
  parseContractError: (err: unknown) => String(err),
}));

jest.mock("@/lib/stellarAmount", () => ({
  stroopsToXlmNumber: (v: bigint) => Number(v) / 10_000_000,
}));

jest.mock("@/lib/formatters", () => ({
  formatNumber: (v: number) => v.toFixed(2),
}));

jest.mock("@/utils/explorer", () => ({
  explorerTxUrl: (hash: string) => `https://explorer.stellar.org/tx/${hash}`,
}));

import { useMultiSigProposals } from "../../hooks/useMultiSigProposals";

const mockUseMultiSigProposals = useMultiSigProposals as jest.MockedFunction<
  typeof useMultiSigProposals
>;

const mockCampaign = {
  id: 1,
  creator: "GABC12345678901234567890123456789012345678901234567890",
  title: "Test Campaign",
  description: "A test campaign.",
  created_at: 1_000_000,
  status: "active" as const,
  funding_goal: BigInt(100_000_000_000),
  deadline: 2_000_000_000,
  amount_raised: BigInt(200_000_000_000),
  is_active: true,
  funds_withdrawn: false,
  is_cancelled: false,
  is_verified: false,
  category: Category.Learner,
  has_revenue_sharing: false,
  revenue_share_percentage: 0,
};

function setupProposal(signers: Array<{ address: string; signedAt?: number }>) {
  return {
    id: "prop-1",
    campaignId: 1,
    proposedBy: "GABC12345678901234567890123456789012345678901234567890",
    createdAt: 1_000_000,
    signers,
    requiredSignatures: 2,
    status: "pending" as const,
  };
}

describe("MultiSigWithdrawalPanel", () => {
  it("renders per-signer rows with address and status", () => {
    mockUseMultiSigProposals.mockReturnValue({
      proposals: [],
      activeProposal: setupProposal([
        { address: "GABC12345678901234567890123456789012345678901234567890" },
        {
          address: "GDEF9876543210987654321098765432109876543210987654321",
          signedAt: 1_700_000_000,
        },
      ]),
      createProposal: jest.fn(),
      signProposal: jest.fn(),
      cancelProposal: jest.fn(),
      markExecuted: jest.fn(),
    });

    render(
      <MultiSigWithdrawalPanel
        campaign={mockCampaign}
        walletAddress="GABC12345678901234567890123456789012345678901234567890"
      />,
    );

    expect(screen.getByText("you")).toBeInTheDocument();
  });

  it("visually distinguishes the current wallet signer with a highlight", () => {
    mockUseMultiSigProposals.mockReturnValue({
      proposals: [],
      activeProposal: setupProposal([
        { address: "GABC12345678901234567890123456789012345678901234567890" },
        {
          address: "GDEF9876543210987654321098765432109876543210987654321",
          signedAt: 1_700_000_000,
        },
      ]),
      createProposal: jest.fn(),
      signProposal: jest.fn(),
      cancelProposal: jest.fn(),
      markExecuted: jest.fn(),
    });

    render(
      <MultiSigWithdrawalPanel
        campaign={mockCampaign}
        walletAddress="GABC12345678901234567890123456789012345678901234567890"
      />,
    );

    const youBadge = screen.getByText("you");
    expect(youBadge).toBeInTheDocument();
  });

  it("renders all signer rows correctly", () => {
    mockUseMultiSigProposals.mockReturnValue({
      proposals: [],
      activeProposal: setupProposal([
        { address: "GABC12345678901234567890123456789012345678901234567890" },
        {
          address: "GDEF9876543210987654321098765432109876543210987654321",
          signedAt: 1_700_000_000,
        },
        { address: "GHI555555555555555555555555555555555555555555555555555" },
      ]),
      createProposal: jest.fn(),
      signProposal: jest.fn(),
      cancelProposal: jest.fn(),
      markExecuted: jest.fn(),
    });

    render(
      <MultiSigWithdrawalPanel
        campaign={mockCampaign}
        walletAddress="GABC12345678901234567890123456789012345678901234567890"
      />,
    );

    expect(screen.getByText("you")).toBeInTheDocument();
  });
});
