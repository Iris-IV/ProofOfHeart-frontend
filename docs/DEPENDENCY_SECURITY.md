# Dependency Security

How this repo keeps its dependency tree free of known high-severity vulnerabilities,
and what the remaining `npm audit` noise means.

## Commands

```bash
npm run audit          # production dependencies, fails on high/critical
npm run audit:full     # everything, including devDependencies (informational)
npm run audit:ci       # audit-ci, the gate that runs in CI
npm run audit:ci:json  # the same, machine-readable
```

`npm run audit:ci` is the gate. It is what
[`security.yml`](../.github/workflows/security.yml) runs on every pull request, and
its policy lives in [`audit-ci.json`](../audit-ci.json) rather than in the workflow,
so it can be reviewed and tested like any other config.

## The audit-ci gate

`audit-ci` wraps `npm audit` with a versioned allowlist so that "we accept this
advisory" is an explicit, dated, reviewable decision instead of a comment in a
workflow file.

| Setting           | Value   | Why                                                          |
| ----------------- | ------- | ------------------------------------------------------------ |
| `critical`        | `true`  | Critical vulnerabilities must block a merge                  |
| `high`            | `true`  | High vulnerabilities must block a merge                      |
| `moderate`/`low`  | `false` | Reported, not enforced — see "Widening the gate" below       |
| `skip-dev`        | `true`  | Matches the documented `npm audit --omit=dev` gate           |
| `package-manager` | `npm`   | The repo ships both `package-lock.json` and `pnpm-lock.yaml` |
| `pass-enoaudit`   | `true`  | A registry outage must not read as "nothing found"           |
| `retry-count`     | `3`     | Tolerate a transient registry failure                        |
| `show-not-found`  | `false` | Do not print stale allowlist entries                         |

Two properties are enforced by
[`scripts/check-audit-policy.mjs`](../scripts/check-audit-policy.mjs), which runs in
the same workflow and is also covered by unit tests:

1. **Every allowlist entry carries an `expiry` and a `notes` rationale, and fails
   once the expiry has passed.** A suppression with no review date silently becomes
   permanent, which is how a temporary exception becomes one nobody remembers
   approving. `check-audit-policy.mjs` exits 1 on an expired entry, so the decision
   has to be re-made on a schedule.
2. **The `overrides` block is identical in `package.json` and `pnpm-workspace.yaml`.**
   A pin that exists in only one of them means npm and pnpm resolve different
   versions, so the pin protects whichever installer CI happens to use while leaving
   everyone else vulnerable.

### Widening the gate

`skip-dev: true` means devDependencies are not audited, which is the same scope as
the long-standing `npm audit --audit-level=high --omit=dev` gate. To audit the whole
tree, set `skip-dev: false` and expect the allowlist in `audit-ci.json` to start
mattering — it already lists every high-severity dev advisory, each with a reason and
an expiry.

## Enforcing patched transitive versions

Most advisories in this tree come from packages we do not depend on directly. They are
pinned through the `overrides` block in `package.json`, with the same set mirrored in
`pnpm-workspace.yaml` so contributors on pnpm resolve identically. **When you change one,
change both** — CI installs with npm, but the repo supports pnpm locally. This is
enforced by `check-audit-policy.mjs`, not just documented.

| Package                    | Pin        | Reason                                                 |
| -------------------------- | ---------- | ------------------------------------------------------ |
| `axios`                    | `1.18.0`   | DoS via excessive recursion in `formDataToJSON`        |
| `follow-redirects`         | `1.16.0`   | Proxy-Authorization header leak on cross-host redirect |
| `form-data`                | `^4.0.6`   | Unsafe random boundary generation                      |
| `js-yaml`                  | `^4.3.0`   | Quadratic CPU consumption via YAML merge-key chains    |
| `postcss`                  | `^8.5.10`  | Line-return parsing error                              |
| `sharp`                    | `>=0.35.4` | Inherited libheif CVEs                                 |
| `toml`                     | `^4.3.0`   | Uncontrolled recursion + prototype pollution           |
| `nanoid`                   | `^3.3.18`  | Custom generators can loop forever when size is zero   |
| `ws`                       | `^8.21.0`  | DoS via many HTTP headers                              |
| `uuid`                     | `>=11.1.1` | Weak randomness in older releases                      |
| `baseline-browser-mapping` | `^2.11.26` | DoS on invalid input in the build-time target database |
| `@swc/helpers`             | `0.5.21`   | Helper-chain fixes                                     |
| `brace-expansion`          | per-major  | CVE-2026-14257 — see below                             |

### Why `toml` is overridden rather than waiting for the SDK

`toml` reaches the tree only through `@stellar/stellar-sdk@15`, and two advisories
apply (`GHSA-82x6-q7mm-w9cf` uncontrolled recursion, `GHSA-v5mp-jgw5-2x6j` prototype
pollution). The fix is `4.1.3`+.

`@stellar/stellar-sdk@17` would remove the problem entirely — it replaces `toml` with
`smol-toml` — but that is a breaking SDK migration, not a pin. The override to
`^4.3.0` is safe because the SDK loads it as a CommonJS default export
(`_interopRequireDefault(require("toml"))`) and 4.x keeps exactly that shape: a CJS
module whose only export is `parse`, with no `__esModule` marker. **Re-check that
assumption when the SDK is upgraded to v17**, at which point the override should be
deleted.

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

`npm run audit:full` still reports findings. All of them are confined to
devDependencies and never reach the browser bundle or the standalone server output,
which is why `skip-dev` is on. Every high-severity one is listed in the
`audit-ci.json` allowlist with a reason and an expiry, so flipping `skip-dev` to
`false` does not immediately go red.

| Package                           | Severity | Reached through                          | Why it is accepted                            |
| --------------------------------- | -------- | ---------------------------------------- | --------------------------------------------- |
| `brace-expansion`                 | high     | eslint, jest, glob, storybook            | See above; guard present in every copy        |
| `browserslist`                    | high     | storybook → webpack                      | Build-time target resolution only             |
| `fast-uri`                        | high     | storybook → ajv                          | URL parsing the app never performs            |
| `image-size`                      | high     | storybook                                | Infinite-loop DoS in JXL/HEIF/ICNS parsers    |
| `js-yaml`                         | high     | @changesets/cli                          | Fix is 5.x only; 4.x is the pinned line       |
| `@humanfs/node`                   | moderate | storybook                                | Symlink-following copy, dev only              |
| `qs`                              | moderate | express, via storybook                   | Not reachable at runtime                      |
| `elliptic`                        | low      | storybook → node-polyfill-webpack-plugin | No fix available; polyfills dev-bundle crypto |
| `crypto-browserify`               | low      | storybook → node-polyfill-webpack-plugin | Same chain                                    |
| `create-ecdh` / `browserify-sign` | low      | storybook → node-polyfill-webpack-plugin | Same chain                                    |
| `@storybook/nextjs`               | low      | direct                                   | Build-time only                               |

Two are worth calling out:

**`brace-expansion` — high, false positive.** GitHub's advisory records the affected
range as a single `<=5.0.7`, which cannot express "patched in 1.1.17, 2.1.3, 3.0.5 and
5.0.8". Every copy in this tree carries the `EXPANSION_MAX_LENGTH` guard (check it with
the loop above); the advisory range simply has not been split upstream yet. Reachable
only through `eslint`, `jest`/`test-exclude`, `rimraf`, `glob` and Storybook's
`fork-ts-checker-webpack-plugin`. A newer intermediate-array DoS is also reported and
is not yet released on any of the four lines.

**`elliptic` — low, no fix available.** `<=6.6.1` is flagged and `6.6.1` is the latest
release, so there is nothing to upgrade to. It arrives via
`storybook → node-polyfill-webpack-plugin → crypto-browserify`, is used only to polyfill
Node crypto inside the Storybook dev bundle, and handles no production keys — the app
signs transactions with `@stellar/stellar-sdk` and Freighter. Re-evaluate when
`node-polyfill-webpack-plugin` publishes a release above `4.0.0`.

## Adding a new override

1. Confirm the advisory and its real patched versions — read the advisory page, do not
   trust the `npm audit` range alone when majors have diverged.
2. Add the pin to `package.json` **and** `pnpm-workspace.yaml`. Then run
   `node scripts/check-audit-policy.mjs` to confirm the two agree.
3. Re-install, then confirm the vulnerable code is actually gone from
   `node_modules` rather than only the version string changing.
4. Run `npm run audit:ci`, `npm test` and `npm run lint` — overrides silently break
   transitive consumers, and the test suite is the fastest way to catch it.
5. Record the reason in the table above and in `_overridesRationale`.

## Adding an allowlist entry

1. Prefer fixing it. An allowlist entry is a decision to ship a known vulnerability.
2. If it cannot be fixed yet, confirm it is dev-only (`npm audit --omit=dev` clean) and
   write down how it is reachable and why the risk is accepted.
3. Add it to `audit-ci.json` as `{ "<module>": { "active": true, "expiry": "YYYY-MM-DD", "notes": "…" } }`.
   The allowlist is an **array** of single-key objects; an object fails with
   `recordsOrIds is not iterable`.
4. Run `node scripts/check-audit-policy.mjs`. It rejects an entry with no notes, no
   expiry, or an expiry in the past.
5. Re-run `npm run audit:ci` and, if you removed an entry, confirm the failure it
   produces names the advisory you expected — a gate that cannot fail is not a gate.
