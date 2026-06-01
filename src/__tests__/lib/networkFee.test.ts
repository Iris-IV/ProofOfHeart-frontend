import {
  DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS,
  getEstimatedContributeNetworkFeeStroops,
  getEstimatedContributeNetworkFeeXlm,
} from "@/lib/networkFee";

describe("networkFee", () => {
  const originalEnv = process.env.NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS;
    } else {
      process.env.NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS = originalEnv;
    }
  });

  it("returns the default stroop estimate when env is unset", () => {
    delete process.env.NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS;
    expect(getEstimatedContributeNetworkFeeStroops()).toBe(DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS);
    expect(getEstimatedContributeNetworkFeeXlm()).toBe(0.01);
  });

  it("reads override from NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS", () => {
    process.env.NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS = "200000";
    expect(getEstimatedContributeNetworkFeeStroops()).toBe(200_000n);
    expect(getEstimatedContributeNetworkFeeXlm()).toBe(0.02);
  });
});
