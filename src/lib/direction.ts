// RTL locale registry — extend this list when adding right-to-left locales (ar, he, fa, ur…).
// Currently all configured locales (en, es) are LTR; the infrastructure is here for when
// an RTL locale is added to src/i18n/routing.ts.
const RTL_LOCALES = new Set<string>(["ar", "he", "fa", "ur"]);

export type TextDirection = "ltr" | "rtl";

export function getTextDirection(locale: string): TextDirection {
  const normalized = locale.trim().toLowerCase().split("-")[0];
  return RTL_LOCALES.has(normalized) ? "rtl" : "ltr";
}

export type SemanticLandmarkTag =
  | "main"
  | "nav"
  | "article"
  | "section"
  | "header"
  | "footer"
  | "aside";

export type LandmarkRole =
  | "main"
  | "navigation"
  | "article"
  | "region"
  | "banner"
  | "contentinfo"
  | "complementary";

export const SEMANTIC_LANDMARK_MAP: Record<LandmarkRole, SemanticLandmarkTag> = {
  main: "main",
  navigation: "nav",
  article: "article",
  region: "section",
  banner: "header",
  contentinfo: "footer",
  complementary: "aside",
};

export const REQUIRED_STRUCTURAL_TAGS = ["main", "article", "nav"] as const;

export interface SemanticAuditViolation {
  code:
    | "MISSING_MAIN"
    | "MULTIPLE_VISIBLE_MAIN"
    | "MISSING_NAV"
    | "MISSING_ARTICLE"
    | "GENERIC_DIV_WITH_LANDMARK_ROLE";
  message: string;
  selector: string;
}

export interface SemanticAuditResult {
  passes: boolean;
  presentTags: Record<(typeof REQUIRED_STRUCTURAL_TAGS)[number], number>;
  violations: SemanticAuditViolation[];
}

/**
 * Resolves the appropriate HTML5 semantic structural tag (`<main>`, `<nav>`,
 * `<article>`, etc.) for a landmark role instead of a generic `<div>`.
 */
export function resolveSemanticLandmarkTag(role: LandmarkRole): SemanticLandmarkTag {
  return SEMANTIC_LANDMARK_MAP[role];
}

/**
 * Audits a DOM container (or `document`) to verify WCAG 2.1 AA / HTML5
 * structural landmark compliance:
 * - At least one `<main>` landmark exists and at most one is visible (`!hidden`).
 * - `<nav>` and `<article>` structural elements are used where expected.
 * - Generic `<div role="main|navigation|article|banner|contentinfo|complementary">`
 *   wrappers are flagged so they can be replaced with native HTML5 structural tags.
 */
export function auditSemanticLandmarks(
  root: ParentNode,
  options: { requireArticle?: boolean; requireNav?: boolean } = {}
): SemanticAuditResult {
  const { requireArticle = true, requireNav = true } = options;
  const violations: SemanticAuditViolation[] = [];

  const mains = Array.from(root.querySelectorAll("main"));
  const navs = Array.from(root.querySelectorAll("nav"));
  const articles = Array.from(root.querySelectorAll("article"));

  if (mains.length === 0) {
    violations.push({
      code: "MISSING_MAIN",
      message: "Document is missing a primary <main> structural landmark.",
      selector: "main",
    });
  } else {
    const visibleMains = mains.filter(
      (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true"
    );
    if (visibleMains.length > 1) {
      violations.push({
        code: "MULTIPLE_VISIBLE_MAIN",
        message: `Found ${visibleMains.length} visible <main> landmarks; only one visible <main> is permitted per page.`,
        selector: "main",
      });
    }
  }

  if (requireNav && navs.length === 0) {
    violations.push({
      code: "MISSING_NAV",
      message: "Document is missing a <nav> structural navigation element.",
      selector: "nav",
    });
  }

  if (requireArticle && articles.length === 0) {
    violations.push({
      code: "MISSING_ARTICLE",
      message: "Document is missing an <article> structural element for self-contained content.",
      selector: "article",
    });
  }

  const genericLandmarkDivs = Array.from(
    root.querySelectorAll(
      'div[role="main"], div[role="navigation"], div[role="article"], div[role="banner"], div[role="contentinfo"], div[role="complementary"]'
    )
  );
  for (const div of genericLandmarkDivs) {
    const role = div.getAttribute("role") as LandmarkRole;
    const recommended = SEMANTIC_LANDMARK_MAP[role] ?? "section";
    violations.push({
      code: "GENERIC_DIV_WITH_LANDMARK_ROLE",
      message: `Generic <div role="${role}"> should be replaced with semantic <${recommended}> element.`,
      selector: `div[role="${role}"]`,
    });
  }

  return {
    passes: violations.length === 0,
    presentTags: {
      main: mains.length,
      article: articles.length,
      nav: navs.length,
    },
    violations,
  };
}
