import type { DonationRecord } from "@/lib/badges";

/** The parts of a contribution history item that badge rules need. */
export interface ContributionBadgeInput {
  campaign: { id: number };
  /** Total contributed to this campaign, in stroops. */
  contribution: bigint;
  transactions: { action: string; timestamp: number }[];
}

/**
 * Reduces contribution history to one DonationRecord per campaign.
 *
 * The wallet log stores no per-transaction amounts, so each campaign's total is
 * the only amount available. The record is dated by the earliest contribution
 * (log timestamps are milliseconds; DonationRecord uses seconds). Campaigns with
 * nothing contributed are skipped. `backerRank` is not known from this source,
 * so early-backer badges are not awarded from it.
 */
export function toDonationRecords(items: ContributionBadgeInput[]): DonationRecord[] {
  const records: DonationRecord[] = [];

  for (const item of items) {
    if (item.contribution <= BigInt(0)) continue;

    const contributeTimes = item.transactions
      .filter((tx) => tx.action === "contribute")
      .map((tx) => tx.timestamp);
    if (contributeTimes.length === 0) continue;

    records.push({
      campaignId: item.campaign.id,
      amount: item.contribution,
      timestamp: Math.floor(Math.min(...contributeTimes) / 1000),
    });
  }

  return records;
}
