/**
 * Cursor pagination for the campaign list (issue #593).
 *
 * Uses the mock data path (`NEXT_PUBLIC_USE_MOCKS=true`), which the app
 * itself uses for local development — no Soroban SDK mocking needed to
 * exercise the pagination contract.
 */
async function loadMockClient() {
  jest.resetModules();
  process.env.NEXT_PUBLIC_USE_MOCKS = "true";
  return import("../../lib/contractClient");
}

describe("listCampaigns", () => {
  it("returns a full first page with a cursor to the next one", async () => {
    const { listCampaigns } = await loadMockClient();

    const page = await listCampaigns({ cursor: 1, limit: 12 });

    expect(page.campaigns).toHaveLength(12);
    expect(page.campaigns[0].id).toBe(1);
    expect(page.campaigns[11].id).toBe(12);
    expect(page.nextCursor).toBe(13);
  });

  it("walks every campaign exactly once across consecutive pages", async () => {
    const { listCampaigns, getCampaignCount } = await loadMockClient();
    const total = await getCampaignCount();

    const seen: number[] = [];
    let cursor: number | undefined = 1;
    let guard = 0;

    while (cursor !== undefined && guard < 1000) {
      const page = await listCampaigns({ cursor, limit: 25 });
      seen.push(...page.campaigns.map((c) => c.id));
      cursor = page.nextCursor ?? undefined;
      guard++;
    }

    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });

  it("returns nextCursor: null on the last page", async () => {
    const { listCampaigns, getCampaignCount } = await loadMockClient();
    const total = await getCampaignCount();

    const page = await listCampaigns({ cursor: total, limit: 25 });

    expect(page.campaigns).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("has 100+ mock campaigns so pagination/virtualization is exercised in dev mode", async () => {
    const { getCampaignCount } = await loadMockClient();
    expect(await getCampaignCount()).toBeGreaterThan(100);
  });

  it("defaults to a 12-item page when no limit is given", async () => {
    const { listCampaigns } = await loadMockClient();
    const page = await listCampaigns();
    expect(page.campaigns).toHaveLength(12);
  });
});
