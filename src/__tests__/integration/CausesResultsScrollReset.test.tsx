import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CausesClient from "@/app/[locale]/causes/CausesClient";
import { Category, type Campaign } from "@/types";

const mockReplace = jest.fn();
const mockUseSearchParams = jest.fn();
const mockRouter = { replace: mockReplace };
const mockCampaigns = [
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
];

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("@/i18n/routing", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/hooks/useInfiniteCampaigns", () => ({
  useInfiniteCampaigns: () => ({
    campaigns: mockCampaigns,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    error: null,
    fetchNextPage: jest.fn(),
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

describe("Causes results scroll reset (issue #1107)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not scroll on initial render", async () => {
    await act(async () => {
      render(<CausesClient />);
    });

    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls the results back to the top when the search query changes", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await act(async () => {
      render(<CausesClient />);
    });

    await user.type(screen.getByPlaceholderText("searchPlaceholder"), "science");

    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("scrolls the results back to the top when the status filter changes", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await act(async () => {
      render(<CausesClient />);
    });

    const [statusSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(statusSelect, "active");

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });
});
