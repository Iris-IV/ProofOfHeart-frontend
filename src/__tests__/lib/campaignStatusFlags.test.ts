import {
  CAMPAIGN_ACTIVE,
  CAMPAIGN_PAUSED,
  CAMPAIGN_SUCCEEDED,
  CAMPAIGN_VALIDATED,
  decodeCampaignStatusFlags,
} from "@/lib/campaignStatusFlags";

describe("campaign status bits", () => {
  it("match the contract's CAMPAIGN_* constants in types.rs", () => {
    expect(CAMPAIGN_ACTIVE).toBe(1);
    expect(CAMPAIGN_PAUSED).toBe(2);
    expect(CAMPAIGN_VALIDATED).toBe(4);
    expect(CAMPAIGN_SUCCEEDED).toBe(8);
  });

  it("decodes an empty status as nothing set", () => {
    expect(decodeCampaignStatusFlags(0)).toEqual({
      is_active: false,
      is_cancelled: false,
      is_verified: false,
      funds_withdrawn: false,
    });
  });

  it("maps PAUSED to cancelled and SUCCEEDED to funds withdrawn", () => {
    expect(decodeCampaignStatusFlags(CAMPAIGN_PAUSED)).toMatchObject({ is_cancelled: true });
    expect(decodeCampaignStatusFlags(CAMPAIGN_SUCCEEDED)).toMatchObject({ funds_withdrawn: true });
  });

  it("decodes every combination of bits independently", () => {
    for (let status = 0; status < 16; status += 1) {
      expect(decodeCampaignStatusFlags(status)).toEqual({
        is_active: (status & CAMPAIGN_ACTIVE) !== 0,
        is_cancelled: (status & CAMPAIGN_PAUSED) !== 0,
        is_verified: (status & CAMPAIGN_VALIDATED) !== 0,
        funds_withdrawn: (status & CAMPAIGN_SUCCEEDED) !== 0,
      });
    }
  });

  it("decodes a live, verified campaign", () => {
    expect(decodeCampaignStatusFlags(CAMPAIGN_ACTIVE | CAMPAIGN_VALIDATED)).toEqual({
      is_active: true,
      is_cancelled: false,
      is_verified: true,
      funds_withdrawn: false,
    });
  });
});
