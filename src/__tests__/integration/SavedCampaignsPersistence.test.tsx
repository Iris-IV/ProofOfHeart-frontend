import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import type { Campaign } from "@/types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const MOCK_PUBLIC_KEY = "GTESTSAVEDCAMP123456789012345678901234567890";

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => ({
    publicKey: MOCK_PUBLIC_KEY,
    isWalletConnected: true,
  }),
}));

jest.mock("@/i18n/routing", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === "allCategories") return "All Categories";
    if (key === "categoryChipAriaSelected") {
      return `${values?.label}, ${values?.count} causes, selected`;
    }
    if (key === "categoryChipAriaUnselected") {
      return `${values?.label}, ${values?.count} causes`;
    }
    return key;
  },
}));

jest.mock("@/hooks/useInfiniteCampaigns", () => ({
  useInfiniteCampaigns: () => ({
    campaigns: [] as Campaign[],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    isEmpty: false,
    error: null,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
  }),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
    showWarning: jest.fn(),
  }),
}));

// Stand-in for the on-chain bookmark list: survives remounts like real contract state.
const mockChainBookmarks: number[] = [];

jest.mock("@/lib/contractClient", () => ({
  MAX_BOOKMARKS_PER_WALLET: 10,
  getSavedCampaigns: jest.fn(() => Promise.resolve([...mockChainBookmarks])),
  getSavedCampaignsCount: jest.fn(() => Promise.resolve(mockChainBookmarks.length)),
  saveCampaign: jest.fn((_user: string, id: number) => {
    mockChainBookmarks.push(id);
    return Promise.resolve("tx");
  }),
  removeSavedCampaign: jest.fn((_user: string, id: number) => {
    const index = mockChainBookmarks.indexOf(id);
    if (index >= 0) mockChainBookmarks.splice(index, 1);
    return Promise.resolve("tx");
  }),
  batchSaveCampaigns: jest.fn(),
  cancelCampaign: jest.fn(),
  claimRefund: jest.fn(),
  voteOnCampaign: jest.fn(),
  hasVoted: jest.fn(),
  getApproveVotes: jest.fn(),
  getRejectVotes: jest.fn(),
}));

jest.mock("@/components/VotingComponent", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/CampaignStatusBadge", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/FundingProgressBar", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/DeadlineCountdown", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/cancelCampaignModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/CauseCard", () => {
  const { useSavedCampaigns } = jest.requireActual("@/hooks/useSavedCampaigns");
  return {
    __esModule: true,
    default: function MockCauseCard({ campaign }: { campaign: Campaign }) {
      const { isSaved, toggleSaved } = useSavedCampaigns();
      return (
        <div>
          <span>{campaign.title}</span>
          <button
            data-testid={`save-btn-${campaign.id}`}
            onClick={() => toggleSaved(campaign.id)}
            aria-pressed={isSaved(campaign.id)}
            type="button"
          >
            {isSaved(campaign.id) ? "Saved" : "Save"}
          </button>
        </div>
      );
    },
  };
});

import CausesClient from "@/app/[locale]/causes/CausesClient";

// ── Test setup ─────────────────────────────────────────────────────────────────

// Each render gets a fresh QueryClient, like a new browser session; only the "chain" persists.
function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const mockCampaigns: Campaign[] = [
  {
    id: 100,
    creator: MOCK_PUBLIC_KEY,
    title: "Ocean Cleanup",
    description: "Clean the oceans.",
    created_at: 1_700_000_000,
    status: "active",
    funding_goal: 1000n,
    deadline: 2_000_000_000,
    amount_raised: 100n,
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: 0 as Campaign["category"],
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  },
  {
    id: 101,
    creator: "GANOTHER1234567890123456789012345678901234567890123456",
    title: "Solar Schools",
    description: "Solar panels for schools.",
    created_at: 1_700_000_000,
    status: "active",
    funding_goal: 2000n,
    deadline: 2_000_000_000,
    amount_raised: 200n,
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: 0 as Campaign["category"],
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  },
];

describe("Saved campaigns persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockChainBookmarks.length = 0;

    // Provide mock campaigns so CausesContent renders CauseCards
    (
      jest.requireMock("@/hooks/useInfiniteCampaigns") as {
        useInfiniteCampaigns: () => unknown;
      }
    ).useInfiniteCampaigns = () => ({
      campaigns: mockCampaigns,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      isEmpty: false,
      error: null,
      fetchNextPage: jest.fn(),
      refetch: jest.fn(),
    });
  });

  it("persists saved campaigns across navigation and page reloads", async () => {
    const user = userEvent.setup();

    // ── 1–3. Render /causes, save a campaign, verify it's saved ──
    const view = render(<CausesClient />);
    await user.click(await screen.findByTestId("save-btn-100"));
    expect(screen.getByTestId("save-btn-100")).toHaveTextContent("Saved");
    expect(screen.getByTestId("save-btn-100")).toHaveAttribute("aria-pressed", "true");

    // ── 4–6. Navigate away and back, confirm still saved ──
    view.unmount();
    const view2 = render(<CausesClient />);
    expect(await screen.findByTestId("save-btn-100")).toHaveTextContent("Saved");
    expect(screen.getByTestId("save-btn-100")).toHaveAttribute("aria-pressed", "true");

    // ── 7–8. Simulate page reload, confirm saved state survives ──
    view2.unmount();
    const view3 = render(<CausesClient />);
    expect(await screen.findByTestId("save-btn-100")).toHaveTextContent("Saved");
    expect(screen.getByTestId("save-btn-100")).toHaveAttribute("aria-pressed", "true");

    // ── 9. Unsave the campaign ──
    await user.click(screen.getByTestId("save-btn-100"));
    expect(screen.getByTestId("save-btn-100")).toHaveTextContent("Save");
    expect(screen.getByTestId("save-btn-100")).toHaveAttribute("aria-pressed", "false");

    // ── 10–11. Navigate away and back, confirm it stays unsaved ──
    view3.unmount();
    const view4 = render(<CausesClient />);
    expect(await screen.findByTestId("save-btn-100")).toHaveTextContent("Save");
    expect(screen.getByTestId("save-btn-100")).toHaveAttribute("aria-pressed", "false");

    // ── Page reload, double-check unsaved state ──
    view4.unmount();
    render(<CausesClient />);
    expect(await screen.findByTestId("save-btn-100")).toHaveTextContent("Save");
    expect(screen.getByTestId("save-btn-100")).toHaveAttribute("aria-pressed", "false");
  });
});
