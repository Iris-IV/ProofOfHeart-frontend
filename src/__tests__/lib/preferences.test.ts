import {
  getThemeBlockingScript,
  hasStoredTheme,
  isTheme,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  readStoredTheme,
  resolveInitialTheme,
  resolveThemeFromSystem,
  THEME_STORAGE_KEY,
  writeLocalePreference,
  writeStoredTheme,
} from "@/lib/preferences";

describe("preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${LOCALE_COOKIE_NAME}=; path=/; max-age=0`;
  });

  describe("isTheme", () => {
    it("accepts light and dark", () => {
      expect(isTheme("light")).toBe(true);
      expect(isTheme("dark")).toBe(true);
    });

    it("rejects unknown values", () => {
      expect(isTheme("system")).toBe(false);
      expect(isTheme(null)).toBe(false);
    });
  });

  describe("theme persistence", () => {
    it("reads and writes stored theme", () => {
      writeStoredTheme("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      expect(readStoredTheme()).toBe("dark");
      expect(hasStoredTheme()).toBe(true);
    });

    it("falls back to system preference when nothing is stored", () => {
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query.includes("dark"),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      expect(resolveThemeFromSystem()).toBe("dark");
      expect(resolveInitialTheme()).toBe("dark");
      expect(hasStoredTheme()).toBe(false);
    });
  });

  describe("locale persistence", () => {
    it("writes locale to localStorage and cookie", () => {
      writeLocalePreference("es");

      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("es");
      expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=es`);
    });

    it("reads stored locale", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "en");
      expect(readStoredLocale()).toBe("en");
    });
  });

  describe("getThemeBlockingScript", () => {
    it("references the theme storage key", () => {
      expect(getThemeBlockingScript()).toContain(THEME_STORAGE_KEY);
      expect(getThemeBlockingScript()).toContain("prefers-color-scheme");
    });
  });

  it("uses a one-year cookie max age for locale preference", () => {
    expect(LOCALE_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });
});
