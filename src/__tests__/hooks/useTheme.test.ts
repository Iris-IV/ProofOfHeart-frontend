import { describe, expect, it } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import { ThemeContext, type Theme } from "@/components/ThemeProvider";
import {
  THEME_COLOR_TOKENS,
  WCAG_AA_NORMAL_TEXT_MIN_RATIO,
  auditThemeTokenContrast,
  getContrastRatio,
  getRelativeLuminance,
  parseHexColor,
  useTheme,
} from "@/hooks/useTheme";

describe("useTheme & WCAG 2.1 AA Dark Mode Contrast Ratio Audit (#1557)", () => {
  it("throws when useTheme is called outside ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within a ThemeProvider"
    );
  });

  it("returns the active theme context when inside ThemeProvider", () => {
    const mockValue = {
      theme: "dark" as Theme,
      toggleTheme: () => {},
      setTheme: () => {},
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
      expect(
        item.ratio,
        `Dark token "${item.token}" (${item.foreground} on ${item.background}) had ratio ${item.ratio}:1 < 4.5:1`
      ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
      expect(item.passesAA).toBe(true);
    }
  });

  it("guarantees >= 4.5:1 WCAG 2.1 AA contrast ratio across all light mode theme tokens", () => {
    const report = auditThemeTokenContrast("light");
    expect(report.passesAll).toBe(true);

    for (const item of report.items) {
      expect(
        item.ratio,
        `Light token "${item.token}" (${item.foreground} on ${item.background}) had ratio ${item.ratio}:1 < 4.5:1`
      ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
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
});
