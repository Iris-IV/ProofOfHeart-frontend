# Turbopack Transition

As of Next.js 16, Turbopack is the default bundler for both development and production builds. 

## Bundler Configuration

Previously, the `package.json` build script forced the legacy Webpack bundler using the `--webpack` flag:

```json
"build": "next build --webpack"
```

This flag has been removed to leverage the performance benefits of Turbopack.

## Reverting to Webpack

If a future dependency or configuration (e.g., a custom Webpack plugin) requires the legacy bundler, you can opt back in by adding the `--webpack` flag back to the build script in `package.json`:

```bash
npm run build -- --webpack
# or update package.json
"build": "next build --webpack"
```

## Known Blockers

No blockers were found in the current `next.config.ts` or project structure. If a build error occurs specifically with Turbopack, please document it here.
