# ProofOfHeart

**A decentralized launchpad where the community — not a corporation — validates a cause.**

## E2E and hook workflow

The frontend keeps a stable mock-based Playwright setup for local UI verification and CI smoke checks.

### Playwright defaults

- CI runs in headless mode with a reduced browser matrix to keep the test run predictable and fast.
- Local development keeps the runner lightweight and avoids unnecessary artifact retention.
- Screenshot expectations are intentionally conservative and avoid animation noise to keep visual diffs reliable in CI.
- `NEXT_PUBLIC_USE_MOCKS=true` is set during the Playwright web server boot so tests operate against deterministic mock campaign data.

```bash
npm run test:e2e
```

### Campaign hook split

Campaign data fetching is intentionally separated into focused hooks so each query is easier to reason about and test:

- `useCampaign` owns the base fetch lifecycle and shared loading/error state.
- `useCampaignMetadata` exposes title, description, tags, and creator metadata.
- `useCampaignFunding` exposes funding totals, milestones, and percentage calculations.
- `useCampaignRules` exposes lifecycle and contribution gating behavior.

This keeps one source of truth for data loading while avoiding a single monolithic hook with unrelated responsibilities.

### Logging utilities

Shared local-storage log helpers centralize read/write, timestamping, and address-based filtering for wallet/admin log features. This reduces duplication and keeps persistence behavior consistent across entries.

---

## Existing project documentation

ProofOfHeart empowers everyday people to rally behind the causes they believe in. By leveraging blockchain transparency and community-driven governance, it removes gatekeepers from the fundraising process.

[The rest of the README content remains unchanged.]
