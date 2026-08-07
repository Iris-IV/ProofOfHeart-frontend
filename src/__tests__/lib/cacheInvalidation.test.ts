jest.mock("@stellar/stellar-sdk", () => {
  const nativeToScVal = (value: unknown, opts: { type: string }) => ({
    __native: value,
    toXDR: () => Buffer.from(`${opts.type}:${String(value)}`),
  });

  return {
    nativeToScVal,
    scValToNative: (value: { __native?: unknown }) => value?.__native,
    rpc: { Server: jest.fn() },
  };
});

import type { QueryClient } from "@tanstack/react-query";
import { invalidateQueriesForEvent, invalidateQueriesForEvents } from "@/lib/cacheInvalidation";

function makeEvent(topicName: string, campaignId: number, contributor?: string) {
  const topic: unknown[] = [{ __native: topicName }, { __native: campaignId }];
  if (contributor !== undefined) {
    topic.push({ __native: contributor });
  }
  return { topic } as Parameters<typeof invalidateQueriesForEvent>[1];
}

describe("cacheInvalidation", () => {
  let queryClient: jest.Mocked<QueryClient>;

  beforeEach(() => {
    queryClient = {
      invalidateQueries: jest.fn(),
    } as unknown as jest.Mocked<QueryClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("invalidateQueriesForEvent", () => {
    it("invalidates campaign + contribution + revenue keys on contribution_made when wallet matches", () => {
      const event = makeEvent("contribution_made", 5, "GABCD");
      invalidateQueriesForEvent(queryClient, event, "GABCD");

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 5],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaignUpdates", 5],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaignComments", 5],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["contributions", "GABCD"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["revenueSharing", 5, "GABCD"],
      });
    });

    it("skips contribution invalidation on contribution_made when wallet does not match", () => {
      const event = makeEvent("contribution_made", 5, "GOTHER");
      invalidateQueriesForEvent(queryClient, event, "GABCD");

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 5],
      });
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: ["contributions", "GOTHER"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["revenueSharing", 5, "GABCD"],
      });
    });

    it("skips user-scoped invalidation on contribution_made when currentWalletAddress is null", () => {
      const event = makeEvent("contribution_made", 5, "GOTHER");
      invalidateQueriesForEvent(queryClient, event, null);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 5],
      });
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(["contributions"]),
        }),
      );
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(["revenueSharing"]),
        }),
      );
    });

    it("invalidates campaign + contributions + revenue on withdraw_funds", () => {
      const event = makeEvent("withdraw_funds", 10);
      invalidateQueriesForEvent(queryClient, event, "GABCD");

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 10],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["contributions", "GABCD"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["revenueSharing", 10, "GABCD"],
      });
    });

    it("invalidates campaign + campaigns list on cancel_campaign", () => {
      const event = makeEvent("cancel_campaign", 3);
      invalidateQueriesForEvent(queryClient, event, null);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 3],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaigns"],
      });
    });

    it("invalidates campaign only on claim_refund when contributor does not match", () => {
      const event = makeEvent("claim_refund", 5, "GOTHER");
      invalidateQueriesForEvent(queryClient, event, "GABCD");

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 5],
      });
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: ["contributions", "GOTHER"],
      });
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: ["contributions", "GABCD"],
      });
    });

    it("invalidates campaign + contributions on claim_refund when contributor matches", () => {
      const event = makeEvent("claim_refund", 5, "GABCD");
      invalidateQueriesForEvent(queryClient, event, "GABCD");

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 5],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["contributions", "GABCD"],
      });
    });

    it("invalidates campaign + campaigns list on vote_on_campaign", () => {
      const event = makeEvent("vote_on_campaign", 7);
      invalidateQueriesForEvent(queryClient, event, null);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 7],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaigns"],
      });
    });

    it("invalidates campaign + active revenueSharing on deposit_revenue", () => {
      const event = makeEvent("deposit_revenue", 12);
      invalidateQueriesForEvent(queryClient, event, null);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 12],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["revenueSharing", 12],
          type: "active",
        }),
      );
    });

    it("invalidates campaign + campaigns list + admin on verify_campaign", () => {
      const event = makeEvent("verify_campaign", 7);
      invalidateQueriesForEvent(queryClient, event, null);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 7],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaigns"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["admin"],
      });
    });

    it("does not invalidate any query for an unknown event topic", () => {
      const event = makeEvent("some_random_topic", 5);
      invalidateQueriesForEvent(queryClient, event, null);

      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    });

    it("does nothing when topic is too short to extract a campaign id", () => {
      const event = { topic: [{ __native: "contribution_made" }] } as unknown as Parameters<
        typeof invalidateQueriesForEvent
      >[1];
      invalidateQueriesForEvent(queryClient, event, null);

      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    });

    it("does not invalidate contributions when contributor address cannot be extracted", () => {
      const event = {
        topic: [{ __native: "contribution_made" }, { __native: 7 }],
      } as unknown as Parameters<typeof invalidateQueriesForEvent>[1];
      invalidateQueriesForEvent(queryClient, event, "GABCD");

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 7],
      });
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(["revenueSharing"]),
        }),
      );
    });
  });

  describe("invalidateQueriesForEvents", () => {
    it("processes each event and deduplicates by campaign id", () => {
      const e1 = makeEvent("contribution_made", 7, "GABCD");
      const e2 = makeEvent("contribution_made", 7, "GOTHER");
      const e3 = makeEvent("withdraw_funds", 8);

      invalidateQueriesForEvents(queryClient, [e1, e2, e3], "GABCD");

      const campaign7Calls = queryClient.invalidateQueries.mock.calls.filter(
        ([arg]) =>
          (arg as { queryKey: unknown[] }).queryKey?.[0] === "campaign" &&
          (arg as { queryKey: unknown[] }).queryKey?.[1] === 7,
      );
      expect(campaign7Calls).toHaveLength(1);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 8],
      });
    });

    it("silently skips events that have no campaign id", () => {
      const valid = makeEvent("contribution_made", 7, "GABCD");
      const invalid = { topic: [] } as unknown as Parameters<typeof invalidateQueriesForEvent>[1];

      invalidateQueriesForEvents(queryClient, [valid, invalid], "GABCD");

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["campaign", 7],
      });
    });
  });
});
