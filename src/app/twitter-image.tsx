/**
 * #642 — X/Twitter reads `twitter:image` and ignores `og:image` when a
 * `twitter:card` is declared. Reuse the same 1200x630 PNG so the two tags can
 * never drift apart.
 */
export { default, alt, size, contentType } from "./opengraph-image";
