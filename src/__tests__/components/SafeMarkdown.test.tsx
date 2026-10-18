import {
  MARKDOWN_SANITIZE_OVERRIDES,
  buildMarkdownSanitizeSchema,
} from "@/lib/markdownSanitizeSchema";

/** Minimal stand-in for hast-util-sanitize defaults used in unit tests. */
const testDefaultSchema = {
  strip: ["script"],
  protocols: {
    cite: ["http", "https"],
    href: ["http", "https", "irc", "ircs", "mailto", "xmpp", "javascript", "data", "vbscript"],
    longDesc: ["http", "https"],
    src: ["http", "https", "data", "javascript"],
    customAttr: ["javascript", "http", "data"],
  },
  attributes: {
    a: ["href", "onClick", "ONLOAD", "class"],
    img: ["src", "onerror", "onMouseOver"],
    div: ["className", "onHover", "onClick", "customAttr"],
    "*": ["id", "onclick"],
  },
};

describe("markdown sanitize schema hardening", () => {
  it("disallows comments and restricts URL protocols in overrides", () => {
    expect(MARKDOWN_SANITIZE_OVERRIDES.allowComments).toBe(false);
    expect(MARKDOWN_SANITIZE_OVERRIDES.protocols?.href).toEqual(["http", "https", "mailto"]);
    expect(MARKDOWN_SANITIZE_OVERRIDES.protocols?.src).toEqual(["http", "https"]);
    expect(MARKDOWN_SANITIZE_OVERRIDES.protocols?.href).not.toContain("javascript");
    expect(MARKDOWN_SANITIZE_OVERRIDES.protocols?.src).not.toContain("data");
  });

  it("removes event-handler attributes from all elements globally (case-insensitive)", () => {
    const schema = buildMarkdownSanitizeSchema(testDefaultSchema);

    // Ensure all event handler attributes are removed from every tag configuration
    for (const [_, attrs] of Object.entries(schema.attributes ?? {})) {
      for (const attr of attrs) {
        const name = typeof attr === "string" ? attr : attr[0];
        expect(name.toLowerCase().startsWith("on")).toBe(false);
      }
    }

    // Specific tag checks to verify they are gone but safe attributes remain
    expect(schema.attributes?.a).not.toContain("onClick");
    expect(schema.attributes?.a).not.toContain("ONLOAD");
    expect(schema.attributes?.a).toContain("href");
    expect(schema.attributes?.a).toContain("class");

    expect(schema.attributes?.img).not.toContain("onerror");
    expect(schema.attributes?.img).not.toContain("onMouseOver");
    expect(schema.attributes?.img).toContain("src");

    expect(schema.attributes?.div).not.toContain("onHover");
    expect(schema.attributes?.div).not.toContain("onClick");
    expect(schema.attributes?.div).toContain("className");
    expect(schema.attributes?.div).toContain("customAttr");

    expect(schema.attributes?.["*"]).not.toContain("onclick");
    expect(schema.attributes?.["*"]).toContain("id");
  });

  it("blocks javascript:, data:, and vbscript: protocols globally from all schema fields", () => {
    const schema = buildMarkdownSanitizeSchema(testDefaultSchema);

    // Ensure unsafe protocols are completely removed from every attribute protocol list
    for (const [_, protocols] of Object.entries(schema.protocols ?? {})) {
      for (const protocol of protocols ?? []) {
        const lower = protocol.toLowerCase();
        expect(lower).not.toBe("javascript");
        expect(lower).not.toBe("data");
        expect(lower).not.toBe("vbscript");
      }
    }

    // Specific checks
    expect(schema.protocols?.href).not.toContain("javascript");
    expect(schema.protocols?.href).not.toContain("data");
    expect(schema.protocols?.href).not.toContain("vbscript");
    expect(schema.protocols?.href).toContain("http");

    expect(schema.protocols?.src).not.toContain("javascript");
    expect(schema.protocols?.src).not.toContain("data");
    expect(schema.protocols?.src).toContain("http");

    expect(schema.protocols?.customAttr).not.toContain("javascript");
    expect(schema.protocols?.customAttr).not.toContain("data");
    expect(schema.protocols?.customAttr).toContain("http");
  });

  it("preserves default script stripping", () => {
    const schema = buildMarkdownSanitizeSchema(testDefaultSchema);
    expect(schema.strip).toContain("script");
  });
});
