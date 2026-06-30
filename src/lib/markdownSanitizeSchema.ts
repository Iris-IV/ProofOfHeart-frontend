import type { Schema } from "hast-util-sanitize";

/** Protocol and tag restrictions applied on top of rehype-sanitize defaults. */
export const MARKDOWN_SANITIZE_OVERRIDES: Partial<Schema> = {
  allowComments: false,
  protocols: {
    cite: ["http", "https"],
    href: ["http", "https", "mailto"],
    longDesc: ["http", "https"],
    src: ["http", "https"],
  },
};

/**
 * Merge GitHub-style defaults with ProofOfHeart-specific hardening.
 * Called from SafeMarkdown at runtime so Jest can mock rehype-sanitize in integration tests.
 */
export function buildMarkdownSanitizeSchema(defaultSchema: Schema): Schema {
  return {
    ...defaultSchema,
    ...MARKDOWN_SANITIZE_OVERRIDES,
    protocols: {
      ...defaultSchema.protocols,
      ...MARKDOWN_SANITIZE_OVERRIDES.protocols,
    },
    attributes: {
      ...defaultSchema.attributes,
      a: (defaultSchema.attributes?.a ?? []).filter((attr) =>
        typeof attr === "string" ? !attr.toLowerCase().startsWith("on") : true,
      ),
      img: (defaultSchema.attributes?.img ?? []).filter((attr) =>
        typeof attr === "string" ? !attr.toLowerCase().startsWith("on") : true,
      ),
    },
  };
}
