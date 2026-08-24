import { render, screen } from "@testing-library/react";
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

jest.mock("@/hooks/useCampaigns", () => ({
  useCampaigns: () => ({
    campaigns: [] as Campaign[],
    isLoading: false,
    error: null,
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

jest.mock("@/lib/contractClient", () => ({
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

    // Provide mock campaigns so CausesContent renders CauseCards
    (jest.requireMock("@/hooks/useCampaigns") as { useCampaigns: () => unknown }).useCampaigns =
      () => ({
        campaigns: mockCampaigns,
        isLoading: false,
        error: null,
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
