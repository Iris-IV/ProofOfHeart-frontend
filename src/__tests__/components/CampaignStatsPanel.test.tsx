import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CampaignStatsPanel from "@/components/CampaignStatsPanel";
import { getCampaignStats } from "@/lib/contractClient";

jest.mock("@/lib/contractClient", () => ({ getCampaignStats: jest.fn() }));
const mockGetStats = getCampaignStats as jest.MockedFunction<typeof getCampaignStats>;

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CampaignStatsPanel campaignId={3} />
    </QueryClientProvider>,
  );
}

describe("CampaignStatsPanel", () => {
  afterEach(() => jest.clearAllMocks());

  it("shows a loading state, then the contract stats", async () => {
    mockGetStats.mockResolvedValue({
      contributorCount: 4,
      topContributor: "GTOPCONTRIBUTOR111111111111111111111111111111111111111111",
      avgContribution: 25_000_000n,
      lastContributionTime: 1_800_000_000,
    });
    renderPanel();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("GTOPCO...1111")).toBeInTheDocument();
    expect(mockGetStats).toHaveBeenCalledWith(3);
  });

  it("shows an error state with retry", async () => {
    mockGetStats.mockRejectedValue(new Error("boom"));
    renderPanel();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
  });
});
