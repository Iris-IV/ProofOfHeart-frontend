# Changelog

All notable changes to this project are documented here.

This project follows [Semantic Versioning](https://semver.org) and uses
[Changesets](https://github.com/changesets/changesets) to manage releases.

## How to add a changeset

Run `npm run changeset` and follow the prompts. Changesets are collected in
`.changeset/` and applied on the next release via `npm run version`.

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
