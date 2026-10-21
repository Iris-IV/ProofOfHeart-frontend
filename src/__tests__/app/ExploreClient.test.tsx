import { fireEvent, render, screen, within } from "@testing-library/react";
import ExplorePage from "@/app/[locale]/explore/ExploreClient";
import { useInfiniteCampaigns } from "@/hooks/useInfiniteCampaigns";
import { EXPLORE_DENSITY_STORAGE_KEY } from "@/lib/explorePreferences";
import { Category, type Campaign } from "@/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

jest.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <img alt={typeof props.alt === "string" ? props.alt : ""} />
  ),
}));

// Render every row so the layout assertions do not depend on jsdom viewport maths.
jest.mock("@tanstack/react-virtual", () => ({
  useWindowVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 100 })),
    getTotalSize: () => count * 100,
    measureElement: () => undefined,
    scrollToOffset: () => undefined,
    options: { scrollMargin: 0 },
  }),
}));

jest.mock("@/hooks/useInfiniteCampaigns", () => ({
  useInfiniteCampaigns: jest.fn(),
}));

const mockUseInfiniteCampaigns = useInfiniteCampaigns as jest.MockedFunction<
  typeof useInfiniteCampaigns
>;

function makeCampaign(id: number, overrides: Partial<Campaign> = {}): Campaign {
  return {
    id,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: `Campaign ${id}`,
    description: "Desc",
    created_at: 1,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: 9_999_999_999,
    amount_raised: BigInt(10_000_000 * id),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: true,
    category: Category.Educator,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    ...overrides,
  };
}

function mockCampaigns(campaigns: Campaign[]) {
  mockUseInfiniteCampaigns.mockReturnValue({
    campaigns,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    isEmpty: campaigns.length === 0,
    error: null,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
  });
}

describe("ExplorePage layout toggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockCampaigns([makeCampaign(1), makeCampaign(2, { title: "Second cause" })]);
  });

  it("starts in the compact list and marks it as pressed", () => {
    render(<ExplorePage />);

    expect(screen.getByRole("button", { name: "viewCompact" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "viewGrid" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByRole("button", { name: "viewGrid" })).toBeInTheDocument();
    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
  });

  it("switches to the grid and remembers the choice", () => {
    render(<ExplorePage />);

    fireEvent.click(screen.getByRole("button", { name: "viewGrid" }));

    expect(screen.getByRole("button", { name: "viewGrid" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem(EXPLORE_DENSITY_STORAGE_KEY)).toBe("grid");

    // Grid cards are links with a rank badge and the campaign title.
    const card = screen.getByText("Second cause").closest("a");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("#1")).toBeInTheDocument();
  });

  it("switches back to the compact list", () => {
    window.localStorage.setItem(EXPLORE_DENSITY_STORAGE_KEY, "grid");
    render(<ExplorePage />);

    fireEvent.click(screen.getByRole("button", { name: "viewCompact" }));

    expect(window.localStorage.getItem(EXPLORE_DENSITY_STORAGE_KEY)).toBe("compact");
    expect(screen.getByRole("button", { name: "viewCompact" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("applies a saved grid preference after mount", () => {
    window.localStorage.setItem(EXPLORE_DENSITY_STORAGE_KEY, "grid");
    render(<ExplorePage />);

    expect(screen.getByRole("button", { name: "viewGrid" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides the toggle while the listing is empty", () => {
    mockCampaigns([]);
    render(<ExplorePage />);

    expect(screen.queryByRole("button", { name: "viewGrid" })).not.toBeInTheDocument();
  });

  it("shows the cover image in a grid card when the campaign has one", () => {
    mockCampaigns([
      makeCampaign(3, {
        title: "Illustrated cause",
        cover_image_url: "https://example.com/cover.png",
      }),
    ]);
    window.localStorage.setItem(EXPLORE_DENSITY_STORAGE_KEY, "grid");
    render(<ExplorePage />);

    const card = screen.getByText("Illustrated cause").closest("a") as HTMLElement;
    expect(within(card).getByRole("img")).toHaveAttribute("alt", "Illustrated cause");
  });

  it("falls back to the category icon in a grid card without a cover image", () => {
    mockCampaigns([makeCampaign(4, { title: "Plain cause", category: Category.Educator })]);
    window.localStorage.setItem(EXPLORE_DENSITY_STORAGE_KEY, "grid");
    render(<ExplorePage />);

    const card = screen.getByText("Plain cause").closest("a") as HTMLElement;
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
    expect(within(card).getByText("👩‍🏫")).toBeInTheDocument();
  });
});
