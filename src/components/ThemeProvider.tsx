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
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme());
  const [hasExplicitChoice, setHasExplicitChoice] = useState(() => hasStoredTheme());

  const useSafeLayoutEffect =
    typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

  useSafeLayoutEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

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
