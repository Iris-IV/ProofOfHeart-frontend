import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreatorDashboard from "@/components/CreatorDashboard";
import { Campaign, Category } from "@/types";

const CREATOR = "GCREATOR000000000000000000000000000000000000000000000000000000";

function makeCampaign(id: number): Campaign {
  return {
    id,
    creator: CREATOR,
    title: `Campaign ${id}`,
    description: "A test campaign",
    funding_goal: BigInt(100_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400,
    amount_raised: BigInt(0),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    created_at: Math.floor(Date.now() / 1000),
    status: "active",
  };
}

describe("CreatorDashboard pagination (issue #1106)", () => {
  it("shows only the first page of campaigns and a total count when there are many", () => {
    const campaigns = Array.from({ length: 25 }, (_, i) => makeCampaign(i + 1));
    render(<CreatorDashboard campaigns={campaigns} creatorAddress={CREATOR} />);

    expect(screen.getByText("Showing 10 of 25")).toBeInTheDocument();
    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.getByText("Campaign 10")).toBeInTheDocument();
    expect(screen.queryByText("Campaign 11")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("reveals more campaigns on Load more and hides the button once all are shown", async () => {
    const user = userEvent.setup();
    const campaigns = Array.from({ length: 25 }, (_, i) => makeCampaign(i + 1));
    render(<CreatorDashboard campaigns={campaigns} creatorAddress={CREATOR} />);

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByText("Showing 20 of 25")).toBeInTheDocument();
    expect(screen.getByText("Campaign 20")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByText("Showing 25 of 25")).toBeInTheDocument();
    expect(screen.getByText("Campaign 25")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("does not paginate when there are fewer campaigns than a page", () => {
    const campaigns = Array.from({ length: 3 }, (_, i) => makeCampaign(i + 1));
    render(<CreatorDashboard campaigns={campaigns} creatorAddress={CREATOR} />);

    expect(screen.getByText("Showing 3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});
