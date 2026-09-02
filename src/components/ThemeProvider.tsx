"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  hasStoredTheme,
  resolveInitialTheme,
  writeStoredTheme,
  type Theme,
} from "@/lib/preferences";

export type { Theme };

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>("light");
  const [hasExplicitChoice, setHasExplicitChoice] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(resolveInitialTheme());
    setHasExplicitChoice(hasStoredTheme());
    setMounted(true);
  }, []);

  const useSafeLayoutEffect =
    typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

  useSafeLayoutEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, mounted]);

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

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
};
