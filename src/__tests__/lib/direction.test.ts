import { getTextDirection } from "@/lib/direction";

describe("getTextDirection", () => {
  it("resolves supported LTR locales (en, es) to 'ltr'", () => {
    expect(getTextDirection("en")).toBe("ltr");
    expect(getTextDirection("es")).toBe("ltr");
  });

  it("falls back to 'ltr' for an unknown/unsupported locale instead of throwing", () => {
    expect(() => getTextDirection("xx-unknown")).not.toThrow();
    expect(getTextDirection("xx-unknown")).toBe("ltr");
  });

  it("falls back to 'ltr' for an empty locale string", () => {
    expect(getTextDirection("")).toBe("ltr");
  });

  it("resolves known RTL locales to 'rtl'", () => {
    expect(getTextDirection("ar")).toBe("rtl");
    expect(getTextDirection("he")).toBe("rtl");
  });
});
