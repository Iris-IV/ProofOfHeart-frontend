import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";
import type React from "react";

globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder;

// Global mock for Freighter API (v6.x returns objects, not primitives)
jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn().mockResolvedValue({ isConnected: false }),
  isAllowed: jest.fn().mockResolvedValue({ isAllowed: false }),
  getAddress: jest.fn().mockResolvedValue({ address: "" }),
  getNetwork: jest.fn().mockResolvedValue({ network: "", networkPassphrase: "" }),
  WatchWalletChanges: jest.fn().mockImplementation(() => ({
    watch: jest.fn(),
    stop: jest.fn(),
  })),
}));

jest.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values?.count === 1 ? `${key}_one` : key,
  useLocale: () => "en",
}));
