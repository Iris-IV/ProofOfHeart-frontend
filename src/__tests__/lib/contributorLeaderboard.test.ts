import { aggregateCampaignContributors } from "@/lib/contributorLeaderboard";

describe("aggregateCampaignContributors sorting", () => {
  it("sorts descending by total and assigns 1-based ranks", () => {
    const items = aggregateCampaignContributors(99, [
      { walletAddress: "GAAA", campaignId: 99, action: "contribute", amount: BigInt(10) },
      { walletAddress: "GBBB", campaignId: 99, action: "contribute", amount: BigInt(50) },
    ]);

    expect(items.map((i) => [i.walletAddress, i.rank])).toEqual([
      ["GBBB", 1],
      ["GAAA", 2],
    ]);
    expect(aggregateCampaignContributors(99)).toEqual([]);
  });
});
