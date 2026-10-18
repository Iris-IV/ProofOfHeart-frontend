/**
 * Design-token contract (issue #674)
 *
 * `src/app/globals.css` is the single source of truth for colour, spacing and
 * typography — see docs/DESIGN_SYSTEM.md. This guards two things:
 *
 * 1. The documented tokens actually exist in `@theme`, so a rename or
 *    accidental deletion breaks CI instead of shipping a silently unstyled
 *    surface.
 * 2. No new hardcoded hex colour creeps into a component or page. A short,
 *    reviewed allowlist covers the handful of contexts that genuinely cannot
 *    reference a CSS custom property (server-rendered OG/icon images via
 *    `@vercel/og`, the web app manifest, and the standalone maintenance page,
 *    which deliberately renders without the app's stylesheet so it still
 *    works if the CSS build is what's broken).
 */

import fs from "fs";
import path from "path";

const SRC_ROOT = path.join(__dirname, "..", "..");
const GLOBALS_CSS_PATH = path.join(SRC_ROOT, "app", "globals.css");

const REQUIRED_TOKENS = [
  "--color-brand",
  "--color-brand-strong",
  "--color-brand-subtle",
  "--color-accent",
  "--color-accent-strong",
  "--color-accent-subtle",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--color-info",
  "--color-muted",
  "--radius-control",
  "--radius-surface",
  "--duration-fast",
  "--duration-base",
  "--text-heading",
  "--text-heading-lg",
  "--font-weight-heading",
  "--font-weight-heading-lg",
  "--spacing-card-gap",
];

/** Files allowed to contain literal hex colours, and why. */
const HEX_ALLOWLIST = new Set(
  [
    // The token source itself: `--background`/`--foreground` have to bottom
    // out in a literal value somewhere, since a CSS variable can't be
    // defined in terms of itself.
    "app/globals.css",
    // @vercel/og (satori) renders to an image outside the DOM — CSS custom
    // properties never resolve there, so the brand palette is duplicated as
    // literal values instead.
    "lib/ogCard.tsx",
    "app/icon.tsx",
    "app/apple-icon.tsx",
    "app/icon-192/route.tsx",
    "app/icon-512/route.tsx",
    "app/[locale]/causes/[id]/opengraph-image.tsx",
    // web app manifest is static JSON, not CSS — no variable resolution.
    "app/manifest.ts",
    // Standalone maintenance page: intentionally has no dependency on
    // globals.css (or any app chrome) so it still renders if the CSS build
    // itself is the reason the site is down.
    "app/maintenance/page.tsx",
    // Tax receipt is a standalone HTML string opened in a new browser
    // window (window.open + document.write-style rendering), entirely
    // outside the app's component tree — CSS custom properties from
    // globals.css are never in scope there.
    "lib/taxReceipt.ts",
    // Official multi-colour Google "G" logomark — must stay literal, a
    // themed recolour would no longer be the Google brand mark.
    "components/SocialLoginButtons.tsx",
  ].map((p) => path.normalize(p)),
);

/** 6- or 8-digit hex only. Excludes 3/4-digit shorthand so `#649`-style
 * GitHub issue references in comments are never mistaken for a colour. */
const HEX_COLOR_PATTERN = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/;

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIP_DIR_NAMES = new Set(["__tests__", "stories"]);

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (SKIP_DIR_NAMES.has(entry.name)) return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) return [];
    return [fullPath];
  });
}

describe("design tokens – globals.css contract", () => {
  const css = fs.readFileSync(GLOBALS_CSS_PATH, "utf8");

  it.each(REQUIRED_TOKENS)("defines %s", (token) => {
    expect(css).toMatch(new RegExp(`${token}:`));
  });
});

describe("design tokens – no unreviewed hardcoded hex colours", () => {
  it("only allowlisted files reference a literal hex colour", () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((filePath) => HEX_COLOR_PATTERN.test(fs.readFileSync(filePath, "utf8")))
      .map((filePath) => path.relative(SRC_ROOT, filePath))
      .filter((relativePath) => !HEX_ALLOWLIST.has(path.normalize(relativePath)));

    expect(offenders).toEqual([]);
  });

  it("every allowlisted file still exists and still contains a hex colour", () => {
    // Keeps the allowlist honest — an entry that no longer applies (file
    // deleted, or migrated to a CSS variable) should be removed, not kept
    // around as dead permission.
    const stale = [...HEX_ALLOWLIST].filter((relativePath) => {
      const fullPath = path.join(SRC_ROOT, relativePath);
      if (!fs.existsSync(fullPath)) return true;
      return !HEX_COLOR_PATTERN.test(fs.readFileSync(fullPath, "utf8"));
    });

    expect(stale).toEqual([]);
  });
});
