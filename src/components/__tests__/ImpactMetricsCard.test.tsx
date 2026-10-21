import { render, screen } from "@testing-library/react";
import { Category, type Campaign } from "@/types";
import ImpactMetricsCard from "../ImpactMetricsCard";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GABC123456789012345678901234567890123456789012345678901234567890",
    title: "Test Campaign",
    description: "A test campaign.",
    created_at: 1_000_000,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: 2_000_000_000,
    amount_raised: BigInt(40_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    ...overrides,
  };
}

describe("ImpactMetricsCard", () => {
  it("renders a glassmorphism impact card with animated metric tiles and responsive layout hints", () => {
    const { container } = render(<ImpactMetricsCard campaign={makeCampaign()} />);

    const card = container.firstElementChild;
    expect(card).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Impact Metrics" })).toBeInTheDocument();
    expect(screen.getByText("Funding Efficiency")).toBeInTheDocument();
    expect(card).toHaveClass("backdrop-blur-xl");
    expect(card).toHaveClass("shadow-[0_20px_60px_-20px_rgba(16,24,40,0.28)]");
    expect(card).toHaveClass("transition-all");
  });
});
