import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CausesClient from "@/app/[locale]/causes/CausesClient";
import { Category, type Campaign } from "@/types";

const mockReplace = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("@/i18n/routing", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/hooks/useCampaigns", () => ({
  useCampaigns: () => ({
    campaigns: [
      {
        id: 1,
        creator: "GTEST",
        title: "Education Fund",
        description: "Support education",
        created_at: 1_700_000_000,
        status: "active",
        funding_goal: 1000n,
        deadline: 1_800_000_000,
        amount_raised: 100n,
        is_active: true,
        funds_withdrawn: false,
        is_cancelled: false,
        is_verified: false,
        category: Category.Learner,
        has_revenue_sharing: false,
        revenue_share_percentage: 0,
      } satisfies Campaign,
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => ({ publicKey: null }),
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
}));

jest.mock("@/components/CauseCard", () => ({
  __esModule: true,
  default: ({ campaign }: { campaign: Campaign }) => <div>{campaign.title}</div>,
}));

describe("Causes filters URL sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("syncs category, status, sort and search to URL", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CausesClient />);

    const [categorySelect, statusSelect, sortSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(categorySelect, "0");
    await user.selectOptions(statusSelect, "active");
    await user.selectOptions(sortSelect, "oldest");
    await user.type(screen.getByPlaceholderText("searchPlaceholder"), "science");

    jest.advanceTimersByTime(350);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/causes?q=science&category=0&status=active&sort=oldest",
        { scroll: false },
      );
    });
  });

  it("restores filter state from URL params on load", async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("q=astro&category=2&status=funded&sort=most_funded"),
    );

    render(<CausesClient />);
    const [categorySelect, statusSelect, sortSelect] = screen.getAllByRole("combobox");

    expect(await screen.findByDisplayValue("astro")).toBeInTheDocument();
    expect(categorySelect).toHaveValue("2");
    expect(statusSelect).toHaveValue("funded");
    expect(sortSelect).toHaveValue("most_funded");
  });
});
