import { act, renderHook } from "@testing-library/react";
import { useCampaignContributionEvents } from "@/hooks/useCampaignContributionEvents";
import { useWindowVisibility } from "@/hooks/useWindowVisibility";
import {
  decodeContractEvent,
  subscribeContributionMadeEvents,
  type FetchVoteCastEventsResult,
} from "@/lib/sorobanEvents";

const mockQueryClient = {};
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => mockQueryClient }));
jest.mock("@/components/WalletContext", () => ({ useWallet: () => ({ publicKey: null }) }));
jest.mock("@/lib/cacheInvalidation", () => ({ invalidateQueriesForEvents: jest.fn() }));
jest.mock("@/hooks/useWindowVisibility", () => ({ useWindowVisibility: jest.fn() }));
jest.mock("@/lib/sorobanEvents", () => {
  // This suite exercises the real-stream branch without a network connection.
  process.env.NEXT_PUBLIC_USE_MOCKS = "false";
  return {
    decodeContractEvent: jest.fn(),
    subscribeContributionMadeEvents: jest.fn(),
    sumContributionAmounts: (events: Array<{ amount: bigint }>) =>
      events.reduce((sum, event) => sum + event.amount, 0n),
  };
});

const subscribe = jest.mocked(subscribeContributionMadeEvents);
const decode = jest.mocked(decodeContractEvent);
const visibility = jest.mocked(useWindowVisibility);
const visible = { isVisible: true, state: "visible" as const, pollInterval: 5000, maxBackoff: 30000 };
const rawEvent = (id: string) => ({
  id, amount: 10000000n, ledgerClosedAt: "2026-10-18T12:00:00Z",
}) as unknown as FetchVoteCastEventsResult["events"][number];
const batch = (events: FetchVoteCastEventsResult["events"]): FetchVoteCastEventsResult => ({
  events, cursor: "cursor", latestLedger: 10,
});

beforeEach(() => {
  jest.clearAllMocks();
  visibility.mockReturnValue(visible);
  subscribe.mockImplementation(() => ({ unsubscribe: jest.fn() }));
  decode.mockImplementation(() => ({
    type: "contribution_made", campaignId: 7, contributor: "GTEST", amount: 10000000n,
  }));
});

it("deduplicates both within a batch and across replays", () => {
  const onContributions = jest.fn();
  const { result } = renderHook(() => useCampaignContributionEvents({ campaignId: 7, onContributions }));
  const options = subscribe.mock.calls[0][0];
  act(() => options.onEvents(batch([rawEvent("1"), rawEvent("1")])));
  act(() => options.onEvents(batch([rawEvent("1")])));
  expect(onContributions).toHaveBeenCalledTimes(1);
  expect(onContributions).toHaveBeenCalledWith(10000000n, 1);
  expect(result.current.events).toHaveLength(1);
  expect(result.current.status).toBe("live");
});

it("recovers from an error on a successful empty poll while retaining donations", () => {
  const { result } = renderHook(() => useCampaignContributionEvents({ campaignId: 7 }));
  const options = subscribe.mock.calls[0][0];
  act(() => options.onEvents(batch([rawEvent("1")])));
  act(() => options.onError?.(new Error("offline")));
  expect(result.current.status).toBe("reconnecting");
  expect(result.current.events).toHaveLength(1);
  act(() => options.onEvents(batch([])));
  expect(result.current.status).toBe("live");
});

it("unsubscribes when hidden and ignores callbacks from the old subscription", () => {
  const onContributions = jest.fn();
  const { result, rerender } = renderHook(() => useCampaignContributionEvents({ campaignId: 7, onContributions }));
  const oldOptions = subscribe.mock.calls[0][0];
  const subscription = subscribe.mock.results[0].value;
  visibility.mockReturnValue({ ...visible, isVisible: false, state: "hidden" });
  rerender();
  expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe("paused");
  act(() => oldOptions.onEvents(batch([rawEvent("1")])));
  expect(onContributions).not.toHaveBeenCalled();
  visibility.mockReturnValue(visible);
  rerender();
  expect(subscribe).toHaveBeenCalledTimes(2);
});

it("clears another campaign's feed and deduplication state on navigation", () => {
  const { result, rerender } = renderHook(({ campaignId }) => useCampaignContributionEvents({ campaignId }), { initialProps: { campaignId: 7 } });
  act(() => subscribe.mock.calls[0][0].onEvents(batch([rawEvent("1")])));
  expect(result.current.events).toHaveLength(1);
  rerender({ campaignId: 8 });
  expect(result.current.events).toEqual([]);
});

it("reports unavailable streaming when the subscription cannot start", () => {
  subscribe.mockReturnValue(null);
  const { result } = renderHook(() => useCampaignContributionEvents({ campaignId: 7 }));
  expect(result.current.status).toBe("unavailable");
});

it("ignores malformed display payloads without breaking the stream", () => {
  decode.mockImplementationOnce(() => { throw new Error("malformed"); });
  const { result } = renderHook(() => useCampaignContributionEvents({ campaignId: 7 }));
  act(() => subscribe.mock.calls[0][0].onEvents(batch([rawEvent("1"), rawEvent("2")])));
  expect(result.current.events.map((event) => event.id)).toEqual(["2"]);
  expect(result.current.status).toBe("live");
});
