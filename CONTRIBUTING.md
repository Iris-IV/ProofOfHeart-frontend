# Contributing to ProofOfHeart-frontend

Thank you for your interest in contributing!

## Package Manager Requirement

We strictly use **`npm`** for all dependency management to ensure consistency across local development and our CI pipelines.

Please **DO NOT** use `pnpm` or `yarn`.

- To install dependencies, use `npm install`.
- Ensure that you commit updates to `package-lock.json` when modifying dependencies.
- Our CI pipeline relies on `npm ci` and the `package-lock.json` file as the single source of truth.
