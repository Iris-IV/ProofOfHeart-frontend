import {
  MARKDOWN_SANITIZE_OVERRIDES,
  buildMarkdownSanitizeSchema,
} from "@/lib/markdownSanitizeSchema";

/** Minimal stand-in for hast-util-sanitize defaults used in unit tests. */
const testDefaultSchema = {
  strip: ["script"],
  protocols: {
    cite: ["http", "https"],
    href: ["http", "https", "irc", "ircs", "mailto", "xmpp"],
    longDesc: ["http", "https"],
    src: ["http", "https"],
  },
  attributes: {
    a: ["href", "onClick"],
    img: ["src", "onerror"],
  },
};

describe("markdown sanitize schema", () => {
  it("disallows comments and restricts URL protocols", () => {
    expect(MARKDOWN_SANITIZE_OVERRIDES.allowComments).toBe(false);
    expect(MARKDOWN_SANITIZE_OVERRIDES.protocols?.href).toEqual(["http", "https", "mailto"]);
    expect(MARKDOWN_SANITIZE_OVERRIDES.protocols?.src).toEqual(["http", "https"]);
    expect(MARKDOWN_SANITIZE_OVERRIDES.protocols?.href).not.toContain("javascript");
    expect(MARKDOWN_SANITIZE_OVERRIDES.protocols?.src).not.toContain("data");
  });

  it("removes event-handler attributes from allowlists", () => {
    const schema = buildMarkdownSanitizeSchema(testDefaultSchema);
    expect(schema.attributes?.a).not.toContain("onClick");
    expect(schema.attributes?.img).not.toContain("onerror");
  });

  it("preserves default script stripping", () => {
    const schema = buildMarkdownSanitizeSchema(testDefaultSchema);
    expect(schema.strip).toContain("script");
  });
});

/**
 * Known XSS payloads exercised against the hardened protocol allowlist.
 * Full react-markdown pipeline coverage runs in Playwright/e2e or manual QA
 * because markdown dependencies are ESM-only in Jest without extra transforms.
 */
describe("XSS payload protocol expectations", () => {
  const blockedProtocols = ["javascript:", "data:", "vbscript:"];

  it.each(blockedProtocols)("blocks %s URLs in href and src allowlists", (protocol) => {
    const schema = buildMarkdownSanitizeSchema(testDefaultSchema);
    for (const allowed of schema.protocols?.href ?? []) {
      expect(allowed).not.toBe(protocol.replace(":", ""));
    }
    for (const allowed of schema.protocols?.src ?? []) {
      expect(allowed).not.toBe(protocol.replace(":", ""));
    }
  });
});
