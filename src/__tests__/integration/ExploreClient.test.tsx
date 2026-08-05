import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExplorePage from "@/app/[locale]/explore/ExploreClient";
import { Category, type Campaign } from "@/types";

const mockUseCampaigns = jest.fn();

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

jest.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/hooks/useCampaigns", () => ({
  useCampaigns: () => mockUseCampaigns(),
}));

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: "Campaign",
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
    ...overrides,
  };
}

describe("ExploreClient category filter", () => {
  const scrollToSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.scrollTo = scrollToSpy;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    mockUseCampaigns.mockReturnValue({
      campaigns: [
        makeCampaign({ id: 1, title: "Learner campaign", category: Category.Learner }),
        makeCampaign({ id: 2, title: "Educator campaign", category: Category.Educator }),
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("does not scroll on initial mount", async () => {
    render(<ExplorePage />);

    expect(await screen.findByText("Learner campaign")).toBeInTheDocument();
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("scrolls back to the top when the active category changes", async () => {
    const user = userEvent.setup();
    render(<ExplorePage />);

    scrollToSpy.mockClear();

    const educatorPill = screen.getByRole("button", { name: /Educator/i });
    await user.click(educatorPill);

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0 });
    expect(screen.getByText("Educator campaign")).toBeInTheDocument();
    expect(screen.queryByText("Learner campaign")).not.toBeInTheDocument();
  });

  it("does not scroll again for renders that don't change the active category", async () => {
    const user = userEvent.setup();
    render(<ExplorePage />);

    scrollToSpy.mockClear();

    const allPill = screen.getByRole("button", { name: "all" });
    await user.click(allPill);

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
