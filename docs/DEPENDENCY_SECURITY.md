# Dependency Security

How this repo keeps its dependency tree free of known high-severity vulnerabilities,
and what the remaining `npm audit` noise means.

## Commands

```bash
npm run audit        # production dependencies, fails on high/critical — same gate as CI
npm run audit:full   # everything, including devDependencies (informational)
```

`npm run audit` mirrors the gate in [`ci.yml`](../.github/workflows/ci.yml) and
[`security.yml`](../.github/workflows/security.yml):
`npm audit --audit-level=high --omit=dev`. It must exit 0 before a PR is merged.

## Enforcing patched transitive versions

Most advisories in this tree come from packages we do not depend on directly. They are
pinned through the `overrides` block in `package.json`, with the same set mirrored in
`pnpm-workspace.yaml` so contributors on pnpm resolve identically. **When you change one,
change both** — CI installs with npm, but the repo supports pnpm locally.

| Package                  | Pin          | Reason                                                 |
| ------------------------ | ------------ | ------------------------------------------------------ |
| `axios`                  | `1.18.0`     | DoS via excessive recursion in `formDataToJSON`        |
| `follow-redirects`       | `1.16.0`     | Proxy-Authorization header leak on cross-host redirect |
| `form-data`              | `^4.0.6`     | Unsafe random boundary generation                      |
| `js-yaml`                | `^4.3.0`     | Quadratic CPU consumption via YAML merge-key chains    |
| `postcss`                | `^8.5.10`    | Line-return parsing error                              |
| `sharp` / `@swc/helpers` | see manifest | Inherited libvips CVEs / helper-chain fixes            |
| `ws`                     | `^8.21.0`    | DoS via many HTTP headers                              |
| `uuid`                   | `>=11.1.1`   | Weak randomness in older releases                      |
| `brace-expansion`        | per-major    | CVE-2026-14257 — see below                             |

### Why `brace-expansion` is pinned per major

`brace-expansion` is pinned with four separate override keys rather than one:

```json
"brace-expansion@1": "^1.1.17",
"brace-expansion@2": "^2.1.3",
"brace-expansion@3": "^3.0.5",
"brace-expansion@5": "^5.0.8"
```

Two things force this shape:

1. **The fix was backported, not forward-ported.** CVE-2026-14257
   ([GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg)) lets a
   ~7.5 KB pattern such as `'{a,b}'.repeat(1500)` crash Node with an uncatchable OOM,
   because `expand()` bounded the _number_ of results but not their _length_. Upstream
   shipped the `EXPANSION_MAX_LENGTH` guard to the `1.x`, `2.x`, `3.x` and `5.x` lines
   independently. There is no single version every consumer can move to.
2. **The v5 API is not backwards compatible.** `brace-expansion@1`/`@2` export the
   expander as the module default (`module.exports = expandTop`); `@5` exports it as a
   named `expand`. `minimatch@3` and `minimatch@9` call the default export, so a blanket
   `"brace-expansion": "^5.0.8"` override resolves cleanly but throws
   `e is not a function` at runtime, breaking ESLint and Jest. Overriding `minimatch`
   itself to `^10` fails the same way: its CJS entry point is a namespace object, not a
   callable.

Verify the guard is present in every resolved copy:

```bash
for d in $(find node_modules -name brace-expansion -type d); do
  grep -q EXPANSION_MAX_LENGTH "$d/index.js" "$d/dist/commonjs/index.js" 2>/dev/null \
    && echo "ok   $d" || echo "MISS $d"
done
```

## Known residual advisories (dev-only, accepted)

`npm run audit:full` still reports findings. Both are confined to devDependencies and
never reach the browser bundle or the standalone server output.

**`brace-expansion` — high, false positive.** GitHub's advisory records the affected
range as a single `<=5.0.7`, which cannot express "patched in 1.1.17, 2.1.3, 3.0.5 and
5.0.8". Every copy in this tree carries the `EXPANSION_MAX_LENGTH` guard (check it with
the loop above); the advisory range simply has not been split upstream yet. Reachable
only through `eslint`, `jest`/`test-exclude`, `rimraf`, `glob` and Storybook's
`fork-ts-checker-webpack-plugin`.

**`elliptic` — low, no fix available.** `<=6.6.1` is flagged and `6.6.1` is the latest
release, so there is nothing to upgrade to. It arrives via
`storybook → node-polyfill-webpack-plugin → crypto-browserify`, is used only to polyfill
Node crypto inside the Storybook dev bundle, and handles no production keys — the app
signs transactions with `@stellar/stellar-sdk` and Freighter. Re-evaluate when
`node-polyfill-webpack-plugin` publishes a release above `4.0.0`.

## Adding a new override

1. Confirm the advisory and its real patched versions — read the advisory page, do not
   trust the `npm audit` range alone when majors have diverged.
2. Add the pin to `package.json` **and** `pnpm-workspace.yaml`.
3. Re-install, then confirm the vulnerable code is actually gone from
   `node_modules` rather than only the version string changing.
4. Run `npm run audit`, `npm test` and `npm run lint` — overrides silently break
   transitive consumers, and the test suite is the fastest way to catch it.
5. Record the reason in the table above and in `_overridesRationale`.
