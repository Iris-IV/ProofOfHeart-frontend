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

  it("shows fee and net breakdown when goal is reached", () => {
    render(
      <WithdrawFunds
        campaign={makeCampaign({ amount_raised: BigInt(100_000_000) })}
        userWalletAddress={CREATOR}
        platformFeeBps={300}
      />,
    );

    expect(screen.getByText("totalRaised")).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) =>
        element?.tagName === "SPAN" ? element.textContent === "platformFeeWithPercent" : false,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("youWillReceive")).toBeInTheDocument();
    expect(screen.getByText("-0.3 XLM")).toBeInTheDocument();
    expect(screen.getByText("9.7 XLM")).toBeInTheDocument();
  });

  it("blocks withdrawal when funding goal has not been reached", () => {
    render(
      <WithdrawFunds
        campaign={makeCampaign({
          amount_raised: BigInt(50_000_000),
          funding_goal: BigInt(100_000_000),
        })}
        userWalletAddress={CREATOR}
      />,
    );

    expect(screen.getByRole("button", { name: "withdrawFunds" })).toBeDisabled();
    expect(screen.getByText("disabledGoalNotReached")).toBeInTheDocument();
  });

  it("handles already-withdrawn state", () => {
    render(
      <WithdrawFunds
        campaign={makeCampaign({ funds_withdrawn: true })}
        userWalletAddress={CREATOR}
      />,
    );

    expect(screen.getByRole("button", { name: "withdrawFunds" })).toBeDisabled();
    expect(screen.getByText("disabledAlreadyWithdrawn")).toBeInTheDocument();
  });

  it("defaults to 300 bps platform fee when prop is omitted", () => {
    render(
      <WithdrawFunds
        campaign={makeCampaign({ amount_raised: BigInt(100_000_000) })}
        userWalletAddress={CREATOR}
      />,
    );

    expect(
      screen.getByText((_content, element) =>
        element?.tagName === "SPAN" ? element.textContent === "platformFeeWithPercent" : false,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("-0.3 XLM")).toBeInTheDocument();
  });
});
