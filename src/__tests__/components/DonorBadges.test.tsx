import { render, screen } from "@testing-library/react";
import DonorBadges from "@/components/DonorBadges";
import type { DonationRecord } from "@/lib/badges";

const XLM = BigInt(10_000_000);

function donation(campaignId: number, xlm: number, timestamp = 1_700_000_000): DonationRecord {
  return { campaignId, amount: BigInt(xlm) * XLM, timestamp };
}

describe("DonorBadges", () => {
  it("shows the empty state with no donations", () => {
    render(<DonorBadges donations={[]} />);
    expect(screen.getByText("Make your first donation to earn a badge.")).toBeInTheDocument();
    expect(screen.getByText(/Newcomer/)).toBeInTheDocument();
  });

  it("lists earned badges with their descriptions", () => {
    render(<DonorBadges donations={[donation(1, 5)]} />);
    const badge = screen.getByText("First Donation");
    expect(badge.closest("li")).toHaveAttribute("title", "Made your first contribution.");
  });

  it("reports the donor level and progress toward the next level", () => {
    render(<DonorBadges donations={[donation(1, 50)]} />);
    expect(screen.getByText(/Supporter/)).toBeInTheDocument();
    expect(screen.getByText("50 XLM to Advocate")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "44");
  });

  it("omits the progress bar at the top level", () => {
    render(<DonorBadges donations={[donation(1, 6000)]} />);
    expect(screen.getByText(/Legend/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("only animates for users who allow motion", () => {
    render(<DonorBadges donations={[donation(1, 5)]} />);
    const badge = screen.getByText("First Donation").closest("li")!;
    expect(badge.className).toContain("motion-safe:animate-in");
  });
});
