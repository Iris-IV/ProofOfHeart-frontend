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
