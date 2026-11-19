/**
 * Unit tests for issue #1932 — purgeVotingState cursor support and cache invalidation.
 *
 * Run in mock mode (NEXT_PUBLIC_USE_MOCKS=true) so no live RPC node is needed.
 */

import { purgeVotingState } from "./contractClient.governance";
import * as client from "./contractClient";

beforeAll(() => {
  process.env.NEXT_PUBLIC_USE_MOCKS = "true";
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_USE_MOCKS;
});

describe("purgeVotingState (mock mode)", () => {
  it("returns a mock tx hash string without a cursor", async () => {
    const result = await purgeVotingState();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a mock tx hash string with a beforeId cursor", async () => {
    const result = await purgeVotingState(42);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts an options object alongside the cursor", async () => {
    const onSuccess = vi.fn();
    const result = await purgeVotingState(100, { onSuccess });
    expect(typeof result).toBe("string");
  });
});

describe("purgeVotingState cache invalidation", () => {
  it("calls clearContractCacheByMethod for get_voting_state and get_vote after a live call", async () => {
    // Temporarily disable mock mode to test the live path.
    delete process.env.NEXT_PUBLIC_USE_MOCKS;

    const spy = vi.spyOn(client, "clearContractCacheByMethod").mockReturnValue(undefined);
    // Stub buildAndSubmitTransaction via the module to avoid a real RPC call.
    const buildSpy = vi
      .spyOn(client, "buildAndSubmitTransaction" as never)
      .mockResolvedValue({ txHash: "FAKE_HASH" } as never);
    // Stub getSignerAddress so no wallet prompt fires.
    vi.mock("./walletSigner", () => ({
      getSignerAddress: async () => "GCTEST000000000000000000000000000000000000000000000000000001",
    }));

    try {
      await purgeVotingState(undefined, {});
    } catch {
      // tolerate any secondary error — we only care that the cache was cleared
    }

    expect(spy).toHaveBeenCalledWith("get_voting_state");
    expect(spy).toHaveBeenCalledWith("get_vote");

    spy.mockRestore();
    buildSpy.mockRestore();
    process.env.NEXT_PUBLIC_USE_MOCKS = "true";
  });
});
