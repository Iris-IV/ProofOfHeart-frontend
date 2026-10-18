import { analyticsDispatch, rateWebVital, WEB_VITALS_THRESHOLDS } from "@/lib/analyticsDispatch";

describe("analyticsDispatch Web Vitals Collector Pipeline (#1595)", () => {
  it("rates LCP metric correctly against SLA thresholds", () => {
    expect(rateWebVital("LCP", 2000)).toBe("good");
    expect(rateWebVital("LCP", 3200)).toBe("needs-improvement");
    expect(rateWebVital("LCP", 4500)).toBe("poor");
  });

  it("rates CLS metric correctly against SLA thresholds", () => {
    expect(rateWebVital("CLS", 0.05)).toBe("good");
    expect(rateWebVital("CLS", 0.15)).toBe("needs-improvement");
    expect(rateWebVital("CLS", 0.3)).toBe("poor");
  });

  it("rates INP metric correctly against SLA thresholds", () => {
    expect(rateWebVital("INP", 150)).toBe("good");
    expect(rateWebVital("INP", 350)).toBe("needs-improvement");
    expect(rateWebVital("INP", 600)).toBe("poor");
  });

  it("dispatches web_vital event without throwing", () => {
    expect(() =>
      analyticsDispatch("web_vital", {
        name: "LCP",
        value: 2100,
        id: "v3-1234567",
      }),
    ).not.toThrow();
  });
});
