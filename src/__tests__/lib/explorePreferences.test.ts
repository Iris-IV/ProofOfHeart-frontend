import {
  EXPLORE_DENSITY_STORAGE_KEY,
  loadExploreDensity,
  parseExploreDensity,
  saveExploreDensity,
} from "@/lib/explorePreferences";

describe("parseExploreDensity", () => {
  it("accepts grid", () => {
    expect(parseExploreDensity("grid")).toBe("grid");
  });

  it("falls back to compact for anything else", () => {
    expect(parseExploreDensity("compact")).toBe("compact");
    expect(parseExploreDensity("GRID")).toBe("compact");
    expect(parseExploreDensity("")).toBe("compact");
    expect(parseExploreDensity(null)).toBe("compact");
    expect(parseExploreDensity(undefined)).toBe("compact");
  });
});

describe("loadExploreDensity / saveExploreDensity", () => {
  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it("defaults to compact when nothing is saved", () => {
    expect(loadExploreDensity()).toBe("compact");
  });

  it("round-trips a saved layout", () => {
    saveExploreDensity("grid");
    expect(window.localStorage.getItem(EXPLORE_DENSITY_STORAGE_KEY)).toBe("grid");
    expect(loadExploreDensity()).toBe("grid");
  });

  it("returns compact when storage throws on read", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadExploreDensity()).toBe("compact");
  });

  it("does not throw when storage throws on write", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveExploreDensity("grid")).not.toThrow();
  });
});
