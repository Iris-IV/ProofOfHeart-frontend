/**
 * Joins class names, dropping falsy values.
 *
 * Deliberately dependency-free — the project has no `clsx`/`classnames`, and a
 * three-line helper is not worth a new dependency. It does NOT de-duplicate
 * conflicting Tailwind utilities: primitives put their own classes first and
 * append the caller's `className` last, so the caller wins by source order.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
