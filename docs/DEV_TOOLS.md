# Developer Tools

Quick reference for development tools and utilities.

## Dev Mock Panel

**Purpose**: Test different campaign states at runtime without editing code.

**Location**: Bottom-right corner (dev-only, never in production)

**How to use**:

1. Run with `NEXT_PUBLIC_USE_MOCKS=true npm run dev`
2. Click the **⚙️ Mock** button
3. Select scenarios for each campaign
4. UI updates immediately

**Scenarios**: Active, Verified, Funded, Cancelled, Failed, Empty, Error

**Docs**: See [DEV_MOCK_PANEL.md](./DEV_MOCK_PANEL.md)

## Mock Mode

**Enable**: Set `NEXT_PUBLIC_USE_MOCKS=true` in `.env.local`

**What it does**:

- Uses mock campaign data instead of contract calls
- Simulates all contract operations
- Speeds up local development

**Files**:

- Mock data: `src/lib/contractClient.ts` (MOCK_CAMPAIGNS)
- Mock utilities: `src/lib/devMockScenarios.ts`
- Mock detection: `src/lib/runtimeEnv.ts` (IS_MOCK_MODE)

## Testing States

Use the Dev Mock Panel to test:

| State     | How to Test                 |
| --------- | --------------------------- |
| Active    | Select "Active" scenario    |
| Verified  | Select "Verified" scenario  |
| Funded    | Select "Funded" scenario    |
| Cancelled | Select "Cancelled" scenario |
| Failed    | Select "Failed" scenario    |
| Empty     | Select "Empty" scenario     |
| Error     | Select "Error" scenario     |

## Production Safety

- Dev tools are **never shipped** in production
- Removed via tree-shaking and runtime checks
- Safe to commit to main branch

## Quick Start

```bash
# Enable mocks and start dev server
NEXT_PUBLIC_USE_MOCKS=true npm run dev

# Open http://localhost:3000
# Click ⚙️ Mock button in bottom-right
# Select scenarios to test
```

## Related Docs

- [COMMIT_CONVENTIONS.md](./COMMIT_CONVENTIONS.md) - Commit message format
- [DEPLOYMENT_ENVIRONMENTS.md](./DEPLOYMENT_ENVIRONMENTS.md) - Environment setup
- [LOCAL_DATA_MIGRATION.md](./LOCAL_DATA_MIGRATION.md) - Data migration guide
