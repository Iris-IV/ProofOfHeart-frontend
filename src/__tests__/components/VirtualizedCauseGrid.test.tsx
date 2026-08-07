import { render, screen, fireEvent } from "@testing-library/react";
import VirtualizedCauseGrid from "@/components/VirtualizedCauseGrid";
import { Category, type Campaign } from "@/types";

jest.mock("@/components/CauseCard", () => ({
  __esModule: true,
  default: ({ campaign }: { campaign: Campaign }) => <div>Card {campaign.id}</div>,
}));

function makeCampaigns(count: number): Campaign[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: `Campaign ${i + 1}`,
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
  }));
}

const noop = () => {};
const asyncNoop = async () => {};

const baseProps = {
  userWalletAddress: null,
  onVote: asyncNoop,
  onCancel: asyncNoop,
  onClaimRefund: asyncNoop,
  onTagClick: noop,
  userVotes: {},
  voteCounts: {},
  hasNextPage: false,
  isFetchingNextPage: false,
  onLoadMore: jest.fn(),
};

describe("VirtualizedCauseGrid — issue #593", () => {
  it("does not mount a DOM node for every campaign when the list is large", () => {
    render(<VirtualizedCauseGrid {...baseProps} campaigns={makeCampaigns(120)} />);

    const renderedCards = screen.getAllByText(/^Card \d+$/);
    expect(renderedCards.length).toBeGreaterThan(0);
    expect(renderedCards.length).toBeLessThan(120);
  });

  it("renders every card when the list is small enough to fit without virtualization overhead", () => {
    render(<VirtualizedCauseGrid {...baseProps} campaigns={makeCampaigns(3)} />);

    expect(screen.getByText("Card 1")).toBeInTheDocument();
    expect(screen.getByText("Card 2")).toBeInTheDocument();
    expect(screen.getByText("Card 3")).toBeInTheDocument();
  });

  it("shows a manual Load more control when another page is available", () => {
    const onLoadMore = jest.fn();
    render(
      <VirtualizedCauseGrid
        {...baseProps}
        campaigns={makeCampaigns(12)}
        hasNextPage
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("hides the Load more control once there is no next page", () => {
    render(
      <VirtualizedCauseGrid {...baseProps} campaigns={makeCampaigns(12)} hasNextPage={false} />,
    );
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("disables the Load more control while a page is already loading", () => {
    render(
      <VirtualizedCauseGrid
        {...baseProps}
        campaigns={makeCampaigns(12)}
        hasNextPage
        isFetchingNextPage
      />,
    );
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });
});
