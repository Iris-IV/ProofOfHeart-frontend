import {
  createMockSorobanRpcServer,
  applyMockScenario,
  MOCK_SCENARIOS,
} from "@/lib/devMockScenarios";
import type { Campaign } from "@/types";

describe("createMockSorobanRpcServer", () => {
  it("returns a mock RPC server with all required methods", () => {
    const server = createMockSorobanRpcServer();
    expect(server).toHaveProperty("getLatestLedger");
    expect(server).toHaveProperty("getHealth");
    expect(server).toHaveProperty("getLedgerEntries");
    expect(server).toHaveProperty("simulateTransaction");
    expect(server).toHaveProperty("sendTransaction");
    expect(server).toHaveProperty("getTransaction");
  });

  it("getLatestLedger returns default sequence when no options provided", async () => {
    const server = createMockSorobanRpcServer();
    const result = await server.getLatestLedger();
    expect(result.sequence).toBe(1234567);
    expect(result.id).toBe("0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("getLatestLedger returns custom sequence when provided", async () => {
    const server = createMockSorobanRpcServer({ sequence: 9999999 });
    const result = await server.getLatestLedger();
    expect(result.sequence).toBe(9999999);
  });

  it("getHealth returns healthy status by default", async () => {
    const server = createMockSorobanRpcServer();
    const result = await server.getHealth();
    expect(result.status).toBe("healthy");
  });

  it("getHealth throws error when unhealthy", async () => {
    const server = createMockSorobanRpcServer({ healthy: false });
    await expect(server.getHealth()).rejects.toThrow("RPC Server Unhealthy");
  });

  it("getLedgerEntries returns mock entries for all provided keys", async () => {
    const server = createMockSorobanRpcServer({ sequence: 1000 });
    const keys = ["key1", "key2", "key3"];
    const result = await server.getLedgerEntries(keys);

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].key).toBe("key1");
    expect(result.entries[0].val).toBe("AAAAAA==");
    expect(result.entries[0].liveUntilLedgerSeq).toBe(1000 + 4096);
  });

  it("simulateTransaction returns SUCCESS for valid transaction", async () => {
    const server = createMockSorobanRpcServer();
    const result = await server.simulateTransaction("valid_tx_xdr");

    expect(result.status).toBe("SUCCESS");
    expect(result.minResourceFee).toBe("100");
    expect(result.results).toHaveLength(1);
    expect(result.results?.[0].retval).toBe("AAAAAA==");
  });

  it("simulateTransaction returns FAILED for transaction containing FAIL", async () => {
    const server = createMockSorobanRpcServer();
    const result = await server.simulateTransaction("FAIL_tx_xdr");

    expect(result.status).toBe("FAILED");
    expect(result.minResourceFee).toBe("100");
    expect(result.results).toBeUndefined();
  });

  it("sendTransaction returns PENDING for valid signed transaction", async () => {
    const server = createMockSorobanRpcServer();
    const result = await server.sendTransaction("signed_valid_tx");

    expect(result.status).toBe("PENDING");
    expect(result.hash).toBe("mock_tx_hash_success");
  });

  it("sendTransaction returns ERROR for transaction containing ERROR", async () => {
    const server = createMockSorobanRpcServer();
    const result = await server.sendTransaction("ERROR_signed_tx");

    expect(result.status).toBe("ERROR");
    expect(result.hash).toBe("mock_tx_hash_error");
  });

  it("getTransaction returns SUCCESS for valid hash", async () => {
    const server = createMockSorobanRpcServer();
    const result = await server.getTransaction("valid_hash");

    expect(result.status).toBe("SUCCESS");
    expect(result.resultXdr).toBe("AAAAAA==");
  });

  it("getTransaction returns NOT_FOUND for hash containing error", async () => {
    const server = createMockSorobanRpcServer();
    const result = await server.getTransaction("error_hash");

    expect(result.status).toBe("NOT_FOUND");
    expect(result.resultXdr).toBeUndefined();
  });
});

describe("applyMockScenario", () => {
  const baseCampaign: Campaign = {
    id: 1,
    creator: "GTEST",
    title: "Test Campaign",
    description: "Test Description",
    funding_goal: BigInt(10000),
    amount_raised: BigInt(5000),
    deadline: 1700000000,
    is_active: true,
    is_verified: false,
    funds_withdrawn: false,
    is_cancelled: false,
    tags: ["test"],
    status: "active",
  };

  it('returns the campaign unchanged for "default" scenario', () => {
    const result = applyMockScenario(baseCampaign, "default");
    expect(result).toEqual(baseCampaign);
  });

  it('applies "active" scenario correctly', () => {
    const result = applyMockScenario(baseCampaign, "active");
    expect(result.is_active).toBe(true);
    expect(result.is_verified).toBe(false);
    expect(result.status).toBe("active");
    expect(result.amount_raised).toBe(baseCampaign.funding_goal / BigInt(2));
  });

  it('applies "verified" scenario correctly', () => {
    const result = applyMockScenario(baseCampaign, "verified");
    expect(result.is_active).toBe(true);
    expect(result.is_verified).toBe(true);
    expect(result.status).toBe("verified");
    expect(result.amount_raised).toBe(baseCampaign.funding_goal / BigInt(3));
  });

  it('applies "funded" scenario correctly', () => {
    const result = applyMockScenario(baseCampaign, "funded");
    expect(result.is_active).toBe(false);
    expect(result.is_verified).toBe(true);
    expect(result.funds_withdrawn).toBe(true);
    expect(result.status).toBe("funded");
    expect(result.amount_raised).toBe(baseCampaign.funding_goal);
  });

  it('applies "cancelled" scenario correctly', () => {
    const result = applyMockScenario(baseCampaign, "cancelled");
    expect(result.is_active).toBe(false);
    expect(result.is_cancelled).toBe(true);
    expect(result.status).toBe("cancelled");
  });

  it('applies "failed" scenario correctly', () => {
    const result = applyMockScenario(baseCampaign, "failed");
    expect(result.is_active).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.amount_raised).toBe(baseCampaign.funding_goal / BigInt(5));
  });

  it('applies "empty" scenario correctly', () => {
    const result = applyMockScenario(baseCampaign, "empty");
    expect(result.title).toBe("");
    expect(result.description).toBe("");
    expect(result.amount_raised).toBe(BigInt(0));
    expect(result.funding_goal).toBe(BigInt(0));
    expect(result.tags).toEqual([]);
  });

  it('applies "paused" scenario correctly', () => {
    const result = applyMockScenario(baseCampaign, "paused");
    expect(result.is_active).toBe(false);
    expect(result.is_verified).toBe(true);
    expect(result.is_cancelled).toBe(false);
  });

  it('applies "goal_completed" scenario with 200% funding', () => {
    const result = applyMockScenario(baseCampaign, "goal_completed");
    expect(result.is_active).toBe(true);
    expect(result.amount_raised).toBe(baseCampaign.funding_goal * BigInt(2));
  });

  it('applies "near_deadline" scenario with 95% funding', () => {
    const result = applyMockScenario(baseCampaign, "near_deadline");
    expect(result.amount_raised).toBe((baseCampaign.funding_goal * BigInt(95)) / BigInt(100));
  });

  it('applies "empty_state" scenario with zero contributions', () => {
    const result = applyMockScenario(baseCampaign, "empty_state");
    expect(result.amount_raised).toBe(BigInt(0));
    expect(result.is_active).toBe(true);
  });

  it('handles "error" scenario by returning campaign unchanged', () => {
    const result = applyMockScenario(baseCampaign, "error");
    expect(result).toEqual(baseCampaign);
  });
});

describe("MOCK_SCENARIOS", () => {
  it("exports an array of all available scenarios", () => {
    expect(MOCK_SCENARIOS).toBeInstanceOf(Array);
    expect(MOCK_SCENARIOS.length).toBeGreaterThan(0);
  });

  it("contains scenario objects with required properties", () => {
    MOCK_SCENARIOS.forEach((scenario) => {
      expect(scenario).toHaveProperty("value");
      expect(scenario).toHaveProperty("label");
      expect(scenario).toHaveProperty("description");
    });
  });

  it("includes default scenario", () => {
    const defaultScenario = MOCK_SCENARIOS.find((s) => s.value === "default");
    expect(defaultScenario).toBeDefined();
    expect(defaultScenario?.label).toBe("Default");
  });

  it("includes all main campaign states", () => {
    const requiredStates = ["active", "verified", "funded", "cancelled", "failed"];
    requiredStates.forEach((state) => {
      const scenario = MOCK_SCENARIOS.find((s) => s.value === state);
      expect(scenario).toBeDefined();
    });
  });
});
