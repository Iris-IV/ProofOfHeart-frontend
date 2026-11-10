import React from "react";
import { renderHook } from "@testing-library/react";
import { ThemeContext, type Theme } from "@/components/ThemeProvider";
import {
  THEME_BREAKPOINTS,
  THEME_COLOR_TOKENS,
  THEME_GLASS_SURFACE_TOKENS,
  THEME_TRANSITION_DURATION_MS,
  WCAG_AA_NORMAL_TEXT_MIN_RATIO,
  applySmoothThemeTransition,
  auditThemeTokenContrast,
  getContrastRatio,
  getRelativeLuminance,
  getResponsiveThemeLayoutTokens,
  parseHexColor,
  resolveThemeBreakpointTier,
  useTheme,
} from "@/hooks/useTheme";

describe("useTheme & WCAG 2.1 AA Dark Mode Contrast Ratio Audit (#1557 / #1340)", () => {
  it("throws when useTheme is called outside ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within a ThemeProvider",
    );
  });

  it("returns the active theme context when inside ThemeProvider", () => {
    const mockValue = {
      theme: "dark" as Theme,
      toggleTheme: () => {},
      setTheme: () => {},
      highContrast: false,
      setHighContrast: () => {},
    };
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(ThemeContext.Provider, { value: mockValue }, children);

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("correctly parses 3-digit and 6-digit hex colors and computes relative luminance", () => {
    expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
    expect(parseHexColor("#0a0a0a")).toEqual([10, 10, 10]);
    expect(getRelativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(getRelativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(getContrastRatio("#ffffff", "#000000")).toBe(21);
    expect(() => parseHexColor("invalid")).toThrow(/Invalid hex color/);
  });

  it("guarantees >= 4.5:1 WCAG 2.1 AA contrast ratio across all dark mode theme tokens", () => {
    const report = auditThemeTokenContrast("dark");
    expect(report.minimumRatio).toBe(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
    expect(report.passesAll).toBe(true);

    for (const item of report.items) {
      expect(item.ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
      expect(item.passesAA).toBe(true);
    }
  });

  it("guarantees >= 4.5:1 WCAG 2.1 AA contrast ratio across all light mode theme tokens", () => {
    const report = auditThemeTokenContrast("light");
    expect(report.passesAll).toBe(true);

    for (const item of report.items) {
      expect(item.ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
      expect(item.passesAA).toBe(true);
    }
  });

  it("flags low-contrast custom token overrides that violate the 4.5:1 threshold", () => {
    const failingDarkTokens = {
      ...THEME_COLOR_TOKENS.dark,
      muted: "#3f3f46", // zinc-700 on #0a0a0a is ~1.88:1
    };
    const report = auditThemeTokenContrast("dark", failingDarkTokens);
    expect(report.passesAll).toBe(false);
    const mutedEntry = report.items.find((item) => item.token === "muted");
    expect(mutedEntry?.passesAA).toBe(false);
    expect(mutedEntry?.ratio).toBeLessThan(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
  });

  describe("theme glassmorphism tokens and smooth micro-interactions (#1340)", () => {
    it("keeps theme transition duration snappy (<150ms) and defines glass surface tokens", () => {
      expect(THEME_TRANSITION_DURATION_MS).toBeLessThan(150);
      expect(THEME_GLASS_SURFACE_TOKENS.light.highlightGradient).toContain("linear-gradient");
      expect(THEME_GLASS_SURFACE_TOKENS.dark.highlightGradient).toContain("linear-gradient");
      expect(THEME_GLASS_SURFACE_TOKENS.light.backdropBlur).toContain("blur(");
      expect(THEME_GLASS_SURFACE_TOKENS.dark.backdropBlur).toContain("blur(");
      expect(THEME_GLASS_SURFACE_TOKENS.dark.transitionCss).toContain("background-color");
      expect(THEME_GLASS_SURFACE_TOKENS.dark.transitionCss).toContain("color");
    });

    it("resolves responsive theme layout tokens across mobile (320px), tablet (768px), and desktop (1280px+)", () => {
      expect(resolveThemeBreakpointTier(THEME_BREAKPOINTS.mobile)).toBe("mobile");
      expect(resolveThemeBreakpointTier(THEME_BREAKPOINTS.tablet)).toBe("tablet");
      expect(resolveThemeBreakpointTier(THEME_BREAKPOINTS.desktop)).toBe("desktop");

      const mobileTokens = getResponsiveThemeLayoutTokens(320);
      const tabletTokens = getResponsiveThemeLayoutTokens(768);
      const desktopTokens = getResponsiveThemeLayoutTokens(1440);
      const reducedMotionTokens = getResponsiveThemeLayoutTokens(1280, {
        prefersReducedMotion: true,
      });

      expect(mobileTokens.tier).toBe("mobile");
      expect(mobileTokens.containLayoutShift).toBe(true);
      expect(mobileTokens.toggleTargetSizePx).toBeGreaterThanOrEqual(44);
      expect(mobileTokens.transitionDurationMs).toBe(THEME_TRANSITION_DURATION_MS);

      expect(tabletTokens.tier).toBe("tablet");
      expect(tabletTokens.backdropBlurPx).toBeGreaterThan(mobileTokens.backdropBlurPx);

      expect(desktopTokens.tier).toBe("desktop");
      expect(desktopTokens.backdropBlurPx).toBeGreaterThan(tabletTokens.backdropBlurPx);

      expect(reducedMotionTokens.transitionDurationMs).toBe(0);
    });

    it("orchestrates and cleans up data-theme-transitioning without layout shift", () => {
      jest.useFakeTimers();
      const root = document.createElement("html");

      const cleanup = applySmoothThemeTransition(root, {
        durationMs: 120,
        prefersReducedMotion: false,
      });

      expect(root.dataset.themeTransitioning).toBe("true");
      expect(root.style.getPropertyValue("--theme-transition-duration")).toBe("120ms");

      jest.advanceTimersByTime(120);
      expect(root.dataset.themeTransitioning).toBeUndefined();

      cleanup();
      jest.useRealTimers();
    });

    it("skips theme transition when prefers-reduced-motion or high contrast is active", () => {
      const root = document.createElement("html");
      applySmoothThemeTransition(root, { prefersReducedMotion: true });
      expect(root.dataset.themeTransitioning).toBeUndefined();

      root.dataset.contrast = "high";
      applySmoothThemeTransition(root, { prefersReducedMotion: false });
      expect(root.dataset.themeTransitioning).toBeUndefined();
    });
  });
});
