/**
 * Missing-translation guard
 *
 * Ensures every key present in the reference locale (en) also exists in every
 * other supported locale, and that no value is an empty string.
 * A failing test here means a raw key (e.g. "Admin.contractAdmin") would be
 * rendered in production instead of a real translation.
 */

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

type Messages = Record<string, unknown>;

/** Flatten a nested messages object into dot-separated keys, e.g. "Admin.title" */
function flattenKeys(messages: Messages): string[] {
  const keys: string[] = [];
  for (const [namespace, value] of Object.entries(messages)) {
    if (typeof value === "object" && value !== null) {
      for (const [key, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof subValue === "object" && subValue !== null) {
          for (const [subKey, _subSubValue] of Object.entries(
            subValue as Record<string, unknown>,
          )) {
            keys.push(`${namespace}.${key}.${subKey}`);
          }
        } else {
          keys.push(`${namespace}.${key}`);
        }
      }
    }
  }
  return keys;
}

/** Collect keys present in `reference` but missing from `target` */
function missingKeys(reference: Messages, target: Messages): string[] {
  const refKeys = flattenKeys(reference);
  const targetKeys = flattenKeys(target);
  return refKeys.filter((dotKey) => !targetKeys.includes(dotKey));
}

/** Collect keys whose value is an empty string in `target` */
function emptyKeys(target: Messages): string[] {
  const keys: string[] = [];
  for (const [namespace, value] of Object.entries(target)) {
    if (typeof value === "object" && value !== null) {
      for (const [key, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof subValue === "object" && subValue !== null) {
          for (const [_subKey, subSubValue] of Object.entries(
            subValue as Record<string, unknown>,
          )) {
            if (subSubValue === "") keys.push(`${namespace}.${key}`);
          }
        } else if (subValue === "") {
          keys.push(`${namespace}.${key}`);
        }
      }
    }
  }
  return keys;
}

const locales: Array<{ name: string; messages: Messages }> = [
  { name: "es", messages: es as Messages },
];

describe("i18n – no missing or empty translation keys", () => {
  for (const { name, messages } of locales) {
    describe(`locale: ${name}`, () => {
      it("has no keys missing compared to en", () => {
        const missing = missingKeys(en as Messages, messages);
        expect(missing).toEqual([]);
      });

      it("has no empty-string values", () => {
        const empty = emptyKeys(messages);
        expect(empty).toEqual([]);
      });
    });
  }

  describe("locale: en (reference)", () => {
    it("has no empty-string values", () => {
      const empty = emptyKeys(en as Messages);
      expect(empty).toEqual([]);
    });
  });
});
