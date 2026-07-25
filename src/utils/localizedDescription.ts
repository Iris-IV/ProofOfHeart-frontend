/**
 * Encoding format for multi-language campaign descriptions stored on-chain.
 *
 * A description with multiple languages is encoded as:
 *   [lang:en]English text[lang:es]Spanish text
 *
 * Descriptions without any language markers are treated as plain text and
 * returned as-is regardless of locale (backward-compatible).
 */

const LANG_BLOCK_RE = /\[lang:([a-z]{2})\]([\s\S]*?)(?=\[lang:[a-z]{2}\]|$)/g;

type LocalizedMap = Partial<Record<string, string>>;

function parse(description: string): LocalizedMap | null {
  const result: LocalizedMap = {};
  let found = false;
  let match: RegExpExecArray | null;
  LANG_BLOCK_RE.lastIndex = 0;
  while ((match = LANG_BLOCK_RE.exec(description)) !== null) {
    result[match[1]] = match[2].trim();
    found = true;
  }
  return found ? result : null;
}

/**
 * Returns the description text for the given locale, falling back to English,
 * then to the raw description string if no language markers are present.
 */
export function getLocalizedDescription(description: string, locale: string): string {
  const map = parse(description);
  if (!map) return description;
  return map[locale] ?? map["en"] ?? description;
}

/**
 * Encodes per-language texts into a single on-chain description string.
 * Only languages with non-empty text are included.
 */
export function encodeLocalizedDescription(translations: Record<string, string>): string {
  return Object.entries(translations)
    .filter(([, text]) => text.trim().length > 0)
    .map(([lang, text]) => `[lang:${lang}]${text.trim()}`)
    .join("");
}
