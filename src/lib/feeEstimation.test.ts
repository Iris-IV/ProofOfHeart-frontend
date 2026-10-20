import {
  estimateFeeRange,
  calculateInclusionFeeBuffer,
  recommendedFeeCapStroops,
  effectiveFeeBufferBps,
  DEFAULT_FEE_BUFFER_BPS,
  DEFAULT_CONGESTION_FEE_BUFFER_BPS,
  type FeeEstimateRange,
} from "./feeEstimation";

describe("estimateFeeRange", () => {
  it("keeps the base fee as typical when the network is idle", () => {
    const range = estimateFeeRange(100n, 150n);

    expect(range.typicalStroops).toBe(100n);
    expect(range.worstCaseStroops).toBe(100n);
    expect(range.surgeMultiplier).toBe(1);
    expect(range.isCongested).toBe(false);
  });

  it("applies the congestion multiplier when recent fees spike", () => {
    const range = estimateFeeRange(100n, 500n);

    expect(range.isCongested).toBe(true);
    expect(range.surgeMultiplier).toBe(10);
    expect(range.worstCaseStroops).toBe(1000n);
  });

  it("treats a zero base fee as idle without dividing by zero", () => {
    const range = estimateFeeRange(0n, 1_000n);

    expect(range.isCongested).toBe(false);
    expect(range.worstCaseStroops).toBe(0n);
  });
});

describe("inclusion fee buffers (#1501)", () => {
  const idle: FeeEstimateRange = {
    typicalStroops: 100n,
    worstCaseStroops: 100n,
    surgeMultiplier: 1,
    isCongested: false,
  };
  const congested: FeeEstimateRange = {
    typicalStroops: 100n,
    worstCaseStroops: 1_000n,
    surgeMultiplier: 10,
    isCongested: true,
  };

  it("uses the idle buffer when not congested", () => {
    expect(effectiveFeeBufferBps(idle)).toBe(DEFAULT_FEE_BUFFER_BPS);
    expect(calculateInclusionFeeBuffer(idle)).toBe(10n);
    expect(recommendedFeeCapStroops(idle)).toBe(110n);
  });

  it("uses the larger congestion buffer during a surge", () => {
    expect(effectiveFeeBufferBps(congested)).toBe(DEFAULT_CONGESTION_FEE_BUFFER_BPS);
    expect(calculateInclusionFeeBuffer(congested)).toBe(500n);
    expect(recommendedFeeCapStroops(congested)).toBe(1_500n);
  });

  it("respects custom buffer percentages", () => {
    expect(recommendedFeeCapStroops(idle, { bufferBps: 2_000 })).toBe(120n);
    expect(recommendedFeeCapStroops(congested, { congestionBufferBps: 1_000 })).toBe(1_100n);
  });

  it("never buffers below the idle percentage when congested", () => {
    const bps = effectiveFeeBufferBps(congested, { bufferBps: 4_000, congestionBufferBps: 500 });
    expect(bps).toBe(4_000);
  });

  it("falls back to defaults for invalid buffer values", () => {
    expect(effectiveFeeBufferBps(idle, { bufferBps: Number.NaN })).toBe(DEFAULT_FEE_BUFFER_BPS);
    expect(effectiveFeeBufferBps(idle, { bufferBps: -100 })).toBe(DEFAULT_FEE_BUFFER_BPS);
  });

  it("adds nothing on top of a zero worst case", () => {
    const zero: FeeEstimateRange = {
      typicalStroops: 0n,
      worstCaseStroops: 0n,
      surgeMultiplier: 1,
      isCongested: false,
    };

    expect(calculateInclusionFeeBuffer(zero)).toBe(0n);
    expect(recommendedFeeCapStroops(zero)).toBe(0n);
  });

  it("scales the buffer with the surge-adjusted worst case", () => {
    const range = estimateFeeRange(100n, 1_000n);
    expect(range.worstCaseStroops).toBe(1_000n);
    expect(recommendedFeeCapStroops(range)).toBe(1_500n);
  });
});
