"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  hasStoredTheme,
  HIGH_CONTRAST_STORAGE_KEY,
  resolveInitialHighContrast,
  resolveInitialTheme,
  writeHighContrast,
  writeStoredTheme,
  type Theme,
} from "@/lib/preferences";

export type { Theme };

/** Duration of the colour cross-fade applied when the theme switches (kept under 150ms feel budget). */
const THEME_TRANSITION_MS = 140;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>("light");
  const [hasExplicitChoice, setHasExplicitChoice] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [highContrast, setHighContrastState] = useState(false);
  const hasAppliedThemeRef = useRef(false);
  const transitionTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setThemeState(resolveInitialTheme());
    setHasExplicitChoice(hasStoredTheme());
    setHighContrastState(resolveInitialHighContrast());
    setMounted(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-contrast: more)");
    const update = () => setHighContrastState(resolveInitialHighContrast());
    const onStorage = (event: StorageEvent) => {
      if (event.key === HIGH_CONTRAST_STORAGE_KEY || event.key === null) update();
    };
    media.addEventListener("change", update);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const useSafeLayoutEffect =
    typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

  useSafeLayoutEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    const isDark = theme === "dark" && !highContrast;

    // Cross-fade colours on user-initiated switches only. The first apply is
    // the initial paint, and reduced-motion users get an instant change.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (hasAppliedThemeRef.current && !reduceMotion) {
      window.clearTimeout(transitionTimerRef.current);
      root.classList.add("theme-transition");
      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove("theme-transition");
      }, THEME_TRANSITION_MS + 40);
    }
    hasAppliedThemeRef.current = true;

    root.dataset.theme = isDark ? "dark" : "light";
    root.dataset.contrast = highContrast ? "high" : "standard";
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, mounted, highContrast]);

  useEffect(() => {
    return () => window.clearTimeout(transitionTimerRef.current);
  }, []);

  useEffect(() => {
    if (hasExplicitChoice) {
      writeStoredTheme(theme);
    }
  }, [theme, hasExplicitChoice]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    setHasExplicitChoice(true);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled);
    writeHighContrast(enabled);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, highContrast, setHighContrast }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
};
