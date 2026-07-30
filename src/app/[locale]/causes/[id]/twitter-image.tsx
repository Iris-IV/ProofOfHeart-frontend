/**
 * #642 — Mirror the campaign Open Graph card onto `twitter:image` so X and
 * Slack render the same 1200x630 PNG that iMessage and Facebook receive.
 *
 * `runtime` and `revalidate` are route segment config: Next parses them
 * statically and rejects a re-export, so they are restated here to match
 * `opengraph-image.tsx`.
 */
export const runtime = "edge";
export const revalidate = 300;

export { default, alt, size, contentType } from "./opengraph-image";
