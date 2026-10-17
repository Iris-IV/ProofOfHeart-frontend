import { fireEvent, render, screen } from "@testing-library/react";
import DonationMilestones, { canClaimMilestone } from "../DonationMilestones";
import type { ContractMilestone } from "@/types";

// Values-aware next-intl mock so interpolated strings (e.g. the expected payout
// amount) appear in the rendered output for numeric assertions.
jest.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, values?: Record<string, unknown>) =>
      values && Object.keys(values).length > 0
        ? `${key} ${JSON.stringify(values)}`
        : key,
}));

jest.mock("@/lib/contractClient", () => ({
  BPS_DENOMINATOR: 10000,
  // Real contract math (ceil fee, floor claim) so the rendered payout is exact.
  expectedMilestonePayout: (
    amountRaised: bigint,
    payoutBps: number,
    feeBps: number,
  ): bigint => {
    const feeTotal =
      (amountRaised * BigInt(feeBps) + BigInt(9_999)) / BigInt(10_000);
    const totalAfterFee = amountRaised - feeTotal;
    return (totalAfterFee * BigInt(payoutBps)) / BigInt(10_000);
  },
}));

const milestones: ContractMilestone[] = [
  { id: 1, description: "School supplies delivered", payout_bps: 5000, verified: true },
  { id: 2, description: "Teachers trained", payout_bps: 3000, verified: false },
];

const FIFTY_XLM = 50n * 10_000_000n;
const ONE_HUNDRED_XLM = 100n * 10_000_000n;

function basePlan(overrides: Record<string, unknown> = {}) {
  return {
    milestones,
    claimed: {},
    isAdmin: false,
    isCreator: false,
    isFundingGoalMet: true,
    isWithdrawn: false,
    platformFeeBps: 250,
    onVerify: jest.fn(),
    onClaim: jest.fn(),
    isVerifyingId: null,
    isClaimingId: null,
    ...overrides,
  };
}

describe("DonationMilestones — on-chain payout plan (issue #1672)", () => {
  it("renders each milestone's description, payout share and state", () => {
    render(
      <DonationMilestones amountRaised={ONE_HUNDRED_XLM} onChainPlan={basePlan()} />,
    );

    expect(screen.getByText("School supplies delivered")).toBeInTheDocument();
    expect(screen.getByText("Teachers trained")).toBeInTheDocument();
    const shareCells = screen.getAllByText(
      (_, el) => el?.tagName === "P" && (el?.textContent ?? "").startsWith("payoutShare"),
    );
    expect(shareCells.length).toBe(2);
    expect(screen.getByTestId("milestone-state-1")).toHaveTextContent("statusVerified");
    expect(screen.getByTestId("milestone-state-2")).toHaveTextContent("statusPending");
  });

  it("shows a claimed milestone with the claimed badge and no claim button", () => {
    render(
      <DonationMilestones
        amountRaised={ONE_HUNDRED_XLM}
        onChainPlan={basePlan({ claimed: { 1: true }, milestones: [milestones[0]] })}
      />,
    );

    expect(screen.getByTestId("milestone-state-1")).toHaveTextContent("statusClaimed");
    expect(screen.queryByTestId("claim-milestone-1")).not.toBeInTheDocument();
  });

  it("shows the admin verify action only for the platform admin, enabled for an unverified milestone", () => {
    const onVerify = jest.fn();
    render(
      <DonationMilestones
        amountRaised={ONE_HUNDRED_XLM}
        onChainPlan={basePlan({ isAdmin: true, onVerify })}
      />,
    );

    expect(screen.queryByTestId("verify-milestone-1")).not.toBeInTheDocument();
    const verifyBtn = screen.getByTestId("verify-milestone-2");
    expect(verifyBtn).toBeEnabled();

    fireEvent.click(verifyBtn);
    expect(onVerify).toHaveBeenCalledWith(2);
  });

  it("disables verification for an already verified milestone", () => {
    render(
      <DonationMilestones
        amountRaised={ONE_HUNDRED_XLM}
        onChainPlan={basePlan({ milestones: [milestones[0]], isAdmin: true })}
      />,
    );

    expect(screen.getByTestId("milestone-state-1")).toHaveTextContent("statusVerified");
    expect(screen.getByText("verifiedByAdmin")).toBeInTheDocument();
    expect(screen.queryByTestId("verify-milestone-1")).not.toBeInTheDocument();
  });

  it("does not render verify actions for non-admin wallets", () => {
    render(
      <DonationMilestones amountRaised={ONE_HUNDRED_XLM} onChainPlan={basePlan()} />,
    );

    expect(screen.queryByTestId("verify-milestone-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("verify-milestone-2")).not.toBeInTheDocument();
  });

  it("enables the creator claim action when verified, unclaimed, goal met and not withdrawn", () => {
    const onClaim = jest.fn();
    render(
      <DonationMilestones
        amountRaised={ONE_HUNDRED_XLM}
        onChainPlan={basePlan({ isCreator: true, onClaim })}
      />,
    );

    const claimBtn = screen.getByTestId("claim-milestone-1");
    expect(claimBtn).toBeEnabled();

    fireEvent.click(claimBtn);
    expect(onClaim).toHaveBeenCalledWith(1);
  });

  it("disables the claim action while the funding goal is not met, and explains why", () => {
    render(
      <DonationMilestones
        amountRaised={ONE_HUNDRED_XLM}
        onChainPlan={basePlan({ isCreator: true, isFundingGoalMet: false, milestones: [milestones[0]] })}
      />,
    );

    const claimBtn = screen.getByTestId("claim-milestone-1");
    expect(claimBtn).toBeDisabled();
    expect(screen.getByText("claimBlockedByGoal")).toBeInTheDocument();
  });

  it("disables the claim action when funds are already withdrawn", () => {
    render(
      <DonationMilestones
        amountRaised={ONE_HUNDRED_XLM}
        onChainPlan={basePlan({ isCreator: true, isWithdrawn: true, milestones: [milestones[0]] })}
      />,
    );

    expect(screen.getByTestId("claim-milestone-1")).toBeDisabled();
    expect(screen.getByText("claimBlockedByWithdrawn")).toBeInTheDocument();
  });

  it("disables the claim action while the milestone is pending admin verification", () => {
    render(
      <DonationMilestones
        amountRaised={ONE_HUNDRED_XLM}
        onChainPlan={basePlan({ isCreator: true, isFundingGoalMet: false, milestones: [milestones[1]] })}
      />,
    );

    expect(screen.getByTestId("claim-milestone-2")).toBeDisabled();
    expect(screen.getByText("claimBlockedByUnverified")).toBeInTheDocument();
    expect(screen.getByText("claimBlockedByGoal")).toBeInTheDocument();
  });

  it("shows the expected payout after the platform fee for the creator", () => {
    render(
      <DonationMilestones
        amountRaised={FIFTY_XLM}
        onChainPlan={basePlan({ isCreator: true, milestones: [milestones[0]] })}
      />,
    );

    // 50 XLM raised, 250 bps fee, 5000 bps payout -> 24.5 * 50% = 24.375 XLM
    const payoutLines = screen.getAllByText(
      (_, el) => (el?.textContent ?? "").includes("expectedPayout"),
    );
    expect(payoutLines.length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain("24");
  });

  it("does not show the claim action for non-creators", () => {
    render(<DonationMilestones amountRaised={ONE_HUNDRED_XLM} onChainPlan={basePlan()} />);

    expect(screen.queryByTestId("claim-milestone-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("claim-milestone-2")).not.toBeInTheDocument();
  });

  it("disables the claim button while the claim transaction is in flight", () => {
    render(
      <DonationMilestones
        amountRaised={ONE_HUNDRED_XLM}
        onChainPlan={basePlan({ isCreator: true, isClaimingId: 1 })}
      />,
    );

    expect(screen.getByTestId("claim-milestone-1")).toBeDisabled();
    expect(screen.getByText("claimingAction")).toBeInTheDocument();
  });

  it("keeps rendering the legacy thank-you milestones when no on-chain plan exists", () => {
    render(<DonationMilestones amountRaised={ONE_HUNDRED_XLM} />);

    expect(screen.getByText("Donation Milestones")).toBeInTheDocument();
    expect(screen.queryByText(/Milestone payouts/)).not.toBeInTheDocument();
  });
});

describe("canClaimMilestone gating (issue #1672)", () => {
  const full = {
    verified: true,
    claimed: false,
    isFundingGoalMet: true,
    isWithdrawn: false,
  };

  it.each([
    [true, full, "happy path — verified, unclaimed, goal met, not withdrawn"],
    [false, { ...full, verified: false }, "unverified milestone"],
    [false, { ...full, claimed: true }, "already claimed milestone"],
    [false, { ...full, isFundingGoalMet: false }, "funding goal not reached"],
    [false, { ...full, isWithdrawn: true }, "campaign funds already withdrawn"],
  ])("returns %s when the milestone is %s", (expected, plan) => {
    expect(canClaimMilestone(plan)).toBe(expected);
  });
});
