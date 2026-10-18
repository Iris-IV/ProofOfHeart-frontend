import type { Schema } from "hast-util-sanitize";
import { stripPrototypePollutionKeys } from "./rehypeNoPrototypePollution";

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
const UNSAFE_PROTOCOLS = new Set(["javascript", "data", "vbscript"]);

/** True for any attribute name that is an event handler (`on*`), case-insensitive. */
function isEventHandlerAttribute(attr: string | readonly unknown[]): boolean {
  return typeof attr === "string" && attr.toLowerCase().startsWith("on");
}

/**
 * Merge GitHub-style defaults with ProofOfHeart-specific hardening.
 * Called from SafeMarkdown at runtime so Jest can mock rehype-sanitize in integration tests.
 */
export function buildMarkdownSanitizeSchema(defaultSchema: Schema): Schema {
  // Merge first, then harden every field — so a future schema addition cannot
  // reintroduce `on*` handlers or unsafe URL protocols (#770).
  const mergedProtocols = {
    ...defaultSchema.protocols,
    ...MARKDOWN_SANITIZE_OVERRIDES.protocols,
  };
  const hardenedProtocols = Object.fromEntries(
    Object.entries(mergedProtocols).map(([field, allowed]) => [
      field,
      (allowed ?? []).filter((protocol) => !UNSAFE_PROTOCOLS.has(protocol.toLowerCase())),
    ]),
  );

  const mergedAttributes = {
    ...defaultSchema.attributes,
    ...MARKDOWN_SANITIZE_OVERRIDES.attributes,
  };
  const hardenedAttributes = Object.fromEntries(
    Object.entries(mergedAttributes).map(([tag, attrs]) => [
      tag,
      (attrs ?? []).filter((attr) => !isEventHandlerAttribute(attr)),
    ]),
  );

  const schema: Schema = {
    ...defaultSchema,
    ...MARKDOWN_SANITIZE_OVERRIDES,
    protocols: hardenedProtocols,
    attributes: hardenedAttributes,
  };

  // #634 — never let a prototype-polluting key survive in the schema that is
  // spread onto rendered nodes.
  return stripPrototypePollutionKeys(schema);
}
