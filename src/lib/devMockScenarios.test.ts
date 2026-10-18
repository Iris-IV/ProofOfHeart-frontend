import {
  applyMockScenario,
  createMockSorobanRpcServer,
  MOCK_SCENARIOS,
} from "@/lib/devMockScenarios";
import type { Campaign } from "@/types";
import { Category } from "@/types";

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
    category: Category.Learner,
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  };

  it("applies mock scenario to campaign correctly", () => {
    const active = applyMockScenario(baseCampaign, "active");
    expect(active.is_active).toBe(true);
    expect(active.status).toBe("active");
  });

  it("applies paused scenario for contract pause state (#1619, #1632)", () => {
    const paused = applyMockScenario(baseCampaign, "paused");
    expect(paused.is_active).toBe(false);
    expect(paused.is_cancelled).toBe(false);
    expect(paused.amount_raised).toBe(baseCampaign.funding_goal / 2n);
  });

  it("applies goal_completed scenario when funding exceeds goal (#1619, #1632)", () => {
    const goalCompleted = applyMockScenario(baseCampaign, "goal_completed");
    expect(goalCompleted.amount_raised).toBe(baseCampaign.funding_goal * 2n);
    expect(goalCompleted.status).toBe("active");
  });

  it("applies near_deadline scenario for urgent campaigns (#1619, #1632)", () => {
    const nearDeadline = applyMockScenario(baseCampaign, "near_deadline");
    const now = 1700000000;
    const expectedDeadline = now + 86400 - 3600; // 23 hours from now
    expect(nearDeadline.deadline).toBe(expectedDeadline);
    expect(nearDeadline.amount_raised).toBe((baseCampaign.funding_goal * 95n) / 100n);
  });

  it("applies empty_state scenario for new campaigns with no contributions (#1619, #1632)", () => {
    const emptyState = applyMockScenario(baseCampaign, "empty_state");
    expect(emptyState.amount_raised).toBe(0n);
    expect(emptyState.is_active).toBe(true);
    expect(emptyState.is_verified).toBe(false);
  });

  it("includes all new mock scenarios in MOCK_SCENARIOS list (#1619, #1632)", () => {
    const scenarioValues = MOCK_SCENARIOS.map((s) => s.value);
    expect(scenarioValues).toContain("paused");
    expect(scenarioValues).toContain("goal_completed");
    expect(scenarioValues).toContain("near_deadline");
    expect(scenarioValues).toContain("empty_state");
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
