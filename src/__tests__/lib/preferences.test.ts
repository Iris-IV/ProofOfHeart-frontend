import {
  getThemeBlockingScript,
  hasStoredTheme,
  isTheme,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  readStoredLocale,
  readStoredTheme,
  resolveInitialTheme,
  resolveThemeFromSystem,
  THEME_STORAGE_KEY,
  writeLocalePreference,
  writeStoredTheme,
  HIGH_CONTRAST_STORAGE_KEY,
  resolveInitialHighContrast,
  writeHighContrast,
  MODAL_ANIMATION_DURATION_MS,
  MODAL_GLASS_TOKENS,
  getResponsiveModalLayoutConfig,
  getFocusableModalElements,
  resolveInitialModalFocusTarget,
  computeNextFocusTrapTarget,
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

      expect(readStoredLocale()).toBe("es");
      expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=es`);
    });

    it("reads stored locale", () => {
      writeLocalePreference("en");
      expect(readStoredLocale()).toBe("en");
    });
  });

  describe("high contrast persistence", () => {
    it("uses the system preference until the user makes an explicit choice", () => {
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-contrast"),
      }));
      expect(resolveInitialHighContrast()).toBe(true);
      writeHighContrast(false);
      expect(resolveInitialHighContrast()).toBe(false);
      expect(localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY)).toBe("false");
      writeHighContrast(true);
      expect(resolveInitialHighContrast()).toBe(true);
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

  describe("accessible modal animations and dynamic focus trap utilities (#1343)", () => {
    it("exposes snappy (<150ms) modal glassmorphism tokens and gradient highlights", () => {
      expect(MODAL_ANIMATION_DURATION_MS).toBeLessThan(150);
      expect(MODAL_GLASS_TOKENS.panelAnimationDurationMs).toBe(MODAL_ANIMATION_DURATION_MS);
      expect(MODAL_GLASS_TOKENS.backdropBlur).toContain("blur(");
      expect(MODAL_GLASS_TOKENS.glassGradientHighlight).toContain("linear-gradient");
    });

    it("resolves responsive modal layout configs across mobile (320px), tablet (768px), and desktop (1280px+)", () => {
      const mobile = getResponsiveModalLayoutConfig(320);
      const tablet = getResponsiveModalLayoutConfig(768);
      const desktop = getResponsiveModalLayoutConfig(1280);
      const reduced = getResponsiveModalLayoutConfig(1280, {
        prefersReducedMotion: true,
        highContrast: true,
      });

      expect(mobile.tier).toBe("mobile");
      expect(mobile.sheetPresentation).toBe("bottom-sheet");
      expect(mobile.animationDurationMs).toBe(MODAL_ANIMATION_DURATION_MS);

      expect(tablet.tier).toBe("tablet");
      expect(tablet.sheetPresentation).toBe("centered-dialog");
      expect(tablet.maxWidthPx).toBeGreaterThan(mobile.maxWidthPx);

      expect(desktop.tier).toBe("desktop");
      expect(desktop.maxWidthPx).toBeGreaterThan(tablet.maxWidthPx);

      expect(reduced.animationDurationMs).toBe(0);
      expect(reduced.backdropBlurPx).toBe(0);
    });

    it("filters hidden and disabled elements and computes focus-trap wrap targets", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <button id="first">First</button>
        <button id="hidden" hidden>Hidden</button>
        <div aria-hidden="true"><button id="aria-hidden-btn">Inert</button></div>
        <input id="field" type="text" />
        <button id="last">Last</button>
      `;

      const focusable = getFocusableModalElements(container);
      expect(focusable.map((el) => el.id)).toEqual(["first", "field", "last"]);

      // Initial focus prefers the visible form field
      expect(resolveInitialModalFocusTarget(container)?.id).toBe("field");

      // Tab at last element wraps to first
      expect(computeNextFocusTrapTarget(focusable, focusable[2], false, container)?.id).toBe(
        "first",
      );

      // Shift+Tab at first element wraps to last
      expect(computeNextFocusTrapTarget(focusable, focusable[0], true, container)?.id).toBe("last");

      // Middle element allows normal browser tabbing
      expect(computeNextFocusTrapTarget(focusable, focusable[1], false, container)).toBeNull();
    });
  });
});
