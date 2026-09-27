/**
 * PostCSS configuration for ProofOfHeart frontend.
 *
 * Uses Tailwind CSS v4 which includes built-in optimizations:
 * - Automatic vendor prefixing via Lightning CSS
 * - CSS minification in production builds
 * - Dead code elimination
 * - Modern CSS features transpilation
 *
 * No additional plugins needed - Tailwind v4 handles optimization internally.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
