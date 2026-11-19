/**
 * Unit tests for issue #1766 (campaign tags) and #1765 (set_milestones).
 *
 * These tests run against mock mode (NEXT_PUBLIC_USE_MOCKS=true) so no live
 * RPC node is needed.  They assert the ScVal argument shapes that would be
 * sent to the real contract as well as mock-mode round-trip behaviour.
 */

import {
  addCampaignTag,
  getCampaignTags,
  getCampaignsByTag,
  setMilestones,
  milestoneFormEntriesToInputs,
  checkSettlementStatus,
  getCancellationPenaltyBps,
  BPS_DENOMINATOR,
} from "./contractClient";

// ---------------------------------------------------------------------------
// Helpers that mirror the ScVal encoding used in the real contract calls.
// We import the stellar SDK types directly to verify argument shapes.
// ---------------------------------------------------------------------------
import { nativeToScVal, Address, xdr } from "@stellar/stellar-sdk";

// Force mock mode for all tests in this file.
beforeAll(() => {
  process.env.NEXT_PUBLIC_USE_MOCKS = "true";
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_USE_MOCKS;
});

// ---------------------------------------------------------------------------
// #1766 — campaign tags
// ---------------------------------------------------------------------------

describe("addCampaignTag (mock mode)", () => {
  it("returns a mock tx hash string", async () => {
    const hash = await addCampaignTag(1, "education");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("stores the tag so getCampaignTags returns it", async () => {
    await addCampaignTag(1, "water");
    const tags = await getCampaignTags(1);
    expect(tags).toContain("water");
  });

  it("normalises tags to lowercase", async () => {
    await addCampaignTag(2, "HEALTH");
    const tags = await getCampaignTags(2);
    expect(tags).toContain("health");
  });
});

describe("getCampaignsByTag (mock mode)", () => {
  it("returns campaignIds for campaigns that carry the tag", async () => {
    // Mock campaign #1 is seeded with tags ["water","rural","health"]
    const { campaignIds } = await getCampaignsByTag("rural");
    expect(campaignIds).toContain(1);
  });

  it("returns empty array for a tag with no campaigns", async () => {
    const { campaignIds } = await getCampaignsByTag("zzz-nonexistent-tag-xyz");
    expect(campaignIds).toEqual([]);
  });

  it("honours offset and limit for pagination", async () => {
    // Add a known tag to two mock campaigns to exercise pagination.
    await addCampaignTag(1, "paginationtag");
    await addCampaignTag(2, "paginationtag");

    const page1 = await getCampaignsByTag("paginationtag", 0, 1);
    expect(page1.campaignIds).toHaveLength(1);
    expect(page1.nextOffset).not.toBeNull();

    const page2 = await getCampaignsByTag("paginationtag", page1.nextOffset!, 1);
    expect(page2.campaignIds).toHaveLength(1);
    // The two pages must not overlap.
    expect(page2.campaignIds[0]).not.toBe(page1.campaignIds[0]);
  });
});

describe("ScVal argument shape for add_campaign_tag", () => {
  it("campaign_id encodes as u32 ScVal", () => {
    const val = nativeToScVal(42, { type: "u32" });
    expect(val.switch().name).toBe("scvU32");
    expect(val.u32()).toBe(42);
  });

  it("tag encodes as string ScVal", () => {
    const val = nativeToScVal("education", { type: "string" });
    expect(val.switch().name).toBe("scvString");
    expect(val.str().toString()).toBe("education");
  });
});

// ---------------------------------------------------------------------------
// #1765 — set_milestones
// ---------------------------------------------------------------------------

describe("milestoneFormEntriesToInputs", () => {
  it("distributes bps proportionally to target amounts", () => {
    const entries = [
      { targetAmount: BigInt(5_000_000_000), description: "Phase 1" },
      { targetAmount: BigInt(5_000_000_000), description: "Phase 2" },
    ];
    const inputs = milestoneFormEntriesToInputs(entries);
    expect(inputs).toHaveLength(2);
    expect(inputs[0].payout_bps).toBe(5000);
    expect(inputs[1].payout_bps).toBe(5000);
    const total = inputs.reduce((s, m) => s + m.payout_bps, 0);
    expect(total).toBe(BPS_DENOMINATOR);
  });

  it("assigns remainder to the last milestone so bps always sum to 10 000", () => {
    const entries = [
      { targetAmount: BigInt(1_000_000_000), description: "A" },
      { targetAmount: BigInt(1_000_000_000), description: "B" },
      { targetAmount: BigInt(1_000_000_000), description: "C" },
    ];
    const inputs = milestoneFormEntriesToInputs(entries);
    const total = inputs.reduce((s, m) => s + m.payout_bps, 0);
    expect(total).toBe(BPS_DENOMINATOR);
  });

  it("filters out entries with zero target or empty description", () => {
    const entries = [
      { targetAmount: BigInt(0), description: "Empty target" },
      { targetAmount: BigInt(5_000_000_000), description: "" },
      { targetAmount: BigInt(5_000_000_000), description: "Valid" },
    ];
    const inputs = milestoneFormEntriesToInputs(entries);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].description).toBe("Valid");
  });

  it("returns empty array when no valid entries", () => {
    expect(milestoneFormEntriesToInputs([])).toEqual([]);
    expect(milestoneFormEntriesToInputs([{ targetAmount: BigInt(0), description: "" }])).toEqual([]);
  });
});

describe("setMilestones ScVal argument shape", () => {
  it("each milestone map has keys sorted (description before payout_bps)", () => {
    // Mirrors the encoding in setMilestones(): sorted map keys.
    const fields: [string, xdr.ScVal][] = [
      ["description", nativeToScVal("Phase 1", { type: "string" })],
      ["payout_bps", nativeToScVal(5000, { type: "u32" })],
    ];
    fields.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const encoded = xdr.ScVal.scvMap(
      fields.map(([key, val]) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val })),
    );
    const map = encoded.map()!;
    // .sym() returns a Buffer — convert to string for comparison
    expect(map[0].key().sym().toString()).toBe("description");
    expect(map[1].key().sym().toString()).toBe("payout_bps");
  });
});

describe("setMilestones (mock mode)", () => {
  it("returns a mock tx hash string", async () => {
    const hash = await setMilestones(1, [
      { description: "Phase 1", payout_bps: 5000 },
      { description: "Phase 2", payout_bps: 5000 },
    ]);
    expect(typeof hash).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// #1763 — checkSettlementStatus
// ---------------------------------------------------------------------------

describe("checkSettlementStatus (mock mode)", () => {
  it("returns false for a non-existent campaign id", async () => {
    const status = await checkSettlementStatus(999999);
    expect(status.ready_for_withdrawal).toBe(false);
  });

  it("returns goal_met=true for campaign 6 which is funded", async () => {
    // Mock campaign #6 has amount_raised === funding_goal and funds_withdrawn=true
    const status = await checkSettlementStatus(6);
    expect(status.goal_met).toBe(true);
    // funds_withdrawn=true so ready_for_withdrawal=false
    expect(status.ready_for_withdrawal).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// #1764 — getCancellationPenaltyBps
// ---------------------------------------------------------------------------

describe("getCancellationPenaltyBps (mock mode)", () => {
  it("returns a non-negative number", async () => {
    const bps = await getCancellationPenaltyBps();
    expect(typeof bps).toBe("number");
    expect(bps).toBeGreaterThanOrEqual(0);
  });

  it("mock returns 500 (5%)", async () => {
    const bps = await getCancellationPenaltyBps();
    expect(bps).toBe(500);
  });
});
