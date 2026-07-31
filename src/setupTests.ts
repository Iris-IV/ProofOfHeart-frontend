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
}));

jest.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values?.count === 1 ? `${key}_one` : key,
  useLocale: () => "en",
}));

// Mock StellarSdk to avoid RPC Server instantiation issues in tests
jest.mock("@stellar/stellar-sdk", () => {
  const original = jest.requireActual("@stellar/stellar-sdk");
  return {
    __esModule: true,
    ...original,
    rpc: {
      ...(original.rpc || {}),
      Server: class MockServer {
        getLatestLedger = jest.fn().mockResolvedValue({ sequence: 100 });
        getEvents = jest.fn().mockResolvedValue({ events: [] });
      }
    }
  };
});
