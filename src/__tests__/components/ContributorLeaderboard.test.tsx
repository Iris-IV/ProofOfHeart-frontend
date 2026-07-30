import { render, screen, fireEvent } from "@testing-library/react";
import ContributorLeaderboard from "@/components/ContributorLeaderboard";

const mockUseTopContributors = jest.fn();

jest.mock("@/hooks/useTopContributors", () => ({
  useTopContributors: (campaignId: number, wallet: string | null, limit: number) =>
    mockUseTopContributors(campaignId, wallet, limit),
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
}));

const WALLET_1 = "GDA7X7P5H4F3R8E2M1N6K9W4L5V8Q3Z0A1B2C3D4E5F6G7H8I9J0K1L2";
const WALLET_2 = "GBX8Y8Q6I5G4S9F3N2O7L0X5M6W9R4A1B2C3D4E5F6G7H8I9J0K1L2M3";

describe("ContributorLeaderboard component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("renders loading placeholders when isLoading is true", () => {
    mockUseTopContributors.mockReturnValue({
      contributors: [],
      isLoading: true,
      refetch: jest.fn(),
    });

    render(<ContributorLeaderboard campaignId={1} userWalletAddress={null} />);

    expect(screen.getByRole("heading", { name: "Top Supporters" })).toBeInTheDocument();
  });

  it("renders empty state when no contributors are returned", () => {
    mockUseTopContributors.mockReturnValue({
      contributors: [],
      isLoading: false,
      refetch: jest.fn(),
    });

    render(<ContributorLeaderboard campaignId={1} userWalletAddress={null} />);

    expect(screen.getByText("Be the first supporter for this cause! 💜")).toBeInTheDocument();
  });

  it("renders list of top supporters with rank, formatted amounts, and truncated addresses", () => {
    mockUseTopContributors.mockReturnValue({
      contributors: [
        {
          walletAddress: WALLET_1,
          truncatedAddress: "GDA7X7...K1L2",
          totalAmountStroops: BigInt(250_000_000_000),
          isAnonymous: false,
          rank: 1,
        },
        {
          walletAddress: WALLET_2,
          truncatedAddress: "GBX8Y8...1L2M3",
          totalAmountStroops: BigInt(180_000_000_000),
          isAnonymous: false,
          rank: 2,
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });

    render(<ContributorLeaderboard campaignId={1} userWalletAddress={null} />);

    expect(screen.getByText("GDA7X7...K1L2")).toBeInTheDocument();
    expect(screen.getByText("GBX8Y8...1L2M3")).toBeInTheDocument();
    expect(screen.getByText("25,000")).toBeInTheDocument();
    expect(screen.getByText("18,000")).toBeInTheDocument();
    expect(screen.getByText("🥇")).toBeInTheDocument();
    expect(screen.getByText("🥈")).toBeInTheDocument();
  });

  it("renders Anonymous Supporter when a contributor is marked anonymous", () => {
    mockUseTopContributors.mockReturnValue({
      contributors: [
        {
          walletAddress: WALLET_1,
          truncatedAddress: "Anonymous Supporter",
          totalAmountStroops: BigInt(50_000_000_000),
          isAnonymous: true,
          rank: 1,
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });

    render(<ContributorLeaderboard campaignId={1} userWalletAddress={null} />);

    expect(screen.getByText("Anonymous Supporter")).toBeInTheDocument();
  });

  it("toggles wallet anonymity opt-out setting when opt out button is clicked", () => {
    const mockRefetch = jest.fn();
    mockUseTopContributors.mockReturnValue({
      contributors: [],
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<ContributorLeaderboard campaignId={1} userWalletAddress={WALLET_1} />);

    const optOutButton = screen.getByRole("button", { name: "Enable anonymous mode" });
    expect(optOutButton).toBeInTheDocument();

    fireEvent.click(optOutButton);
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("button", { name: "Disable anonymous mode" })).toBeInTheDocument();
  });
});
