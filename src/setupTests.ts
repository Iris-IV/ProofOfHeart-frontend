import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";
import type React from "react";

globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder;

// Global mock for Freighter API
jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn(),
  isAllowed: jest.fn(),
  getAddress: jest.fn(),
}));

jest.mock("next-intl", () => {
  // Load real English messages so components render actual strings in tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messages = require("../messages/en.json") as Record<string, Record<string, string>>;

  // Flatten all namespaces into one lookup map keyed by "key" or "Namespace.key"
  const flat: Record<string, string> = {};
  for (const [ns, vals] of Object.entries(messages)) {
    if (typeof vals === "object" && vals !== null) {
      for (const [k, v] of Object.entries(vals)) {
        if (typeof v === "string") {
          flat[`${ns}.${k}`] = v;
          flat[k] = v; // also allow bare key lookups
        }
      }
    }
  }

  function resolve(key: string, values?: Record<string, string | number>): string {
    const template = flat[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)[^}]*\}/g, (_, name) =>
      values[name] !== undefined ? String(values[name]) : `{${name}}`,
    );
  }

  return {
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
    useTranslations: (namespace?: string) => (key: string, values?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return resolve(fullKey, values) ?? resolve(key, values);
    },
    useLocale: () => "en",
  };
});
