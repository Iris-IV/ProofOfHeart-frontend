import { renderHook, act } from "@testing-library/react";
import { useLiveVoteTallies } from "@/hooks/useLiveVoteTallies";

const mockUseCampaignVoteEvents = jest.fn();

jest.mock("@/hooks/useCampaignVoteEvents", () => ({
  useCampaignVoteEvents: (options: unknown) => mockUseCampaignVoteEvents(options),
}));

jest.mock("@/lib/contractClient", () => ({
  getApproveVotes: jest.fn(() => Promise.resolve(4)),
  getRejectVotes: jest.fn(() => Promise.resolve(2)),
}));

describe("useLiveVoteTallies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCampaignVoteEvents.mockImplementation(({ onVoteCast }) => {
      (globalThis as { __castVote?: (approve: boolean) => void }).__castVote = (approve: boolean) =>
        onVoteCast?.({ approve });
      return { streamingAvailable: true };
    });
  });

  it("increments tallies when vote cast events arrive", async () => {
    const { result } = renderHook(() => useLiveVoteTallies({ campaignId: 1 }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.voteCounts).toEqual({ upvotes: 4, downvotes: 2, totalVotes: 6 });

    act(() => {
      (globalThis as { __castVote?: (approve: boolean) => void }).__castVote?.(true);
    });
    expect(result.current.voteCounts).toEqual({ upvotes: 5, downvotes: 2, totalVotes: 7 });
  });

  it("applies optimistic local vote increments", async () => {
    const { result } = renderHook(() => useLiveVoteTallies({ campaignId: 1 }));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.applyOptimisticVote("downvote");
    });
    expect(result.current.voteCounts.totalVotes).toBe(7);
    expect(result.current.voteCounts.downvotes).toBe(3);
  });
});
