import "@testing-library/jest-dom";
import type React from "react";

// Global mock for Freighter API
jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn(),
  isAllowed: jest.fn(),
  getAddress: jest.fn(),
}));

jest.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useTranslations:
    () =>
    (key: string, values?: Record<string, string | number>) =>
      values?.count === 1 ? `${key}_one` : key,
}));
