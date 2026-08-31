/**
 * #634 — Defense against prototype pollution in the markdown rendering path.
 *
 * `react-markdown` turns untrusted markdown into a hast tree and then spreads
 * each node's `properties` onto React elements. A crafted payload can smuggle
 * `__proto__`, `constructor`, or `prototype` keys into that property bag (for
 * example through a raw attribute name), and older parsers have historically
 * copied such keys onto plain objects, mutating `Object.prototype` for the
 * whole runtime.
 *
 * This module strips those keys defensively — both when merging the sanitize
 * schema and, at render time, from every hast node — so no attacker-controlled
 * markdown can reach a prototype-polluting assignment regardless of parser
 * version.
 */

/** Keys that can walk up an object's prototype chain and pollute it. */
export const PROTOTYPE_POLLUTION_KEYS = ["__proto__", "constructor", "prototype"] as const;

const DANGEROUS_KEY_SET = new Set<string>(PROTOTYPE_POLLUTION_KEYS);

/** True for a value we should recurse into (plain object or array). */
function isTraversable(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

/**
 * Recursively remove prototype-polluting own keys from a value.
 *
 * Returns a structurally cleaned copy: objects are rebuilt so that a key such
 * as `__proto__` can never survive as a real, enumerable own property. Arrays
 * are cleaned element-by-element. Non-objects are returned untouched.
 */
export function stripPrototypePollutionKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripPrototypePollutionKeys(item)) as unknown as T;
  }

  if (isTraversable(value)) {
    const cleaned: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEY_SET.has(key)) continue;
      cleaned[key] = stripPrototypePollutionKeys((value as Record<string, unknown>)[key]);
    }
    return cleaned as unknown as T;
  }

  return value;
}

interface HastNodeLike {
  type?: string;
  properties?: Record<string, unknown> | null;
  children?: unknown;
  [key: string]: unknown;
}

/** Delete dangerous own keys from a single object in place. */
function deleteDangerousKeys(obj: Record<string, unknown>): void {
  for (const key of PROTOTYPE_POLLUTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      delete obj[key];
    }
  }
}

/** Walk a hast node tree, scrubbing `properties` on every element. */
export function scrubHastTree(node: unknown): void {
  if (Array.isArray(node)) {
    for (const child of node) scrubHastTree(child);
    return;
  }

  if (!isTraversable(node)) return;

  const hastNode = node as HastNodeLike;

  if (hastNode.properties && typeof hastNode.properties === "object") {
    deleteDangerousKeys(hastNode.properties as Record<string, unknown>);
  }

  if (Array.isArray(hastNode.children)) {
    for (const child of hastNode.children) scrubHastTree(child);
  }
}

/**
 * rehype plugin: scrubs prototype-polluting keys from the hast tree after
 * sanitization, right before `react-markdown` maps properties onto elements.
 */
export function rehypeNoPrototypePollution() {
  return (tree: unknown) => {
    scrubHastTree(tree);
    return tree;
  };
}

export default rehypeNoPrototypePollution;
