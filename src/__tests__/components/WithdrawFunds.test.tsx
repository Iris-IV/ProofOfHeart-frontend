import { render, screen } from "@testing-library/react";
import WithdrawFunds from "@/components/WithdrawFunds";
import { Category, type Campaign } from "@/types";

jest.mock("@/lib/contractClient", () => ({
  withdrawFunds: jest.fn(),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
  }),
}));

jest.mock("@/hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({
    invoke: jest.fn(),
    isPending: () => false,
  }),
}));

const CREATOR = "GCREATOR1111111111111111111111111111111111111111111111111";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: CREATOR,
    title: "Test Campaign",
    description: "Desc",
    created_at: 1,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: Math.floor(Date.now() / 1000) - 3600,
    amount_raised: BigInt(100_000_000),
    is_active: false,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: true,
    category: Category.Educator,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    ...overrides,
  };
}

describe("WithdrawFunds", () => {
  it("renders nothing for non-creator wallets", () => {
    const { container } = render(
      <WithdrawFunds
        campaign={makeCampaign()}
        userWalletAddress="GOTHER111111111111111111111111111111111111111111111111111"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
