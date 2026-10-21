# Feature Flags & Dev Mock Scenarios

How to toggle unreleased features with `NEXT_PUBLIC_FEATURE_*` flags, and how to run the app
offline with mock data and switch each mock campaign into a different state at runtime.

- [Quick start](#quick-start)
- [Feature flags](#feature-flags)
  - [Available flags](#available-flags)
  - [Configuring flags](#configuring-flags)
  - [Reading a flag](#reading-a-flag)
  - [Client components: known limitation](#client-components-known-limitation)
  - [Adding a flag](#adding-a-flag)
  - [Testing with flags](#testing-with-flags)
- [Mock mode](#mock-mode)
- [Dev mock panel](#dev-mock-panel)
  - [Scenarios](#scenarios)
  - [Using a scenario in a component](#using-a-scenario-in-a-component)
  - [Switching scenarios from the console](#switching-scenarios-from-the-console)
  - [Adding a scenario](#adding-a-scenario)
- [Production safety](#production-safety)
- [Troubleshooting](#troubleshooting)
- [Source map](#source-map)

## Quick start

```bash
cp .env.example .env.local   # already sets NEXT_PUBLIC_USE_MOCKS=true
npm ci
npm run dev                  # http://localhost:3000
```

Then click the **⚙️ Mock** button in the bottom-right corner to open the panel.

To try a feature flag at the same time, add it to `.env.local` and restart the dev server:

```bash
# .env.local
NEXT_PUBLIC_USE_MOCKS=true
NEXT_PUBLIC_FEATURE_VOTINGUI=true
```

## Feature flags

`src/lib/featureFlags.ts` is a small, dependency-free flag system for staged rollouts. Every
flag defaults to **off**, so a missing or mistyped variable can never switch a feature on in
production.

### Available flags

| Flag key    | Environment variable            | Default | Purpose                                                    |
| ----------- | ------------------------------- | ------- | ---------------------------------------------------------- |
| `votingUI`  | `NEXT_PUBLIC_FEATURE_VOTINGUI`  | `false` | Show the voting UI on cause detail pages.                  |
| `analytics` | `NEXT_PUBLIC_FEATURE_ANALYTICS` | `false` | Enable analytics event tracking.                           |
| `embeds`    | `NEXT_PUBLIC_FEATURE_EMBEDS`    | `false` | Enable embedded content (for example social media embeds). |

The variable name is always `NEXT_PUBLIC_FEATURE_` followed by the flag key in upper case
(`votingUI` → `VOTINGUI`).

> **Status:** no component calls `isEnabled()` or `getFlags()` yet — the flags are defined and
> tested but do not gate any UI today. Wire a flag into a component before relying on it.

### Configuring flags

Values are parsed by `readFlag()`:

| Value in the environment                            | Result             |
| --------------------------------------------------- | ------------------ |
| unset, or the empty string                          | the flag's default |
| `"true"` or `"1"`                                   | `true`             |
| anything else (`"false"`, `"0"`, `"yes"`, `"TRUE"`) | `false`            |

Matching is case-sensitive: `TRUE` and `yes` turn the flag **off**.

Flags are read once, on the first call to `getFlags()`/`isEnabled()`, and cached for the life of
the process. **Restart `npm run dev` after editing any `NEXT_PUBLIC_FEATURE_*` variable**
([#559](https://github.com/Iris-IV/ProofOfHeart-frontend/issues/559)).

For deployed environments, set the variable in the hosting provider's build environment —
`NEXT_PUBLIC_*` values are fixed at build time (see
[docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md)).

### Reading a flag

```ts
import { getFlags, isEnabled } from "@/lib/featureFlags";

if (isEnabled("votingUI")) {
  // render the voting UI
}

const { analytics, embeds } = getFlags(); // all flags at once
```

`isEnabled` only accepts keys of the `FeatureFlags` interface, so a typo is a type error.

### Client components: known limitation

`readFlag()` builds the variable name at runtime and reads `process.env[key]`. Next.js only
inlines `NEXT_PUBLIC_*` values for **literal** property reads (`process.env.NEXT_PUBLIC_X`); a
computed lookup resolves to `undefined` in the browser bundle (the same rule is documented on
`readClientEnv()` in `src/lib/runtimeEnv.ts`). As a result:

| Where the flag is read                                   | Sees the env value?           |
| -------------------------------------------------------- | ----------------------------- |
| Server Components, route handlers, `middleware.ts`, Jest | Yes                           |
| `"use client"` components and hooks in the browser       | No — always the default (off) |

Until `readFlag()` switches to literal reads, evaluate the flag on the server and pass the
result down as a prop:

```tsx
// src/app/[locale]/causes/[id]/page.tsx (Server Component)
import { isEnabled } from "@/lib/featureFlags";

export default function Page() {
  return <CauseDetailClient showVoting={isEnabled("votingUI")} />;
}
```

### Adding a flag

1. Add the key, with a JSDoc comment naming its variable and default, to the `FeatureFlags`
   interface.
2. Add its default (normally `false`) to `DEFAULTS`.
3. Add `newFlag: readFlag("newFlag", DEFAULTS.newFlag)` to the object built in `getFlags()`.
4. Add a row to [Available flags](#available-flags) and, if the variable should be validated,
   declare it in `src/lib/envContract.ts` (see [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md)).
5. Cover it in `src/__tests__/lib/featureFlags.test.ts`.

### Testing with flags

Because results are cached, reset the cache whenever a test changes a flag variable:

```ts
import { isEnabled, resetFlagsCache } from "@/lib/featureFlags";

const KEY = "NEXT_PUBLIC_FEATURE_VOTINGUI";

beforeEach(() => {
  delete process.env[KEY];
  resetFlagsCache();
});

it("turns the voting UI on", () => {
  process.env[KEY] = "true";
  expect(isEnabled("votingUI")).toBe(true);
});
```

## Mock mode

Mock mode replaces every contract call with in-memory data so the app runs without a wallet, an
RPC node or a deployed contract. It is on only when `NEXT_PUBLIC_USE_MOCKS` is exactly `"true"`
(`IS_MOCK_MODE` in `src/lib/runtimeEnv.ts`).

| What               | Where                                                         | Notes                                                                                                    |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Campaign dataset   | `MOCK_CAMPAIGNS` in `src/lib/contractClient.ts`               | 6 hand-written causes plus generated ones (ids 1–120), relative to the fixed timestamp `1700000000`.     |
| Contract reads     | `src/lib/contractClient.ts`                                   | `getAllCampaigns`, `listCampaigns`, `getCampaign`, … serve `MOCK_CAMPAIGNS`.                             |
| Contract writes    | `src/lib/contractClient.ts`                                   | Skip signing and RPC, report each lifecycle phase to `options.onStatus`, resolve with a fixed mock hash. |
| Per-campaign state | `applyMockScenario` in `src/lib/devMockScenarios.ts`          | See [Scenarios](#scenarios).                                                                             |
| Offline RPC (Jest) | `createMockSorobanRpcServer` in `src/lib/devMockScenarios.ts` | In-memory RPC stand-in for unit tests.                                                                   |

## Dev mock panel

`DevMockPanel` (`src/components/DevMockPanel.tsx`) is mounted in `src/app/[locale]/layout.tsx`
and `src/app/not-found.tsx`. It renders only when **both** `IS_MOCK_MODE` is true **and**
`NODE_ENV` is `development`.

The panel lists campaigns **1–6** with a scenario dropdown each. Choosing a scenario:

1. stores it in `sessionStorage["devMockScenarios"]` as `{ "<campaignId>": "<scenario>" }`, so it
   survives reloads in the same tab;
2. dispatches a `devMockScenarioChanged` event on `window` with
   `detail: { campaignId, scenario }` (`campaignId` is a **string**).

**Reset All** removes the storage key and dispatches `devMockScenariosReset`.

### Scenarios

All deadlines are relative to the mock timestamp `1700000000`.

| Scenario         | In panel | Result of `applyMockScenario`                                              |
| ---------------- | -------- | -------------------------------------------------------------------------- |
| `default`        | Yes      | Campaign unchanged.                                                        |
| `active`         | Yes      | Active, unverified, 50% funded, 30 days left.                              |
| `verified`       | Yes      | Active and verified, 33% funded, 30 days left.                             |
| `funded`         | Yes      | Inactive, verified, 100% raised, funds withdrawn, ended 5 days ago.        |
| `cancelled`      | Yes      | Cancelled, 25% funded.                                                     |
| `failed`         | Yes      | Ended 10 days ago at 20% of the goal.                                      |
| `empty`          | Yes      | Blank title, description and tags; zero goal and raised.                   |
| `error`          | Yes      | Campaign unchanged — the component is expected to render its error UI.     |
| `paused`         | Console  | Contract-pause stand-in: inactive but verified, not cancelled, 50% funded. |
| `goal_completed` | Console  | Still active with 200% of the goal raised.                                 |
| `near_deadline`  | Console  | 23 hours left at 95% of the goal.                                          |
| `empty_state`    | Console  | Newly created and active with no contributions.                            |

"Console" scenarios exist in the `MockScenario` type and in `MOCK_SCENARIOS`, but the panel's
dropdown is hard-coded and does not list them yet — set them from the
[browser console](#switching-scenarios-from-the-console).

### Using a scenario in a component

The panel only publishes the choice; a component has to opt in. No production component does so
today, so selecting a scenario changes nothing on screen until you wire it up:

```tsx
"use client";

import { useDevMockScenario } from "@/hooks/useDevMockScenario";
import { applyMockScenario } from "@/lib/devMockScenarios";
import type { Campaign } from "@/types";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const scenario = useDevMockScenario(campaign.id);
  if (scenario === "error") return <p role="alert">Could not load this cause.</p>;

  const shown = applyMockScenario(campaign, scenario);
  return <h2>{shown.title}</h2>;
}
```

`useDevMockScenario` returns `"default"` outside mock mode, so this code is inert in production.
`applyMockScenario` is pure and never mutates its input.

### Switching scenarios from the console

Useful for the console-only scenarios and for scripted QA:

```js
sessionStorage.setItem("devMockScenarios", JSON.stringify({ 1: "near_deadline" }));
window.dispatchEvent(
  new CustomEvent("devMockScenarioChanged", {
    detail: { campaignId: "1", scenario: "near_deadline" },
  }),
);
```

### Adding a scenario

1. Add the name to the `MockScenario` union in `src/hooks/useDevMockScenario.ts`.
2. Add a `case` to `applyMockScenario` in `src/lib/devMockScenarios.ts` that returns a new object.
3. Add a `{ value, label, description }` entry to `MOCK_SCENARIOS`.
4. Add an `<option>` to the dropdown in `src/components/DevMockPanel.tsx`.
5. Cover it in `src/lib/devMockScenarios.test.ts`.

## Production safety

- `DevMockPanel` returns `null` unless `IS_MOCK_MODE` is true and `NODE_ENV === "development"`.
- `useDevMockScenario` does nothing when mock mode is off.
- `assertProductionContractConfig()` (called from `src/instrumentation.ts`) refuses to start a
  production server with `NEXT_PUBLIC_USE_MOCKS=true`.
- Feature flags default to `false`; a feature can only be switched on deliberately.

## Troubleshooting

| Symptom                                     | Fix                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| No **⚙️ Mock** button                       | Check `NEXT_PUBLIC_USE_MOCKS=true` (exact string) and that you ran `npm run dev`, not `start`. |
| Changing a flag has no effect               | Restart the dev server (flags are cached). Check the value is `true` or `1`, lower case.       |
| Flag is on in a test but off in the browser | Expected in `"use client"` code — see [the limitation](#client-components-known-limitation).   |
| Picking a scenario changes nothing          | The component must use `useDevMockScenario` + `applyMockScenario`.                             |
| Scenario stuck after testing                | Click **Reset All**, or run `sessionStorage.removeItem("devMockScenarios")`.                   |

## Source map

| File                                     | Role                                            |
| ---------------------------------------- | ----------------------------------------------- |
| `src/lib/featureFlags.ts`                | Flag definitions, parsing and cache             |
| `src/__tests__/lib/featureFlags.test.ts` | Flag tests                                      |
| `src/lib/runtimeEnv.ts`                  | `IS_MOCK_MODE` and the env readers              |
| `src/components/DevMockPanel.tsx`        | Dev-only scenario panel                         |
| `src/hooks/useDevMockScenario.ts`        | `MockScenario` type and the subscription hook   |
| `src/lib/devMockScenarios.ts`            | `applyMockScenario`, `MOCK_SCENARIOS`, mock RPC |
| `src/lib/devMockScenarios.test.ts`       | Scenario tests                                  |

See also [docs/DEV_MOCK_PANEL.md](./docs/DEV_MOCK_PANEL.md), [docs/DEV_TOOLS.md](./docs/DEV_TOOLS.md)
and [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md).
