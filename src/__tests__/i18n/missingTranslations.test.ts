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

type Messages = Record<string, Record<string, string>>;

/** Flatten a nested messages object into dot-separated keys, e.g. "Admin.title" */
function flattenKeys(messages: Messages): string[] {
  return Object.entries(messages).flatMap(([namespace, keys]) =>
    Object.keys(keys).map((key) => `${namespace}.${key}`),
  );
}

/** Collect keys present in `reference` but missing from `target` */
function missingKeys(reference: Messages, target: Messages): string[] {
  return flattenKeys(reference).filter((dotKey) => {
    const [namespace, key] = dotKey.split(".");
    return target[namespace]?.[key] === undefined;
  });
}

/** Collect keys whose value is an empty string in `target` */
function emptyKeys(target: Messages): string[] {
  return flattenKeys(target).filter((dotKey) => {
    const [namespace, key] = dotKey.split(".");
    return target[namespace]?.[key] === "";
  });
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
