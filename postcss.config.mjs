/**
 * PostCSS configuration for ProofOfHeart frontend.
 *
 * Uses Tailwind CSS v4 which includes built-in optimizations:
 * - Automatic vendor prefixing via Lightning CSS
 * - CSS minification in production builds
 * - Dead code elimination
 * - Modern CSS features transpilation
 * - CSS custom properties optimization
 * - Automatic nesting transformation
 *
 * Tailwind v4 consolidates styling rules into clean utility classes
 * and eliminates duplicate CSS through its JIT engine.
 *
 * No additional plugins needed - Tailwind v4 handles optimization internally.
 * The Lightning CSS compiler provides faster builds and smaller bundles
 * compared to traditional PostCSS pipelines.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
