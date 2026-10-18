# CI Workflows

What each workflow in `.github/workflows/` does, and what it costs.

| Workflow              | Triggers                           | Install            | Blocks a merge |
| --------------------- | ---------------------------------- | ------------------ | -------------- |
| `ci.yml`              | push to `main`, all pull requests  | no                 | yes            |
| `changeset-check.yml` | changesets, `package.json`, manual | no                 | yes            |
| `security.yml`        | dependency changes, weekly, manual | `--ignore-scripts` | yes            |
| `release.yml`         | push to `main`                     | full               | no             |
| `auto-review.yml`     | pull requests                      | varies             | no             |

The two checks added most recently — `changeset-check` and `security` — are designed
so that neither lengthens the build pipeline. Both run as their own jobs, and
`changeset-check` installs nothing at all.

## `ci.yml`

A deliberately minimal build gate: it checks out the repo and asserts that the basic
pipeline is alive. It does not install or build.

## `changeset-check.yml` (#1617, #1631)

Verifies that a pull request carries a changeset that will actually produce a
release note.

```bash
npm run changeset:check                     # every pending changeset
node scripts/validate-changesets.mjs --base origin/main --require   # this branch only
node scripts/validate-changesets.mjs --json # machine-readable
```

`scripts/validate-changesets.mjs` uses only the Node standard library, so it runs in
well under a second on a bare runtime. That matters: `changeset status` is the
authoritative check, but it needs `node_modules`, so it can only run after the
install — by which point the feedback is minutes old. This script is the early
warning, and `release.yml` still runs the real thing.

### What it checks

**The config** — `.changeset/config.json` must version this package. This is the
check that catches the silent failure:

> `proofofheart-frontend` is `"private": true`, and changesets **skips private
> packages by default**. Without an explicit `privatePackages.version: true`, a
> perfectly good changeset is accepted, merged, and then discarded at release time —
> and the changelog ships empty. Nothing in a normal review notices, because
> `changeset status` reports success either way.

The config is therefore:

```json
"privatePackages": { "version": true, "tag": false }
```

`version: true` so the package is actually versioned; `tag: false` because this is
not published to a registry.

It also asserts `baseBranch: "main"`, `access: "public"`, and an empty `ignore`.

**Each changeset file** — frontmatter fences present and closed, a package name this
repo actually versions, a recognised bump type (`patch`/`minor`/`major`), and a
non-empty summary of at most 200 characters. Two summary-shaped problems are
warnings rather than errors: a placeholder summary like `fix`, and two changesets with
the same text.

### Opting out

Changes that should not appear in release notes — docs, tests, CI plumbing — apply
the `skip-changeset` label. The config check still runs; only the "this branch must
add a changeset" requirement is skipped.

## `security.yml` (#1618)

Dependency vulnerability audit. See
[DEPENDENCY_SECURITY.md](./DEPENDENCY_SECURITY.md) for the policy, the allowlist and
the overrides.

```bash
npm run audit:ci        # the gate
node scripts/check-audit-policy.mjs   # allowlist expiry + overrides parity
```

Two things keep it cheap:

- `npm ci --ignore-scripts` rather than a full install. The audit needs the resolved
  tree from the lockfile, not built native modules, so `sharp` and `@swc/core` are
  never compiled.
- The allowlist-expiry job runs `scripts/check-audit-policy.mjs`, which is
  dependency-free and needs no install at all.

It also runs weekly, because a new advisory is sometimes published against a version
that is already installed and that Dependabot therefore never opens a PR for.

## `release.yml`

`changesets/action` opens or updates the release PR, and the Docker image is built and
pushed on a version tag. This is the only workflow that performs a full install and
build, and it runs on `main` rather than on pull requests.

## Adding a workflow

- Keep it in `.github/workflows/*.yml`, and delete the configuration it replaces
  rather than leaving two to compare.
- Scope `paths:` on pull-request triggers so a docs-only change does not pay for a
  security scan.
- `permissions: contents: read` unless the job genuinely writes.
- `concurrency` with `cancel-in-progress: true`, so a new push supersedes the
  previous run rather than queueing behind it.
