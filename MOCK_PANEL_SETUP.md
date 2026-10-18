# Dev Mock Panel - Setup Complete ✅

A dev-only panel for testing different campaign states at runtime.

## What Was Added

### Components

- **`src/components/DevMockPanel.tsx`** - UI panel (bottom-right corner)
  - Only visible in dev mode with mocks enabled
  - Never shipped in production
  - Stores scenarios in sessionStorage

### Hooks

- **`src/hooks/useDevMockScenario.ts`** - Get current scenario for a campaign
  - Listens for panel changes
  - Reacts to reset events

### Utilities

- **`src/lib/devMockScenarios.ts`** - Apply scenarios to campaigns
  - `applyMockScenario()` - Transform campaign data
  - `MOCK_SCENARIOS` - List of available scenarios

### Integration

- **`src/app/[locale]/layout.tsx`** - Added DevMockPanel to root layout
  - Imported DevMockPanel component
  - Added to JSX after Footer

### Documentation

- **`docs/DEV_MOCK_PANEL.md`** - Complete usage guide
- **`docs/DEV_TOOLS.md`** - Quick reference

## Quick Start

```bash
# Enable mocks and start dev server
NEXT_PUBLIC_USE_MOCKS=true npm run dev

# Open http://localhost:3000
# Click ⚙️ Mock button in bottom-right corner
# Select scenarios for each campaign
```

## Available Scenarios

| Scenario  | Description                   |
| --------- | ----------------------------- |
| Default   | Original mock data            |
| Active    | Ongoing campaign, 50% funded  |
| Verified  | Verified but not funded       |
| Funded    | Successfully funded           |
| Cancelled | Campaign cancelled            |
| Failed    | Deadline passed, goal not met |
| Empty     | No data (empty state)         |
| Error     | Error state                   |

## Using in Components

```tsx
import { useDevMockScenario } from "@/hooks/useDevMockScenario";
import { applyMockScenario } from "@/lib/devMockScenarios";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const scenario = useDevMockScenario(campaign.id);
  const displayCampaign = applyMockScenario(campaign, scenario);

  return (
    <div>
      <h2>{displayCampaign.title}</h2>
      <p>Status: {displayCampaign.status}</p>
    </div>
  );
}
```

## Production Safety

✅ **Never shipped in production**:

- Runtime check: `IS_MOCK_MODE` prevents rendering
- Build check: `NODE_ENV !== 'development'` prevents rendering
- Tree-shaking removes unused code
- Safe to commit to main branch

## Acceptance Criteria Met

✅ Dev-only panel to pick mock scenarios at runtime  
✅ Never shipped/visible in production  
✅ Covers error and empty states  
✅ Labels: dx, Stellar Wave

## Next Steps

1. Run `npm ci` to install dependencies
2. Start dev server: `NEXT_PUBLIC_USE_MOCKS=true npm run dev`
3. Test different campaign states using the panel
4. Use in components with `useDevMockScenario` hook

## Files Modified

- `src/app/[locale]/layout.tsx` - Added DevMockPanel import and JSX

## Files Created

- `src/components/DevMockPanel.tsx`
- `src/hooks/useDevMockScenario.ts`
- `src/lib/devMockScenarios.ts`
- `docs/DEV_MOCK_PANEL.md`
- `docs/DEV_TOOLS.md`
