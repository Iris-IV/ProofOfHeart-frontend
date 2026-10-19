# Changelog

All notable changes to this project are documented here.

This project follows [Semantic Versioning](https://semver.org) and uses
[Changesets](https://github.com/changesets/changesets) to manage releases.

## Versioning conventions

The package version in `package.json` is the release version. Releases follow
[Semantic Versioning](https://semver.org) (`MAJOR.MINOR.PATCH`):

| Bump    | Use it for                                                                   |
| ------- | ---------------------------------------------------------------------------- |
| `patch` | Bug fixes, documentation, refactors and tooling with no change in behaviour  |
| `minor` | New user-visible features or backwards-compatible changes in behaviour       |
| `major` | Breaking changes, such as dropping a supported environment variable or route |

While the version is `0.x.y`, SemVer allows breaking changes in a `minor` bump; call
them out in the changeset summary.

Commit messages and PR titles follow Conventional Commits
(`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `revert`),
enforced by `commitlint.config.js`; see [docs/COMMIT_CONVENTIONS.md](docs/COMMIT_CONVENTIONS.md).
Commit types describe a change; the changeset decides the release bump.

## How to add a changeset

Every pull request that should appear in the release notes carries a changeset, a
small markdown file in `.changeset/`:

```bash
npm run changeset        # interactive: pick the bump, write the summary
npm run changeset:check  # validate every pending changeset (no install needed)
```

The file name is generated (for example `swift-pages-bookmark.md`). Its content is
the package name, the bump and a one-paragraph summary written for readers of the
changelog:

```md
---
"proofofheart-frontend": minor
---

Fall back to a secondary Soroban RPC when the primary is slow.
```

- The package name must be `proofofheart-frontend` and the bump one of `patch`,
  `minor` or `major`; the summary cannot be empty.
- `.changeset/config.json` sets `privatePackages.version: true`. The package is
  `private`, and without that setting changesets would skip it and produce empty
  release notes.
- Pull requests that should not be released (docs, tests, CI plumbing) take the
  `skip-changeset` label instead.
- The **Changeset Check** workflow runs `node scripts/validate-changesets.mjs` on
  pull requests that touch `.changeset/` or `package.json`, and, unless the label is
  set, requires that the pull request adds a changeset.

To see what is waiting for the next release, list `.changeset/` or run
`npx changeset status`.

## How a release is made

1. A pull request with a changeset is merged into `main`.
2. The **Release** workflow (`.github/workflows/release.yml`) runs on every push to
   `main`. It runs `npm run version` (`changeset version`) and opens or updates a
   pull request titled `chore: version bump`.
3. That pull request raises the version in `package.json`, adds the collected
   summaries to this file, and deletes the changesets it consumed. It keeps
   collecting changes until someone merges it.
4. Merging it is the release. Review the generated entry here before merging;
   edit it in the pull request if the wording needs work.

Generated entries use the `@changesets/cli/changelog` format: a `## <version>`
heading with `### Major Changes`, `### Minor Changes` and `### Patch Changes`
lists. The `0.1.0` entry below was written by hand and is kept as is.

The Release workflow also has a `docker-release` job that builds and pushes
`ghcr.io/<repository>:<version>` and `:latest`. It only runs when the changesets
action reports `published == 'true'`, and the workflow does not pass a `publish`
command to that action, so today it is skipped. Add one (and decide what
publishing a private package should do) before relying on it.

---

## 0.1.0 — 2026-05-29

Initial public release of the ProofOfHeart frontend.

### Features

- Decentralised crowdfunding campaigns backed by the Stellar blockchain
- On-chain donation tracking via Soroban smart contracts
- Cause discovery with filter + URL-sync
- Multi-language support (English, Spanish) via next-intl
- Freighter wallet integration
- Revenue-sharing panel, admin transfer, campaign updates, and comments
- Docker standalone production image with health check
