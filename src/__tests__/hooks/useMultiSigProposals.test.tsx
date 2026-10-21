import { act, renderHook } from "@testing-library/react";
import { toMultiSigProposal, useMultiSigProposals } from "@/hooks/useMultiSigProposals";
import { MultiSigAggregator, type MultiSigAggregatorState } from "@/lib/multiSigAggregator";

function session(overrides: Partial<MultiSigAggregatorState> = {}): MultiSigAggregatorState {
  return {
    campaignId: 1,
    requiredSignatures: 3,
    collectedSignatures: [],
    isComplete: false,
    ...overrides,
  };
}

const sig = (signer: string, timestamp: number) => ({ signer, signatureXdr: "eA==", timestamp });

describe("toMultiSigProposal", () => {
  it("marks a session with no signatures as awaiting", () => {
    expect(toMultiSigProposal(session())).toMatchObject({
      status: "awaiting",
      signedCount: 0,
      remaining: 3,
      progressPct: 0,
      lastSignedAt: null,
    });
  });

  it("marks a partially signed session as collecting with rounded progress", () => {
    const proposal = toMultiSigProposal(
      session({ collectedSignatures: [sig("GA", 100), sig("GB", 300)] }),
    );
    expect(proposal).toMatchObject({
      status: "collecting",
      signedCount: 2,
      remaining: 1,
      progressPct: 67,
      lastSignedAt: 300,
    });
  });

  it("marks a complete session as ready at 100%", () => {
    expect(
      toMultiSigProposal(
        session({ requiredSignatures: 1, collectedSignatures: [sig("GA", 1)], isComplete: true }),
      ),
    ).toMatchObject({ status: "ready", remaining: 0, progressPct: 100 });
  });

  it("does not report 100% for a session the aggregator has not completed", () => {
    expect(toMultiSigProposal(session({ requiredSignatures: 0 }))).toMatchObject({
      status: "awaiting",
      progressPct: 0,
      remaining: 0,
    });
  });
});

describe("useMultiSigProposals", () => {
  it("returns an empty list for an empty aggregator", () => {
    const { result } = renderHook(() => useMultiSigProposals(new MultiSigAggregator()));
    expect(result.current).toEqual({ proposals: [], pendingCount: 0, readyCount: 0 });
  });

  it("re-renders on aggregator changes and sorts ready, collecting, awaiting", () => {
    const aggregator = new MultiSigAggregator();
    const { result } = renderHook(() => useMultiSigProposals(aggregator));

    act(() => {
      aggregator.initiateCampaignCancellation(5, 2);
      aggregator.initiateCampaignCancellation(3, 2);
      aggregator.initiateCampaignCancellation(9, 1);
      aggregator.addSignature(3, "GA", "eA==");
      aggregator.addSignature(9, "GB", "eA==");
    });

    expect(result.current.proposals.map((p) => [p.campaignId, p.status])).toEqual([
      [9, "ready"],
      [3, "collecting"],
      [5, "awaiting"],
    ]);
    expect(result.current.readyCount).toBe(1);
    expect(result.current.pendingCount).toBe(2);

    act(() => aggregator.clearSession(9));
    expect(result.current.proposals.map((p) => p.campaignId)).toEqual([3, 5]);
    expect(result.current.readyCount).toBe(0);
  });

  it("keeps the same result object when nothing changed", () => {
    const aggregator = new MultiSigAggregator();
    const { result, rerender } = renderHook(() => useMultiSigProposals(aggregator));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("unsubscribes on unmount", () => {
    const aggregator = new MultiSigAggregator();
    const unsubscribe = jest.fn();
    jest.spyOn(aggregator, "subscribe").mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useMultiSigProposals(aggregator));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
