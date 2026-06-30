# Mobile Responsiveness Audit

**Issue**: #498  
**Audited breakpoints**: 320px, 375px, 390px, 414px (portrait, no zoom)

## Pages / components audited

| Page              | Route          |
| ----------------- | -------------- |
| Home              | `/`            |
| Causes list       | `/causes`      |
| Cause detail      | `/causes/[id]` |
| Create campaign   | `/causes/new`  |
| Dashboard         | `/dashboard`   |
| Admin             | `/admin`       |
| Shared: Navbar    | —              |
| Shared: CauseCard | —              |

---

## Issues found and fixed

### Home (`HomeClient.tsx`)

| Issue                                                         | Fix                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `text-5xl` hero heading clipped at 320 px                     | Changed to `text-4xl sm:text-5xl lg:text-7xl`                                          |
| CTA buttons with `px-10` caused horizontal overflow at 320 px | Changed to `px-6 sm:px-10`; added `items-stretch` so buttons fill the column on mobile |

### Navbar (`Navbar.tsx`)

| Issue                                                                            | Fix                                |
| -------------------------------------------------------------------------------- | ---------------------------------- |
| Testnet / Mainnet badges always visible caused right-side overflow at 320–375 px | Changed to `hidden sm:inline-flex` |
| "Mock Mode" badge visible at `sm` caused overflow alongside wallet buttons       | Changed to `hidden md:inline-flex` |

### CauseCard (`CauseCard.tsx`)

| Issue                                                                  | Fix                                   |
| ---------------------------------------------------------------------- | ------------------------------------- |
| `min-h-[640px]` forced excessive scroll height on 320 px screens       | Removed; height is now content-driven |
| Cancel Campaign button `py-2` was below the 44 px touch-target minimum | Added `min-h-[44px]`                  |

### Causes list (`CausesClient.tsx`)

| Issue                                                                                             | Fix                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filter row (`flex flex-wrap`) with three `label + select` pairs overflowed horizontally at 320 px | Changed to `flex-col` at mobile, `flex-row flex-wrap` at `sm`; selects use `flex-1` to fill available width; labels get a fixed `w-16` for alignment |
| Clear-filters link lacked 44 px touch target                                                      | Added `min-h-[44px]` at mobile                                                                                                                       |

### Cause detail (`CauseDetailClient.tsx`)

| Issue                                                                                          | Fix                                                |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Stat grid `text-2xl font-bold` values ("0", "100%", etc.) clipped in 2-column layout at 320 px | Changed to `text-xl sm:text-2xl`; added `truncate` |

### Create campaign (`NewCauseClient.tsx`)

| Issue                                                                                              | Fix                                               |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Wallet-guard banner `flex items-center justify-between` broke at 360 px when button label was long | Changed to `flex-col sm:flex-row sm:items-center` |
| Connect-wallet button in banner lacked touch-target height and was fixed-shrink                    | Added `min-h-[44px] w-full sm:w-auto`             |

### Admin (`AdminClient.tsx`)

| Issue                                                                                                         | Fix                                                          |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Contract-admin address pill had no overflow protection — long Stellar addresses could cause horizontal scroll | Added `min-w-0 max-w-full break-all` to the address `<span>` |

---

## Items verified as already responsive

- **DashboardClient**: `max-w-4xl px-4`, `flex flex-col` layout, `min-h-[44px]` on buttons — no issues.
- **Navbar mobile menu**: full-width column layout, `h-12 w-full` buttons, truncated address display — no issues.
- **OnboardingTour**: `max-w-md w-full p-4` modal — no overflow.
- **Maintenance page**: inline styles with `padding: 2rem` — no overflow.
- **Footer, DonationModal, VotingComponent**: already use `w-full`, responsive grids, and `min-h-[44px]` targets.
