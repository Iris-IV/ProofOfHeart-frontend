import { describe, expect, it } from "vitest";
import {
  SEMANTIC_LANDMARK_MAP,
  auditSemanticLandmarks,
  getTextDirection,
  resolveSemanticLandmarkTag,
} from "@/lib/direction";

describe("direction & Semantic HTML Structural Tag Audit (#1574)", () => {
  it("resolves LTR and RTL text directions including region subtags", () => {
    expect(getTextDirection("en")).toBe("ltr");
    expect(getTextDirection("es")).toBe("ltr");
    expect(getTextDirection("ar")).toBe("rtl");
    expect(getTextDirection("ar-EG")).toBe("rtl");
    expect(getTextDirection("HE-IL")).toBe("rtl");
    expect(getTextDirection("fa")).toBe("rtl");
    expect(getTextDirection("ur")).toBe("rtl");
  });

  it("maps ARIA landmark roles to native HTML5 structural tags", () => {
    expect(resolveSemanticLandmarkTag("main")).toBe("main");
    expect(resolveSemanticLandmarkTag("navigation")).toBe("nav");
    expect(resolveSemanticLandmarkTag("article")).toBe("article");
    expect(resolveSemanticLandmarkTag("banner")).toBe("header");
    expect(resolveSemanticLandmarkTag("contentinfo")).toBe("footer");
    expect(resolveSemanticLandmarkTag("complementary")).toBe("aside");
    expect(SEMANTIC_LANDMARK_MAP.region).toBe("section");
  });

  it("passes when semantic <main>, <nav>, and <article> structural tags are used without generic landmark <div>s", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <header>
        <nav aria-label="Primary">
          <a href="/campaigns">Campaigns</a>
        </nav>
      </header>
      <main>
        <article>
          <h1>Clean Water Initiative</h1>
          <p>Campaign details and milestones.</p>
        </article>
      </main>
    `;

    const result = auditSemanticLandmarks(container);
    expect(result.passes).toBe(true);
    expect(result.presentTags).toEqual({ main: 1, nav: 1, article: 1 });
    expect(result.violations).toHaveLength(0);
  });

  it("flags generic <div> wrappers with landmark roles and missing <main>, <nav>, or <article>", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div role="navigation">Menu</div>
      <div role="main">
        <div role="article">Card</div>
      </div>
    `;

    const result = auditSemanticLandmarks(container);
    expect(result.passes).toBe(false);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain("MISSING_MAIN");
    expect(codes).toContain("MISSING_NAV");
    expect(codes).toContain("MISSING_ARTICLE");
    expect(
      result.violations.filter((v) => v.code === "GENERIC_DIV_WITH_LANDMARK_ROLE")
    ).toHaveLength(3);
  });

  it("flags multiple visible <main> landmarks while allowing hidden fallback <main>", () => {
    const twoVisible = document.createElement("div");
    twoVisible.innerHTML = `<nav></nav><main>One</main><main>Two</main><article></article>`;
    const badResult = auditSemanticLandmarks(twoVisible);
    expect(badResult.passes).toBe(false);
    expect(badResult.violations.map((v) => v.code)).toContain("MULTIPLE_VISIBLE_MAIN");

    const oneHidden = document.createElement("div");
    oneHidden.innerHTML = `<nav></nav><main>Active</main><main hidden>Inactive</main><article></article>`;
    const okResult = auditSemanticLandmarks(oneHidden);
    expect(okResult.passes).toBe(true);
  });
});
