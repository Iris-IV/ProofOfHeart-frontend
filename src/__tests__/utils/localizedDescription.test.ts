import { getLocalizedDescription, encodeLocalizedDescription } from "@/utils/localizedDescription";

describe("localizedDescription", () => {
  describe("getLocalizedDescription", () => {
    it("returns the requested locale's description when it exists", () => {
      const description = "[lang:en]English text[lang:es]Texto en español";
      expect(getLocalizedDescription(description, "en")).toBe("English text");
      expect(getLocalizedDescription(description, "es")).toBe("Texto en español");
    });

    it("returns plain text as-is when there are no language markers", () => {
      const description = "A plain campaign description";
      expect(getLocalizedDescription(description, "en")).toBe(description);
      expect(getLocalizedDescription(description, "fr")).toBe(description);
    });

    it("falls back to the default locale when the requested locale is missing", () => {
      const description = "[lang:en]English text[lang:es]Texto en español";
      expect(getLocalizedDescription(description, "fr")).toBe("English text");
    });

    it("falls back to the default locale when the requested locale is empty", () => {
      expect(getLocalizedDescription("[lang:en]English text[lang:fr] ", "fr")).toBe("English text");
      expect(getLocalizedDescription("[lang:fr][lang:en]English text", "fr")).toBe("English text");
    });

    it("falls back to the raw description when the default locale is also empty", () => {
      expect(getLocalizedDescription("[lang:fr]", "fr")).toBe("[lang:fr]");
    });
  });

  describe("encodeLocalizedDescription", () => {
    it("encodes translations into the on-chain marker format", () => {
      expect(encodeLocalizedDescription({ en: "English", es: "Español" })).toBe(
        "[lang:en]English[lang:es]Español",
      );
    });

    it("omits empty or whitespace-only translations", () => {
      expect(encodeLocalizedDescription({ en: "English", fr: "", de: "   " })).toBe(
        "[lang:en]English",
      );
    });

    it("returns an empty string when there are no non-empty translations", () => {
      expect(encodeLocalizedDescription({})).toBe("");
      expect(encodeLocalizedDescription({ fr: "", de: " " })).toBe("");
    });
  });

  it("round-trips encode then decode for each locale", () => {
    const encoded = encodeLocalizedDescription({ en: "Hello", es: "Hola" });
    expect(getLocalizedDescription(encoded, "en")).toBe("Hello");
    expect(getLocalizedDescription(encoded, "es")).toBe("Hola");
  });
});
