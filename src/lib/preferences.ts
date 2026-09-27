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

const DEFAULTS: NotificationPreferences = {
  contributions: true,
  verified: true,
  refundAvailable: true,
  revenueDeposited: true,
  frequency: "instant",
  channels: ["inApp"],
};

export function getNotificationPreferences(walletAddress: string): NotificationPreferences {
  const key = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
  const parsed = getItem<Partial<NotificationPreferences>>(key);
  return { ...DEFAULTS, ...parsed, channels: parsed?.channels ?? DEFAULTS.channels };
}

export function setNotificationPreferences(
  walletAddress: string,
  prefs: NotificationPreferences,
): void {
  const key = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
  setItem(key, prefs);
}

export const THEME_STORAGE_KEY = "theme";
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

export function writeLocalePreference(locale: string): void {
  setRawItem(LOCALE_STORAGE_KEY, locale);
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  }
}

export function readStoredLocale(): string | null {
  return getRawItem(LOCALE_STORAGE_KEY);
}

/** Inline script applied before React hydrates to avoid theme FOUC. */
export function getThemeBlockingScript(): string {
  return `(function(){try{var stored=localStorage.getItem('${THEME_STORAGE_KEY}');var isDark=stored==='dark'||(!stored&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(isDark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;
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
