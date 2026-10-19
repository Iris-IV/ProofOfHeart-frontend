# State Management Architecture and Hook Dependency Standards

Where each kind of state lives in the ProofOfHeart frontend, and the rules for writing hooks that touch it. The app uses **React Query for server state, React context for a few app-wide values, and plain `useState` for everything else**. There is no Zustand, Redux or other store library.

- [Choosing where state lives](#choosing-where-state-lives)
- [Provider tree](#provider-tree)
- [Server state: React Query](#server-state-react-query)
- [App-wide state: context](#app-wide-state-context)
- [Persisted browser state](#persisted-browser-state)
- [Component state](#component-state)
- [Hook dependency standards](#hook-dependency-standards)
- [Testing hooks](#testing-hooks)
- [Checklist for a new hook](#checklist-for-a-new-hook)

## Choosing where state lives

| The state is...                                                   | Put it in                                                    | Example                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Read from the contract or an API, and can change without the user | React Query (`useQuery`)                                     | `useCampaigns`, `usePlatformStats`                    |
| A write to the contract or an API                                 | `useMutation`, or an async handler plus `useWriteGuard`      | `useSavedCampaigns`, contribution flow                |
| Needed by many distant components and changes rarely              | A context provider                                           | wallet (`WalletContext`), toasts, theme               |
| Only one component (or its children) cares                        | `useState` / `useReducer` in that component                  | modal step, form field values                         |
| Must survive a reload, belongs to this browser only               | `localStorage` behind a hook or lib module                   | saved-campaign cache, form draft, recurring schedules |
| Must not outlive the tab                                          | `sessionStorage`                                             | the cached wallet public key                          |
| Derivable from other state                                        | Compute it during render (`useMemo` only if it is expensive) | `progressPercent`, `isExpired`                        |

Never copy server data into `useState` to "keep it": read it from the query so refetches and invalidations reach the screen.

## Provider tree

Set in `src/app/[locale]/layout.tsx`, outermost first:

```text
NextIntlClientProvider        translations and locale
└─ QueryProvider              React Query client
   └─ ThemeProvider           light / dark / system
      └─ ErrorBoundary
         └─ ToastProvider     showError, showSuccess, ...
            └─ WalletProvider wallet address, connect / disconnect, signer
               └─ Navbar, page content, Footer, DevMockPanel, OnboardingTour, ...
```

Order matters: `WalletProvider` calls `useToast` and `useQueryClient`, so it must sit inside both. A new provider that needs the wallet goes inside `WalletProvider`.

`DonationProvider` (`src/context/DonationContext.tsx`) is defined but **not mounted** in this layout. `useDonationContext` throws outside it, so mount the provider before using the hook in a page.

## Server state: React Query

`QueryProvider` creates one `QueryClient` per browser session (`useState(() => new QueryClient(...))`, so it survives re-renders) with these defaults:

```ts
{ queries: { staleTime: 60_000, retry: 1 } }
```

Hooks in `src/hooks/` own their queries. A hook returns plain values (`data`, `isLoading`, `error`, `refetch`), not the raw `UseQueryResult`, so components do not depend on React Query directly. `useCampaigns` is the reference:

```ts
const { data, isLoading, isFetching, error } = useQuery<Campaign[], Error>({
  queryKey: ["campaigns"],
  queryFn: getAllCampaigns,
  staleTime: POLL_INTERVAL,
  refetchInterval: isVisible ? POLL_INTERVAL : false, // pause while the tab is hidden
  refetchIntervalInBackground: false,
  retry: (failureCount, err) => !isContractErrorMessage(err.message) && failureCount < 1,
});
```

Rules:

- **Poll only while the tab is visible.** Combine `useWindowVisibility()` with `refetchInterval`, as above.
- **Do not retry contract reverts.** They fail the same way again; retry network errors once.
- **Every query key is an array that starts with the resource name and includes every input of `queryFn`.** If the wallet address or a campaign id changes the result, it is in the key.

### Query keys

| Key                                                                       | Hook / owner                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `["campaigns"]`, `["campaigns", "infinite", pageSize, category, creator]` | `useCampaigns`, `useInfiniteCampaigns`                                                     |
| `["campaign", campaignId]`                                                | Invalidated by events and admin actions only; no `useQuery` registers it today (see below) |
| `["campaignUpdates", campaignId]`                                         | campaign updates                                                                           |
| `["campaignComments", campaignId]`                                        | Invalidated on events; `useCampaignComments` builds its own key                            |
| `["contributions", walletAddress]`                                        | `useContributions`                                                                         |
| `["revenueSharing", campaignId, walletAddress]`                           | `useRevenueSharing`                                                                        |
| `["personalCap", id, userAddress]`                                        | `usePersonalCap`                                                                           |
| `["top-contributors", campaignId, userWalletAddress, limit]`              | `useTopContributors`                                                                       |
| `["platformStats"]`, `["contractVersion"]`                                | platform and contract metadata                                                             |
| `["savedCampaigns", publicKey]`, `["savedCampaignsCount", publicKey]`     | `useSavedCampaigns`                                                                        |
| `["wallet-transactions", walletAddress]`                                  | `useWalletTransactions`                                                                    |
| `["admin"]`                                                               | `useAdmin`                                                                                 |

Not every data hook uses React Query yet. `useCampaign`, `useCampaignMetadata`, `useCampaignFunding`, `useCampaignRules`, `useTrendingCampaigns` and the event hooks (`useCampaignEvents`, `useLiveCampaignFunding`, ...) load with `useState`, `useReducer` and `useEffect`. Invalidating a key that no query registers does nothing, which is why `["campaign", campaignId]` invalidations only refresh other keys today. New server-state hooks should use `useQuery`; when you migrate an old one, keep the key above so the existing invalidations start working.

### Keeping the cache fresh

- **After your own write**, call `queryClient.invalidateQueries({ queryKey })` for every key the write can change (for example `["campaigns"]` and `["contributions", walletAddress]` after a contribution).
- **After someone else's write**, contract events are mapped to keys in `src/lib/cacheInvalidation.ts` (`contribution_made`, `withdraw_funds`, `cancel_campaign`, `claim_refund`, ...), always scoped to the campaign id in the event. Add new event topics there, not in components.
- Invalidate the narrowest key that is wrong. `["campaigns"]` also matches the infinite list because React Query matches keys by prefix.

## App-wide state: context

| Context           | File                               | Holds                                                                                     |
| ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `WalletContext`   | `src/components/WalletContext.tsx` | Connected public key, connect/disconnect, Freighter or social-login signer                |
| `ToastContext`    | `src/components/ToastProvider.tsx` | `showToast`, `showError`, `showSuccess`, `showWarning`, `showInfo`, `showToastWithAction` |
| `ThemeContext`    | `src/components/ThemeProvider.tsx` | Selected theme; consumed through `useTheme`                                               |
| `DonationContext` | `src/context/DonationContext.tsx`  | Pending donations in their cancel grace period (not mounted, see above)                   |

Standards for a context:

1. **One provider file exports the provider and a `useX` hook.** The hook throws if the context is `null` ("must be used within ...") instead of returning a default, so a missing provider fails loudly.
2. **Memoize the value** with `useMemo` and give callbacks stable identities, so consumers re-render only when the data they read changes.
3. **Keep contexts small and separate by change rate.** Do not put fast-changing values (a ticking clock, form input) in a context that many components read.
4. **Contexts hold app state, not server data.** Anything fetched belongs in React Query.

`DonationContext` shows the stable-callback pattern when a callback depends on changing values but consumers should not re-render:

```ts
const startGracePeriodRef = useRef(startGracePeriod);
startGracePeriodRef.current = startGracePeriod;

const stableStartGracePeriod = useCallback(
  (...args: Parameters<typeof startGracePeriod>) => startGracePeriodRef.current(...args),
  [],
);
```

## Persisted browser state

| Key                                                                | Storage          | Written by                        | Notes                                                                           |
| ------------------------------------------------------------------ | ---------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| `stellar_wallet_public_key`                                        | `sessionStorage` | `WalletContext`                   | Public key only, never a secret. Legacy `localStorage` value is migrated once.  |
| `poh_saved_campaigns_guest`, `poh_saved_campaigns_<wallet>`        | `localStorage`   | `useSavedCampaigns`               | Offline cache of bookmarks; the contract is the source of truth when signed in. |
| `proof_of_heart_draft_<wallet>` / `proof_of_heart_draft_anonymous` | `localStorage`   | `useCampaignFormDraft`            | Campaign form draft.                                                            |
| `poh_followed_creators_<wallet>`                                   | `localStorage`   | `useFollowedCreators`             | Creators the wallet follows.                                                    |
| `poh_recurring_donations`                                          | `localStorage`   | `src/lib/recurringDonations.ts`   | See [RECURRING_DONATIONS.md](RECURRING_DONATIONS.md).                           |
| `poh_contract_wasm_hash`                                           | `localStorage`   | `src/lib/contractVersionGuard.ts` | Cached contract WASM hash.                                                      |
| `poh_creator_revenue_claimed_<...>`                                | `localStorage`   | `src/lib/revenueShare.ts`         | Local record of claimed creator revenue.                                        |

Rules for browser storage:

- **Wrap every read and write in `try/catch`.** Storage can be full, blocked (private browsing) or hold corrupt JSON; a storage failure must never break the feature.
- **Guard `typeof window === "undefined"`** in modules that can run during server rendering.
- **Validate what you read.** Stored values are user-editable. `useSavedCampaigns` filters parsed data with `Number.isInteger`.
- **Namespace keys with `poh_`** (or the existing `proof_of_heart_` prefix) and add the wallet address when the data is per wallet.
- **Do not store secrets.** Signing happens in Freighter or an in-memory social-login key.
- **Do not write on first render before restoring.** `useCampaignFormDraft` ignores `saveDraft` until `restoreDraft` has run, so empty defaults cannot overwrite a saved draft.

## Component state

- Use `useState` for independent values and `useReducer` when several values change together or a step machine drives the UI (the donation modal's `input → pending → confirmed` flow is the model).
- Use `useRef` for values that must not trigger a render: timers, in-flight request sets, "has restored" flags. `useWriteGuard` keeps an in-flight set in a ref to drop duplicate clicks on the same `(action, campaignId)`.
- Use `useSyncExternalStore` to subscribe to browser state outside React, as `useWindowVisibility` does for `document.visibilityState`.
- Lift state only as far as the nearest common parent; reach for context after that, not before.

## Hook dependency standards

The ESLint config (`eslint.config.mjs`) does **not** enable `react-hooks/exhaustive-deps`, so nothing in CI catches a wrong dependency array. Authors and reviewers have to.

1. **List every reactive value the callback or effect reads.** Props, state, and anything derived from them, including values returned by other hooks.
2. **Never silence the problem with an empty array** unless the callback truly reads nothing reactive. The one accepted exception is a ref-forwarding wrapper like `stableStartGracePeriod` above, where the ref is read at call time.
3. **Primitives in dependency arrays, not new objects.** `[publicKey]` is stable; `[{ publicKey }]` or an inline array changes every render and re-runs the effect. Memoize objects and functions that must be dependencies (`useMemo`, `useCallback`).
4. **Functions you pass down are wrapped in `useCallback`** with their own correct dependencies, when a child's `useEffect`, `useMemo`, `React.memo` or a context value depends on them. `useCampaignFormDraft` keys its callbacks on `[draftKey]`.
5. **Every effect that subscribes returns a cleanup** (`removeEventListener`, `clearInterval`, unsubscribe). Effects that set intervals read changing values through a ref so the interval is not recreated every tick (`useDonationGracePeriod`).
6. **Do not derive state in an effect.** If `b` is computable from `a`, compute it during render. Use an effect only to synchronise with something outside React.
7. **Query keys follow the same rule as dependency arrays**: every input of `queryFn` is in the key.
8. **Custom hooks return stable shapes.** Memoize returned objects and callbacks that consumers may use as dependencies.
9. **Hooks run in the same order every render.** No hook calls inside conditions, loops or early returns.
10. **A `// eslint-disable` for a hooks rule needs a comment saying why it is safe.**

Example of a correct pair: the callback reads `draftKey`, so `draftKey` is the dependency.

```ts
const saveDraft = useCallback(
  (data: CampaignFormDraftData) => {
    if (!hasRestored.current) return; // ref: read at call time, not a dependency
    localStorage.setItem(draftKey, JSON.stringify(data));
  },
  [draftKey],
);
```

## Testing hooks

Hook tests live in `src/__tests__/hooks/` and `src/hooks/__tests__/` (for example `useCampaigns.test.tsx`, `useWriteGuard.test.ts`). Query hooks are rendered inside a fresh `QueryClientProvider` per test with `retry: false` so failures are immediate; mock `@/lib/contractClient` rather than the network.

```bash
npx jest src/__tests__/hooks
```

## Checklist for a new hook

- [ ] Is this server state? Use `useQuery` with a complete key, not `useState` plus `useEffect`.
- [ ] Does a write invalidate every key it changes?
- [ ] Does polling stop while the tab is hidden?
- [ ] Is every reactive value in each dependency array, and are object and function dependencies stable?
- [ ] Does every effect clean up?
- [ ] Is storage access wrapped in `try/catch`, guarded for the server, and validated on read?
- [ ] Is there a test, including the error and empty cases?
