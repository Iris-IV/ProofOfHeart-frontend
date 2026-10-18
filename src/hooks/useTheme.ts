"use client";

import { useContext } from "react";
import { ThemeContext, type Theme } from "../components/ThemeProvider";

export type { Theme };

export interface ThemeColorTokens {
  background: string;
  foreground: string;
  muted: string;
  mutedStrong: string;
  brand: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export interface TokenContrastReportItem {
  token: keyof Omit<ThemeColorTokens, "background">;
  foreground: string;
  background: string;
  ratio: number;
  passesAA: boolean;
}

export interface ThemeContrastAuditReport {
  theme: Theme;
  minimumRatio: number;
  passesAll: boolean;
  items: TokenContrastReportItem[];
}

/**
 * WCAG 2.1 AA minimum contrast ratio for normal body text (4.5:1).
 */
export const WCAG_AA_NORMAL_TEXT_MIN_RATIO = 4.5;

/**
 * Theme color tokens for light and dark modes audited to ensure every
 * foreground/semantic text token achieves at least a 4.5:1 contrast ratio
 * against its corresponding theme background (`#ffffff` in light mode,
 * `#0a0a0a` in dark mode).
 */
export const THEME_COLOR_TOKENS: Record<Theme, ThemeColorTokens> = {
  light: {
    background: "#ffffff",
    foreground: "#171717",
    muted: "#52525b", // zinc-600 (7.05:1 on #ffffff)
    mutedStrong: "#3f3f46", // zinc-700 (10.30:1 on #ffffff)
    brand: "#2563eb", // blue-600 (5.17:1 on #ffffff)
    accent: "#7c3aed", // violet-600 (5.70:1 on #ffffff)
    success: "#15803d", // green-700 (5.02:1 on #ffffff)
    warning: "#b45309", // amber-700 (5.02:1 on #ffffff)
    danger: "#dc2626", // red-600 (4.83:1 on #ffffff)
    info: "#0369a1", // sky-700 (5.93:1 on #ffffff)
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#ededed", // 16.59:1 on #0a0a0a
    muted: "#a1a1aa", // zinc-400 (7.57:1 on #0a0a0a)
    mutedStrong: "#f4f4f5", // zinc-100 (17.51:1 on #0a0a0a)
    brand: "#60a5fa", // blue-400 (7.49:1 on #0a0a0a)
    accent: "#c084fc", // purple-400 (7.37:1 on #0a0a0a)
    success: "#4ade80", // green-400 (11.17:1 on #0a0a0a)
    warning: "#fbbf24", // amber-400 (11.79:1 on #0a0a0a)
    danger: "#f87171", // red-400 (6.80:1 on #0a0a0a)
    info: "#38bdf8", // sky-400 (9.46:1 on #0a0a0a)
  },
};

/**
 * Parses a `#rgb` or `#rrggbb` hex string into `[r, g, b]` channel values (`0..255`).
 */
export function parseHexColor(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return [r, g, b];
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return [r, g, b];
  }
  throw new Error(`Invalid hex color: "${hex}"`);
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Computes WCAG 2.1 relative luminance (`0..1`) for a hex color.
 */
export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex);
  const R = channelToLinear(r);
  const G = channelToLinear(g);
  const B = channelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Computes WCAG 2.1 contrast ratio (`1..21`) between two hex colors.
 */
export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = getRelativeLuminance(foregroundHex);
  const l2 = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Audits all foreground/semantic tokens for the given theme against its
 * background token and verifies that every pair meets `minimumRatio`
 * (defaults to `WCAG_AA_NORMAL_TEXT_MIN_RATIO` = `4.5`).
 */
export function auditThemeTokenContrast(
  theme: Theme,
  tokens: ThemeColorTokens = THEME_COLOR_TOKENS[theme],
  minimumRatio: number = WCAG_AA_NORMAL_TEXT_MIN_RATIO
): ThemeContrastAuditReport {
  const tokenKeys: Array<keyof Omit<ThemeColorTokens, "background">> = [
    "foreground",
    "muted",
    "mutedStrong",
    "brand",
    "accent",
    "success",
    "warning",
    "danger",
    "info",
  ];

  const items: TokenContrastReportItem[] = tokenKeys.map((key) => {
    const fg = tokens[key];
    const ratio = getContrastRatio(fg, tokens.background);
    return {
      token: key,
      foreground: fg,
      background: tokens.background,
      ratio,
      passesAA: ratio >= minimumRatio,
    };
  });

  return {
    theme,
    minimumRatio,
    passesAll: items.every((item) => item.passesAA),
    items,
  };
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
