import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CampaignTabs from "@/components/CampaignTabs";
import { Campaign, Category } from "@/types";

const mockLocalStorage: Record<string, string> = {};
let getItemSpy: jest.SpyInstance;
let setItemSpy: jest.SpyInstance;

beforeEach(() => {
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  getItemSpy = jest.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => mockLocalStorage[key] ?? null);
  setItemSpy = jest.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
    mockLocalStorage[key] = value;
  });
});

afterEach(() => {
  getItemSpy?.mockRestore();
  setItemSpy?.mockRestore();
});

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: "Test Campaign",
    description: "A test campaign",
    created_at: 1_700_000_000,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400,
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

jest.mock("@/components/UpdatesSection", () => ({
  __esModule: true,
  default: ({ campaign }: { campaign: { title: string } }) => (
    <div data-testid="updates-section">{campaign.title} updates</div>
  ),
}));

jest.mock("@/components/CommentsSection", () => ({
  __esModule: true,
  default: ({ campaign }: { campaign: { title: string } }) => (
    <div data-testid="comments-section">{campaign.title} comments</div>
  ),
}));

describe("CampaignTabs", () => {
  beforeEach(() => {
    mockLocalStorage["campaign_last_viewed_1_updates"] = "1609459200";
    mockLocalStorage["campaign_last_viewed_1_comments"] = "1609459200";
  });

  it("renders the tabs with labels", () => {
    render(<CampaignTabs campaign={makeCampaign()} />);
    expect(screen.getByText("Updates")).toBeInTheDocument();
    expect(screen.getByText("Comments / Q&A")).toBeInTheDocument();
  });

  it("shows an unread indicator when campaign is newer than last viewed", () => {
    const campaign = makeCampaign({ created_at: 1_700_000_000 });
    mockLocalStorage["campaign_last_viewed_1_updates"] = "1000000000";

    render(<CampaignTabs campaign={campaign} />);

    const updatesTab = screen.getByRole("tab", { name: /updates/i });
    const badge = updatesTab.querySelector('[class*="rounded-full"]');
    expect(badge).toBeInTheDocument();
  });

  it("does not show an indicator when campaign is older than last viewed", () => {
    const campaign = makeCampaign({ created_at: 1_000_000_000 });

    render(<CampaignTabs campaign={campaign} />);

    const updatesTab = screen.getByRole("tab", { name: /updates/i });
    const badge = updatesTab.querySelector('[class*="rounded-full"]');
    expect(badge).not.toBeInTheDocument();
  });

  it("clears the indicator when the tab is opened", async () => {
    const campaign = makeCampaign({ created_at: 1_700_000_000 });
    mockLocalStorage["campaign_last_viewed_1_updates"] = "1000000000";

    render(<CampaignTabs campaign={campaign} />);

    const updatesTab = screen.getByRole("tab", { name: /updates/i });
    const badgeBefore = updatesTab.querySelector('[class*="rounded-full"]');
    expect(badgeBefore).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /comments/i }));

    const updatesTabAfter = screen.getByRole("tab", { name: /updates/i });
    const badgeAfter = updatesTabAfter.querySelector('[class*="rounded-full"]');
    expect(badgeAfter).not.toBeInTheDocument();

    expect(mockLocalStorage["campaign_last_viewed_1_updates"]).toBeDefined();
  });

  it("switches active tab when clicked", async () => {
    render(<CampaignTabs campaign={makeCampaign()} />);

    const commentsTab = screen.getByRole("tab", { name: /comments/i });
    await userEvent.click(commentsTab);

    expect(commentsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("comments-section")).toBeInTheDocument();
  });
});
