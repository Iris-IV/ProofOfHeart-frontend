# Dev Mock Panel

A dev-only panel for testing different campaign states at runtime without editing code.

## Overview

The Dev Mock Panel allows developers to quickly switch between different mock campaign scenarios while the app is running. This speeds up UI testing and iteration on different campaign states.

**Important**: This panel is **never shipped in production**. It only appears when:

- `NEXT_PUBLIC_USE_MOCKS=true` (mock mode enabled)
- `NODE_ENV=development` (development environment)

## Features

- **Runtime State Switching**: Change campaign states without restarting the dev server
- **Session Persistence**: Scenarios persist across page reloads during your session
- **Easy Reset**: Clear all scenarios with one click
- **Non-Intrusive**: Fixed position panel in bottom-right corner

## Available Scenarios

| Scenario      | Description                          | Use Case                  |
| ------------- | ------------------------------------ | ------------------------- |
| **Default**   | Original mock data                   | Baseline testing          |
| **Active**    | Ongoing campaign, 50% funded         | Test active campaign UI   |
| **Verified**  | Verified but not funded              | Test verified state       |
| **Funded**    | Successfully funded, funds withdrawn | Test success state        |
| **Cancelled** | Campaign cancelled                   | Test cancellation UI      |
| **Failed**    | Deadline passed, goal not met        | Test failure state        |
| **Empty**     | No data                              | Test empty state handling |
| **Error**     | Error state                          | Test error handling       |

## Usage

### Opening the Panel

1. Run the app in development with mocks enabled:

   ```bash
   NEXT_PUBLIC_USE_MOCKS=true npm run dev
   ```

2. Look for the **⚙️ Mock** button in the bottom-right corner

3. Click to open the panel

### Selecting a Scenario

1. Open the panel
2. For each campaign (1-6), select a scenario from the dropdown
3. The UI updates immediately to reflect the new state
4. Changes persist across page reloads during your session

### Resetting Scenarios

Click **Reset All** to clear all scenarios and return to default mock data.

## Implementation Details

### Components

- **`DevMockPanel.tsx`**: UI component for the panel
  - Only renders in mock mode + development
  - Stores scenarios in sessionStorage
  - Dispatches custom events for state changes

### Hooks

- **`useDevMockScenario(campaignId)`**: Get the current scenario for a campaign
  - Returns the selected scenario or 'default'
  - Listens for panel changes
  - Reacts to reset events

### Utilities

- **`devMockScenarios.ts`**: Applies scenarios to campaigns
  - `applyMockScenario(campaign, scenario)`: Transforms campaign data
  - `MOCK_SCENARIOS`: List of available scenarios

## Using Scenarios in Components

To use mock scenarios in your components:

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
      {/* ... */}
    </div>
  );
}
```

## Testing Checklist

Use the Dev Mock Panel to test these scenarios:

- [ ] **Active Campaign**: Verify UI for ongoing campaigns
- [ ] **Verified Campaign**: Check verified badge/state
- [ ] **Funded Campaign**: Test success messaging
- [ ] **Cancelled Campaign**: Verify cancellation UI
- [ ] **Failed Campaign**: Test failure state
- [ ] **Empty State**: Ensure graceful handling of missing data
- [ ] **Error State**: Verify error boundaries work

## Production Safety

The panel is completely removed from production builds:

1. **Runtime Check**: `IS_MOCK_MODE` check prevents rendering
2. **Build Check**: `NODE_ENV !== 'development'` prevents rendering
3. **No Exports**: Panel is not exported in production builds
4. **No Bundle Impact**: Tree-shaking removes unused code

## Troubleshooting

### Panel not appearing?

- Verify `NEXT_PUBLIC_USE_MOCKS=true` is set
- Check that `NODE_ENV=development`
- Ensure you're running `npm run dev` (not `npm run build`)

### Scenarios not persisting?

- Check browser's sessionStorage is enabled
- Clear sessionStorage if needed: `sessionStorage.clear()`
- Reload the page

### Changes not reflecting?

- Ensure the component uses `useDevMockScenario` hook
- Check that `applyMockScenario` is called on the campaign
- Verify the component re-renders when scenarios change

## Future Enhancements

Potential improvements:

- [ ] Persist scenarios to localStorage for cross-session testing
- [ ] Add scenario presets (e.g., "test all states")
- [ ] Export/import scenario configurations
- [ ] Add scenario history/undo
- [ ] Integration with E2E tests for automated state testing
