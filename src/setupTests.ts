import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";
import type React from "react";

globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder;

// jsdom does not implement matchMedia — stub it so components that use
// motion / framer-motion don't throw.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// jsdom does not implement Intl.DisplayNames — stub it so locale-aware
// components can render their language labels in tests.
if (typeof Intl.DisplayNames === "undefined") {
  Object.defineProperty(Intl, "DisplayNames", {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      of: (code: string) => {
        const map: Record<string, string> = { en: "English", es: "Spanish" };
        return map[code] ?? code.toUpperCase();
      },
    })),
  });
}

// Global mock for Freighter API (v6.x returns objects, not primitives)
jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn().mockResolvedValue({ isConnected: false }),
  isAllowed: jest.fn().mockResolvedValue({ isAllowed: false }),
  getAddress: jest.fn().mockResolvedValue({ address: "" }),
  getNetwork: jest.fn().mockResolvedValue({ network: "", networkPassphrase: "" }),
}));

jest.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values?.count === 1 ? `${key}_one` : key,
  useLocale: () => "en",
}));
