import { shouldPrefetchOnHover, CRITICAL_PREFETCH_ROUTES } from "@/i18n/routing";

describe("critical route prefetching", () => {
  it("identifies critical and detail routes for hover prefetching", () => {
    expect(CRITICAL_PREFETCH_ROUTES).toContain("/causes");
    expect(CRITICAL_PREFETCH_ROUTES).toContain("/explore");

    expect(shouldPrefetchOnHover("/causes/123")).toBe(true);
    expect(shouldPrefetchOnHover("/causes")).toBe(true);
    expect(shouldPrefetchOnHover("/explore")).toBe(true);
    expect(shouldPrefetchOnHover("/settings")).toBe(false);
  });
});
