import {
  PROTOTYPE_POLLUTION_KEYS,
  stripPrototypePollutionKeys,
  scrubHastTree,
  rehypeNoPrototypePollution,
} from "@/lib/rehypeNoPrototypePollution";

/**
 * #634 regression tests — prove the markdown pipeline cannot be used to smuggle
 * prototype-polluting keys onto rendered nodes or onto Object.prototype.
 */
describe("prototype pollution defense", () => {
  afterEach(() => {
    // Ensure no test leaked a polluted prototype.
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it("exposes the dangerous key list", () => {
    expect(PROTOTYPE_POLLUTION_KEYS).toEqual(["__proto__", "constructor", "prototype"]);
  });

  describe("stripPrototypePollutionKeys", () => {
    it("removes __proto__/constructor/prototype own keys", () => {
      const payload = JSON.parse('{"safe":1,"__proto__":{"polluted":true},"constructor":2}');
      const cleaned = stripPrototypePollutionKeys(payload);

      expect(cleaned).toEqual({ safe: 1 });
      expect(Object.prototype.hasOwnProperty.call(cleaned, "__proto__")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(cleaned, "constructor")).toBe(false);
    });

    it("cleans nested objects and arrays", () => {
      const payload = JSON.parse(
        '{"a":{"__proto__":{"x":1},"keep":"y"},"list":[{"prototype":9,"ok":true}]}',
      );
      const cleaned = stripPrototypePollutionKeys(payload) as {
        a: Record<string, unknown>;
        list: Record<string, unknown>[];
      };

      expect(cleaned.a).toEqual({ keep: "y" });
      expect(cleaned.list[0]).toEqual({ ok: true });
    });

    it("does not mutate Object.prototype while cleaning a malicious payload", () => {
      const payload = JSON.parse('{"__proto__":{"polluted":true}}');
      stripPrototypePollutionKeys(payload);

      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe("scrubHastTree", () => {
    it("deletes dangerous keys from element properties", () => {
      const properties: Record<string, unknown> = {};
      Object.defineProperty(properties, "__proto__", {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(properties, "constructor", {
        value: "evil",
        enumerable: true,
        configurable: true,
        writable: true,
      });
      properties.className = "safe";
      const tree = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "a",
            properties,
            children: [],
          },
        ],
      };

      scrubHastTree(tree);

      const node = tree.children[0] as { properties: Record<string, unknown> };
      expect(Object.prototype.hasOwnProperty.call(node.properties, "__proto__")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(node.properties, "constructor")).toBe(false);
      expect(node.properties.className).toBe("safe");
    });
  });

  describe("rehypeNoPrototypePollution plugin", () => {
    it("returns a transformer that scrubs the tree in place", () => {
      const properties: Record<string, unknown> = { id: "x" };
      Object.defineProperty(properties, "__proto__", {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
        writable: true,
      });

      const tree = {
        type: "root",
        children: [{ type: "element", tagName: "span", properties, children: [] }],
      };

      const transform = rehypeNoPrototypePollution();
      const result = transform(tree) as typeof tree;

      const node = result.children[0] as { properties: Record<string, unknown> };
      expect(Object.prototype.hasOwnProperty.call(node.properties, "__proto__")).toBe(false);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });
});
