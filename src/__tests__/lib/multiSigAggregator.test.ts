import type { Transaction } from "@stellar/stellar-sdk";
import { MultiSigAggregator } from "@/lib/multiSigAggregator";

const SIG_A = Buffer.from("sig-a").toString("base64");
const SIG_B = Buffer.from("sig-b").toString("base64");

describe("MultiSigAggregator", () => {
  let aggregator: MultiSigAggregator;

  beforeEach(() => {
    aggregator = new MultiSigAggregator();
  });

  it("starts an empty, incomplete session", () => {
    const state = aggregator.initiateCampaignCancellation(7, 2);
    expect(state).toEqual({
      campaignId: 7,
      requiredSignatures: 2,
      collectedSignatures: [],
      isComplete: false,
    });
    expect(aggregator.getState(7)).toBe(state);
    expect(aggregator.getState(8)).toBeNull();
  });

  it("completes once the threshold is reached", () => {
    aggregator.initiateCampaignCancellation(1, 2);
    expect(aggregator.addSignature(1, "GA", SIG_A).isComplete).toBe(false);
    const done = aggregator.addSignature(1, "GB", SIG_B);
    expect(done.isComplete).toBe(true);
    expect(done.collectedSignatures.map((s) => s.signer)).toEqual(["GA", "GB"]);
  });

  it("rejects unknown sessions and duplicate signers", () => {
    expect(() => aggregator.addSignature(1, "GA", SIG_A)).toThrow(
      "No multi-sig session for campaign 1",
    );
    aggregator.initiateCampaignCancellation(1, 2);
    aggregator.addSignature(1, "GA", SIG_A);
    expect(() => aggregator.addSignature(1, "GA", SIG_A)).toThrow(
      "Signature from GA already collected",
    );
  });

  it("replaces state instead of mutating it", () => {
    const initial = aggregator.initiateCampaignCancellation(1, 2);
    const next = aggregator.addSignature(1, "GA", SIG_A);
    expect(next).not.toBe(initial);
    expect(initial.collectedSignatures).toHaveLength(0);
    expect(aggregator.getState(1)).toBe(next);
  });

  describe("subscriptions", () => {
    it("notifies listeners on every change and keeps the snapshot stable in between", () => {
      const listener = jest.fn();
      const unsubscribe = aggregator.subscribe(listener);
      const empty = aggregator.getSnapshot();
      expect(empty).toEqual([]);
      expect(aggregator.getSnapshot()).toBe(empty);

      aggregator.initiateCampaignCancellation(1, 2);
      aggregator.addSignature(1, "GA", SIG_A);
      aggregator.initiateCampaignCancellation(2, 1);
      expect(listener).toHaveBeenCalledTimes(3);

      const snapshot = aggregator.getSnapshot();
      expect(snapshot.map((s) => s.campaignId)).toEqual([1, 2]);
      expect(aggregator.getSnapshot()).toBe(snapshot);

      aggregator.clearSession(1);
      expect(listener).toHaveBeenCalledTimes(4);
      expect(aggregator.getSnapshot().map((s) => s.campaignId)).toEqual([2]);

      unsubscribe();
      aggregator.clearSession(2);
      expect(listener).toHaveBeenCalledTimes(4);
    });

    it("does not notify when clearing a session that does not exist", () => {
      const listener = jest.fn();
      aggregator.subscribe(listener);
      aggregator.clearSession(99);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  it("lists only pending sessions", () => {
    aggregator.initiateCampaignCancellation(1, 1);
    aggregator.initiateCampaignCancellation(2, 2);
    aggregator.addSignature(1, "GA", SIG_A);
    expect(aggregator.getPendingSessions().map((s) => s.campaignId)).toEqual([2]);
  });

  it("cancels a session with a warning", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    aggregator.initiateCampaignCancellation(1, 1);
    aggregator.cancelSession(1, "creator withdrew");
    expect(warn).toHaveBeenCalledWith(
      "Multi-sig session cancelled for campaign 1: creator withdrew",
    );
    expect(aggregator.getState(1)).toBeNull();
    warn.mockRestore();
  });

  describe("aggregateSignatures", () => {
    const cloned = { cloned: true } as unknown as Transaction;
    const cloneWithSignatures = jest.fn(() => cloned);
    const baseTransaction = { cloneWithSignatures } as unknown as Transaction;

    it("refuses unknown and incomplete sessions", () => {
      expect(() => aggregator.aggregateSignatures(1, baseTransaction)).toThrow(
        "No multi-sig session for campaign 1",
      );
      aggregator.initiateCampaignCancellation(1, 2);
      aggregator.addSignature(1, "GA", SIG_A);
      expect(() => aggregator.aggregateSignatures(1, baseTransaction)).toThrow(
        "Insufficient signatures: 1/2",
      );
    });

    it("clones the transaction with every collected signature", () => {
      aggregator.initiateCampaignCancellation(1, 2);
      aggregator.addSignature(1, "GA", SIG_A);
      aggregator.addSignature(1, "GB", SIG_B);

      const result = aggregator.aggregateSignatures(1, baseTransaction);

      expect(result.transaction).toBe(cloned);
      expect(result.signatures).toHaveLength(2);
      expect(cloneWithSignatures).toHaveBeenCalledWith(Buffer.from("sig-a"), Buffer.from("sig-b"));
    });
  });
});
