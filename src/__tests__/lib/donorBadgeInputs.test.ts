import { toDonationRecords } from "@/lib/donorBadgeInputs";

const XLM = BigInt(10_000_000);

describe("toDonationRecords", () => {
  it("creates one record per contributed campaign, dated by its first contribution", () => {
    const records = toDonationRecords([
      {
        campaign: { id: 7 },
        contribution: BigInt(5) * XLM,
        transactions: [
          { action: "contribute", timestamp: 1_700_000_900_000 },
          { action: "contribute", timestamp: 1_700_000_000_000 },
        ],
      },
    ]);

    expect(records).toEqual([{ campaignId: 7, amount: BigInt(5) * XLM, timestamp: 1_700_000_000 }]);
  });

  it("skips campaigns with nothing contributed", () => {
    expect(
      toDonationRecords([
        {
          campaign: { id: 1 },
          contribution: BigInt(0),
          transactions: [{ action: "contribute", timestamp: 1 }],
        },
      ]),
    ).toEqual([]);
  });

  it("skips campaigns with no contribute transaction in the log", () => {
    expect(
      toDonationRecords([
        {
          campaign: { id: 2 },
          contribution: BigInt(3) * XLM,
          transactions: [{ action: "claim_refund", timestamp: 5_000 }],
        },
      ]),
    ).toEqual([]);
  });

  it("returns an empty list for no history", () => {
    expect(toDonationRecords([])).toEqual([]);
  });
});
