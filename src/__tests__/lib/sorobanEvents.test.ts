jest.mock('@stellar/stellar-sdk', () => {
  const nativeToScVal = (value: unknown, opts: { type: string }) => ({
    __native: value,
    toXDR: () => Buffer.from(`${opts.type}:${String(value)}`),
  });

  return {
    nativeToScVal,
    scValToNative: (value: { __native?: unknown }) => value.__native,
    rpc: { Server: jest.fn() },
  };
});

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  scValToTopicSegment,
  voteCastTopicFilter,
  isContributionMadeEvent,
  parseContributionAmount,
  sumContributionAmounts,
} from '@/lib/sorobanEvents';

describe('sorobanEvents vote cast', () => {
  it('builds campaign_vote_cast topic filter segments', () => {
    const topics = voteCastTopicFilter(7);
    expect(topics[0][2]).toBe('*');

    const symbol = StellarSdk.nativeToScVal('campaign_vote_cast', { type: 'symbol' });
    const campaign = StellarSdk.nativeToScVal(7, { type: 'u32' });
    expect(topics[0][0]).toBe(scValToTopicSegment(symbol as never));
    expect(topics[0][1]).toBe(scValToTopicSegment(campaign as never));
  });

  it("identifies contribution_made events for the matching campaign", () => {
    const event = {
      id: "evt-1",
      topic: [
        StellarSdk.nativeToScVal("contribution_made", { type: "symbol" }),
        StellarSdk.nativeToScVal(7, { type: "u32" }),
        StellarSdk.nativeToScVal("GABC", { type: "address" }),
      ],
      value: { __bigint: BigInt(1_000_000) },
    } as unknown as Parameters<typeof isContributionMadeEvent>[0];

    expect(isContributionMadeEvent(event, 7)).toBe(true);
    expect(isContributionMadeEvent(event, 8)).toBe(false);
  });

  it("parses contribution amounts and sums events", () => {
    const event = {
      value: { __bigint: BigInt(2_500_000) },
    } as unknown as Parameters<typeof parseContributionAmount>[0];

    expect(parseContributionAmount(event)).toBe(BigInt(2_500_000));
    expect(sumContributionAmounts([event, event])).toBe(BigInt(5_000_000));
  });
});
