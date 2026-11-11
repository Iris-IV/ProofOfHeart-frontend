import { getItem, setItem, getRawItem, setRawItem } from "./localStorageStore";

export type NotificationFrequency = "instant" | "daily" | "weekly";
export type NotificationChannel = "inApp" | "email";

export interface NotificationPreferences {
  contributions: boolean;
  verified: boolean;
  refundAvailable: boolean;
  revenueDeposited: boolean;
  frequency: NotificationFrequency;
  channels: NotificationChannel[];
}

const STORAGE_KEY_PREFIX = "notif_prefs_";
const VALID_FREQUENCIES: NotificationFrequency[] = ["instant", "daily", "weekly"];
const VALID_CHANNELS: NotificationChannel[] = ["inApp", "email"];

const DEFAULTS: NotificationPreferences = Object.freeze<NotificationPreferences>({
  contributions: true,
  verified: true,
  refundAvailable: true,
  revenueDeposited: true,
  frequency: "instant",
  channels: ["inApp"],
});

function isNotificationFrequency(value: unknown): value is NotificationFrequency {
  return typeof value === "string" && VALID_FREQUENCIES.includes(value as NotificationFrequency);
}

function isNotificationChannels(value: unknown): value is NotificationChannel[] {
  return (
    Array.isArray(value) &&
    value.every((channel) => VALID_CHANNELS.includes(channel as NotificationChannel))
  );
}

export function getNotificationPreferences(walletAddress: string): NotificationPreferences {
  const key = `${STORAGE_KEY_PREFIX}${walletAddress.trim().toLowerCase()}`;
  const parsed = getItem<Partial<NotificationPreferences>>(key) ?? {};

  return {
    ...DEFAULTS,
    ...parsed,
    frequency: isNotificationFrequency(parsed?.frequency) ? parsed.frequency : DEFAULTS.frequency,
    channels: isNotificationChannels(parsed?.channels) ? parsed.channels : DEFAULTS.channels,
  };
}

export function setNotificationPreferences(
  walletAddress: string,
  prefs: NotificationPreferences,
): void {
  const normalizedWallet = walletAddress.trim();
  if (!normalizedWallet) {
    throw new Error("Wallet address is required");
  }

  const nextPrefs: NotificationPreferences = {
    ...prefs,
    channels: prefs.channels.filter((channel): channel is NotificationChannel =>
      VALID_CHANNELS.includes(channel),
    ),
  };

  setItem(`${STORAGE_KEY_PREFIX}${normalizedWallet.toLowerCase()}`, nextPrefs);
}

export const THEME_STORAGE_KEY = "theme";
export const HIGH_CONTRAST_STORAGE_KEY = "highContrast";
export const LOCALE_STORAGE_KEY = "locale";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): Theme | null {
  const stored = getRawItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : null;
}

export function writeStoredTheme(theme: Theme): void {
  setRawItem(THEME_STORAGE_KEY, theme);
}

export function resolveThemeFromSystem(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? resolveThemeFromSystem();
}

export function hasStoredTheme(): boolean {
  return readStoredTheme() !== null;
}

export function resolveInitialHighContrast(): boolean {
  const stored = getRawItem(HIGH_CONTRAST_STORAGE_KEY);
  if (stored === "true" || stored === "false") return stored === "true";
  return typeof window !== "undefined" && window.matchMedia("(prefers-contrast: more)").matches;
}

export function writeHighContrast(enabled: boolean): void {
  setRawItem(HIGH_CONTRAST_STORAGE_KEY, String(enabled));
}

export function writeLocalePreference(locale: string): void {
  const normalized = locale.trim();
  if (!normalized) return;

  setRawItem(LOCALE_STORAGE_KEY, normalized);

  if (typeof document !== "undefined") {
    // `Secure` cookies are dropped by browsers (and jsdom) over plain http, so
    // only add the flag on https — otherwise the locale never persists on
    // localhost / http deployments.
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(normalized)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  }
}

export function readStoredLocale(): string | null {
  return getRawItem(LOCALE_STORAGE_KEY);
}

/** Inline script applied before React hydrates to avoid theme FOUC. */
export function getThemeBlockingScript(): string {
  return `
    (function () {
      let storedTheme = null;
      let storedContrast = null;
      try {
        const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
        storedTheme = window.localStorage.getItem(storageKey);
        storedContrast = window.localStorage.getItem(${JSON.stringify(HIGH_CONTRAST_STORAGE_KEY)});
      } catch {
        // Storage may be disabled or blocked. Graceful fallback.
      }
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const highContrast = storedContrast === "true" ||
        (storedContrast !== "false" && window.matchMedia("(prefers-contrast: more)").matches);
      const validTheme = storedTheme === "light" || storedTheme === "dark";
      const isDark = !highContrast && (storedTheme === "dark" || (!validTheme && prefersDark));
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      document.documentElement.dataset.contrast = highContrast ? "high" : "standard";
    })();
  `;
}

/** Minimum touch target size in pixels compliant with WCAG 2.1 Success Criterion 2.5.5 / 2.5.8 */
export const MIN_TOUCH_TARGET_SIZE_PX = 44;

export function isAccessibleTouchTarget(width: number, height: number): boolean {
  return width >= MIN_TOUCH_TARGET_SIZE_PX && height >= MIN_TOUCH_TARGET_SIZE_PX;
}

export function getTouchTargetStyles(): { minWidth: string; minHeight: string } {
  return {
    minWidth: `${MIN_TOUCH_TARGET_SIZE_PX}px`,
    minHeight: `${MIN_TOUCH_TARGET_SIZE_PX}px`,
  };
}

/** Snappy modal & backdrop micro-interaction duration (<150ms) (#1343). */
export const MODAL_ANIMATION_DURATION_MS = 120;

export const MODAL_FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

export const MODAL_FORM_FIELD_SELECTOR =
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"])';

export type ModalBreakpointTier = "mobile" | "tablet" | "desktop";

export const MODAL_BREAKPOINTS: Record<ModalBreakpointTier, number> = {
  mobile: 320,
  tablet: 768,
  desktop: 1280,
};

export interface ModalGlassTokens {
  backdropFill: string;
  backdropBlur: string;
  surfaceFillLight: string;
  surfaceFillDark: string;
  glassGradientHighlight: string;
  backdropTransitionCss: string;
  panelAnimationDurationMs: number;
}

export const MODAL_GLASS_TOKENS: ModalGlassTokens = Object.freeze({
  backdropFill: "rgba(9, 9, 11, 0.6)",
  backdropBlur: "blur(12px) saturate(150%)",
  surfaceFillLight: "rgba(255, 255, 255, 0.92)",
  surfaceFillDark: "rgba(24, 24, 27, 0.92)",
  glassGradientHighlight:
    "linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(124, 58, 237, 0.14), rgba(21, 128, 61, 0.1))",
  backdropTransitionCss: `opacity ${MODAL_ANIMATION_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), backdrop-filter ${MODAL_ANIMATION_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
  panelAnimationDurationMs: MODAL_ANIMATION_DURATION_MS,
});

export interface ResponsiveModalLayoutConfig {
  tier: ModalBreakpointTier;
  viewportWidth: number;
  maxWidthPx: number;
  paddingPx: number;
  borderRadiusRem: number;
  backdropBlurPx: number;
  animationDurationMs: number;
  sheetPresentation: "bottom-sheet" | "centered-dialog";
}

/**
 * Computes responsive modal dialog layout and animation tokens across mobile (320px),
 * tablet (768px), and desktop (1280px+) screen widths (#1343).
 */
export function getResponsiveModalLayoutConfig(
  viewportWidth: number,
  options: { prefersReducedMotion?: boolean; highContrast?: boolean } = {},
): ResponsiveModalLayoutConfig {
  const safeWidth = Math.max(MODAL_BREAKPOINTS.mobile, Math.round(viewportWidth || 0));
  const tier: ModalBreakpointTier =
    safeWidth >= MODAL_BREAKPOINTS.desktop
      ? "desktop"
      : safeWidth >= MODAL_BREAKPOINTS.tablet
        ? "tablet"
        : "mobile";

  const prefersReducedMotion = options.prefersReducedMotion ?? false;
  const highContrast = options.highContrast ?? false;

  const maxWidthPx = tier === "desktop" ? 560 : tier === "tablet" ? 480 : safeWidth - 32;
  const paddingPx = tier === "desktop" ? 28 : tier === "tablet" ? 24 : 16;
  const borderRadiusRem = tier === "mobile" ? 1.25 : 1;
  const backdropBlurPx = highContrast ? 0 : tier === "desktop" ? 16 : 12;

  return {
    tier,
    viewportWidth: safeWidth,
    maxWidthPx,
    paddingPx,
    borderRadiusRem,
    backdropBlurPx,
    animationDurationMs: prefersReducedMotion ? 0 : MODAL_ANIMATION_DURATION_MS,
    sheetPresentation: tier === "mobile" ? "bottom-sheet" : "centered-dialog",
  };
}

function isElementVisibleForFocusTrap(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
  if (el.closest('[aria-hidden="true"], [hidden]')) return false;
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

/**
 * Returns all currently focusable, visible elements inside a modal container (#1343).
 */
export function getFocusableModalElements(container: ParentNode | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)).filter(
    isElementVisibleForFocusTrap,
  );
}

/**
 * Resolves the initial focus target when opening a modal dialog (#1343).
 * Prefers an explicit ref target, then the first visible form field, then the first
 * focusable element, and finally the modal container itself.
 */
export function resolveInitialModalFocusTarget(
  container: HTMLElement | null,
  explicitTarget?: HTMLElement | null,
): HTMLElement | null {
  if (explicitTarget && isElementVisibleForFocusTrap(explicitTarget)) {
    return explicitTarget;
  }
  if (!container) return null;

  const formFields = Array.from(
    container.querySelectorAll<HTMLElement>(MODAL_FORM_FIELD_SELECTOR),
  ).filter(isElementVisibleForFocusTrap);
  if (formFields.length > 0) {
    return formFields[0];
  }

  const focusable = getFocusableModalElements(container);
  if (focusable.length > 0) {
    return focusable[0];
  }

  return container;
}

/**
 * Computes the next element to receive focus when cycling with Tab / Shift+Tab inside
 * a modal focus trap (#1343). Returns `null` when default browser tabbing should proceed.
 */
export function computeNextFocusTrapTarget(
  focusableElements: HTMLElement[],
  activeElement: Element | null,
  shiftKey: boolean,
  scope?: Node | null,
): HTMLElement | null {
  if (focusableElements.length === 0) return null;

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  const isOutsideScope = scope ? !scope.contains(activeElement) : false;

  if (shiftKey) {
    if (activeElement === first || isOutsideScope) {
      return last;
    }
    return null;
  }

  if (activeElement === last || isOutsideScope) {
    return first;
  }

  return null;
}
