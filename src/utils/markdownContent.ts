/**
 * #655 — Helpers for detecting markdown content that renders to nothing.
 *
 * A campaign description can be an empty string, whitespace, or markdown that
 * produces no visible output (for example a lone comment or stray formatting
 * characters). In every one of those cases the detail page would otherwise show
 * a large blank gap, so callers use this to decide when to render a fallback.
 */

/**
 * True when the given markdown string has no meaningful, visible content.
 *
 * Strips markdown comments and formatting-only characters before checking for
 * any remaining non-whitespace text.
 */
export function isBlankMarkdown(content: string | null | undefined): boolean {
  if (content == null) return true;

  const withoutComments = content.replace(/<!--[\s\S]*?-->/g, "");

  // Remove characters that are purely markdown syntax and carry no text.
  const withoutSyntax = withoutComments.replace(/[#>*_~`\-+.\s[\]()!|\\]/g, "");

  return withoutSyntax.length === 0;
}
