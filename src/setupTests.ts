import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";
import React from "react";

globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder;

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

// react-markdown ships ESM this Jest setup does not transform, so the markdown
// renderer is stubbed globally.
jest.mock("@/components/SafeMarkdown", () => ({
  __esModule: true,
  default: ({ children, className }: { children: string; className?: string }) => {
    return React.createElement("div", { "data-testid": "safe-markdown", className }, children);
  }
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
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