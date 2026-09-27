import { applyMockScenario, createMockSorobanRpcServer } from "@/lib/devMockScenarios";
import type { Campaign } from "@/types";

describe("Mock Soroban RPC Server Implementation (#1594)", () => {
  const baseCampaign: Campaign = {
    id: 1,
    title: "Test Cause",
    description: "Description",
    creator: "G...",
    funding_goal: 1000n,
    amount_raised: 0n,
    deadline: 1800000000,
    created_at: 1700000000,
    status: "active",
    category: "community",
    image_url: "",
  };

  it("applies mock scenario to campaign correctly", () => {
    const active = applyMockScenario(baseCampaign, "active");
    expect(active.is_active).toBe(true);
    expect(active.status).toBe("active");
  });

  it("creates mock Soroban RPC server and queries simulated endpoints offline", async () => {
    const mockRpc = createMockSorobanRpcServer({ sequence: 500000 });

    const ledger = await mockRpc.getLatestLedger();
    expect(ledger.sequence).toBe(500000);

    const health = await mockRpc.getHealth();
    expect(health.status).toBe("healthy");

    const entries = await mockRpc.getLedgerEntries(["key1"]);
    expect(entries.entries.length).toBe(1);
    expect(entries.entries[0]?.key).toBe("key1");

    const sim = await mockRpc.simulateTransaction("valid_tx_xdr");
    expect(sim.status).toBe("SUCCESS");

    const tx = await mockRpc.sendTransaction("valid_tx_xdr");
    expect(tx.status).toBe("PENDING");
  });
});
