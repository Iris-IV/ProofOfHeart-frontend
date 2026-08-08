import { renderHook, act } from "@testing-library/react";
import { useMultiSigProposals, type MultiSigProposal } from "@/hooks/useMultiSigProposals";

const STORAGE_KEY = "poh_multisig_proposals";
const WALLET = "GAXFNJ4WKLDSRX5LFXQ5JLQ5JLQ5JLQ5JLQ5JLQ5JLQ5JLQ5JLQ5JLQ5";
const OTHER_WALLET = "GB1234567890123456789012345678901234567890123456789012345678901234";

function proposal(overrides: Partial<MultiSigProposal> = {}): MultiSigProposal {
  return {
    id: "1-1000000000",
    campaignId: 1,
    proposedBy: WALLET,
    createdAt: 1_000_000,
    signers: [{ address: WALLET }, { address: OTHER_WALLET }],
    requiredSignatures: 2,
    status: "pending",
    ...overrides,
  };
}

function seed(proposals: MultiSigProposal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
}

describe("useMultiSigProposals", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty state when no proposals exist", () => {
    const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

    expect(result.current.proposals).toEqual([]);
    expect(result.current.activeProposal).toBeNull();
  });

  it("loads proposals from localStorage filtered by campaignId", () => {
    seed([proposal({ id: "1-a" }), proposal({ id: "2-a", campaignId: 2 })]);

    const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

    expect(result.current.proposals).toHaveLength(1);
    expect(result.current.proposals[0].id).toBe("1-a");
  });

  it("re-filters proposals when campaignId changes", () => {
    seed([proposal({ id: "1-a" }), proposal({ id: "2-a", campaignId: 2 })]);

    const { result, rerender } = renderHook(
      ({ cid }: { cid: number }) => useMultiSigProposals(cid, WALLET),
      { initialProps: { cid: 1 } },
    );

    expect(result.current.proposals).toHaveLength(1);
    expect(result.current.proposals[0].id).toBe("1-a");

    rerender({ cid: 2 });

    expect(result.current.proposals).toHaveLength(1);
    expect(result.current.proposals[0].id).toBe("2-a");
  });

  it("handles corrupted localStorage JSON gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "{bad json}");

    const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

    expect(result.current.proposals).toEqual([]);
  });

  describe("createProposal", () => {
    it("creates a new pending proposal and updates state immediately", () => {
      const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

      act(() => {
        result.current.createProposal([WALLET, OTHER_WALLET], 2);
      });

      expect(result.current.proposals).toHaveLength(1);
      expect(result.current.proposals[0].campaignId).toBe(1);
      expect(result.current.proposals[0].proposedBy).toBe(WALLET);
      expect(result.current.proposals[0].requiredSignatures).toBe(2);
      expect(result.current.proposals[0].status).toBe("pending");
      expect(result.current.activeProposal).not.toBeNull();
    });

    it("does nothing when walletAddress is null", () => {
      const { result } = renderHook(() => useMultiSigProposals(1, null));

      act(() => {
        result.current.createProposal([WALLET], 2);
      });

      expect(result.current.proposals).toHaveLength(0);
    });

    it("does nothing when a pending or ready proposal already exists", () => {
      seed([proposal({ id: "existing" })]);

      const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

      act(() => {
        result.current.createProposal([WALLET, OTHER_WALLET], 2);
      });

      expect(result.current.proposals).toHaveLength(1);
      expect(result.current.proposals[0].id).toBe("existing");
    });

    it("persists the new proposal to localStorage", () => {
      const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

      act(() => {
        result.current.createProposal([WALLET], 1);
      });

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const stored = JSON.parse(raw!) as MultiSigProposal[];
      expect(stored).toHaveLength(1);
      expect(stored[0].campaignId).toBe(1);
    });
  });

  describe("signProposal", () => {
    it("marks the caller's signer entry as signed", () => {
      seed([proposal({ id: "p1" })]);

      const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

      act(() => {
        result.current.signProposal("p1");
      });

      expect(result.current.proposals[0].signers[0].signedAt).toEqual(expect.any(Number));
    });

    it("transitions status to ready when required signatures are met", () => {
      seed([proposal({ id: "p1", requiredSignatures: 1, signers: [{ address: WALLET }] })]);

      const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

      act(() => {
        result.current.signProposal("p1");
      });

      expect(result.current.proposals[0].status).toBe("ready");
    });

    it("does nothing when walletAddress is null", () => {
      seed([proposal({ id: "p1" })]);

      const { result } = renderHook(() => useMultiSigProposals(1, null));

      act(() => {
        result.current.signProposal("p1");
      });

      expect(result.current.proposals[0].signers[0].signedAt).toBeUndefined();
    });
  });

  describe("cancelProposal", () => {
    it("marks the proposal as cancelled", () => {
      seed([proposal({ id: "p1" })]);

      const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

      act(() => {
        result.current.cancelProposal("p1");
      });

      expect(result.current.proposals[0].status).toBe("cancelled");
    });
  });

  describe("markExecuted", () => {
    it("marks the proposal as executed with a txHash", () => {
      seed([proposal({ id: "p1" })]);

      const { result } = renderHook(() => useMultiSigProposals(1, WALLET));

      act(() => {
        result.current.markExecuted("p1", "0xdeadbeef");
      });

      expect(result.current.proposals[0].status).toBe("executed");
      expect(result.current.proposals[0].txHash).toBe("0xdeadbeef");
    });
  });
});
