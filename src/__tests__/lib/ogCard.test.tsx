import { render, screen } from "@testing-library/react";
import {
  BrandOgCard,
  OG_CACHE_CONTROL,
  OG_COLORS,
  OG_SIZE,
  ogImageOptions,
  truncate,
} from "@/lib/ogCard";

/** WCAG 2.1 relative-luminance contrast ratio between two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("truncate", () => {
  it("returns short strings untouched", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("shortens to maxLen characters including the ellipsis", () => {
    const out = truncate("abcdefghij", 5);
    expect(out).toBe("abcd…");
    expect(Array.from(out)).toHaveLength(5);
  });

  it("never splits a surrogate pair", () => {
    const out = truncate("💜💜💜💜💜", 3);
    expect(out).toBe("💜💜…");
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("does not leave whitespace before the ellipsis", () => {
    expect(truncate("hello world", 7)).toBe("hello…");
  });

  it("handles non-positive limits", () => {
    expect(truncate("abc", 0)).toBe("");
    expect(truncate("abc", -1)).toBe("");
  });
});

describe("OG image options", () => {
  it("keeps the 1200x630 size Apple/Slack/X/Facebook require", () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
    expect(ogImageOptions("x")).toMatchObject({ width: 1200, height: 630 });
  });

  it("attaches the given Cache-Control header", () => {
    expect(ogImageOptions(OG_CACHE_CONTROL.brand).headers).toEqual({
      "Cache-Control": OG_CACHE_CONTROL.brand,
    });
  });

  it("caches successful cards at the CDN and failures only briefly", () => {
    const sMaxAge = (v: string) => Number(/s-maxage=(\d+)/.exec(v)?.[1]);
    expect(sMaxAge(OG_CACHE_CONTROL.brand)).toBeGreaterThan(sMaxAge(OG_CACHE_CONTROL.campaign));
    expect(sMaxAge(OG_CACHE_CONTROL.campaign)).toBeGreaterThan(sMaxAge(OG_CACHE_CONTROL.fallback));
    expect(OG_CACHE_CONTROL.fallback).not.toMatch(/stale-while-revalidate/);
    for (const v of Object.values(OG_CACHE_CONTROL)) expect(v).toMatch(/^public,/);
  });
});

describe("OG palette accessibility (WCAG 2.1 AA)", () => {
  it("foreground text meets AAA on the background", () => {
    expect(contrast(OG_COLORS.foreground, OG_COLORS.background)).toBeGreaterThanOrEqual(7);
  });

  it("muted subtitle text meets AA (4.5:1) on the background", () => {
    expect(contrast(OG_COLORS.muted, OG_COLORS.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("white heart glyph meets the 3:1 non-text contrast on both gradient stops", () => {
    expect(contrast("#ffffff", OG_COLORS.accentFrom)).toBeGreaterThanOrEqual(3);
    expect(contrast("#ffffff", OG_COLORS.accentTo)).toBeGreaterThanOrEqual(3);
  });
});

describe("BrandOgCard", () => {
  it("defaults the title to the brand name and omits the subtitle", () => {
    render(<BrandOgCard />);
    expect(screen.getByText("ProofOfHeart")).toBeInTheDocument();
  });

  it("renders a truncated title and subtitle", () => {
    render(<BrandOgCard title={"T".repeat(200)} subtitle={"S".repeat(300)} />);
    expect(screen.getByText(/^T+…$/).textContent).toHaveLength(70);
    expect(screen.getByText(/^S+…$/).textContent).toHaveLength(110);
  });
});
