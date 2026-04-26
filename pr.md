# Multi-Feature Implementation: Role-Aware UI, Data Polling, Dark Mode, and Social Sharing

## Features Implemented

### 1. Role-Aware Conditional Rendering (#47)

- Created `CampaignActions` component to provide context-sensitive actions.
- Introduced `useAdmin` and `useContribution` hooks for identity verification.
- Implemented view-based rendering for:
  - **Campaign Creator**: Withdraw Funds (only if goal met), Cancel Campaign, Deposit Revenue.
  - **Contributor**: View personal contribution amount, Claim Refund (only if cancelled/failed), Claim Revenue.
  - **Admin**: "Verify Campaign" button for unverified causes.
  - **Visitor**: Prominent "Connect Wallet" CTA.

### 2. Automatic Data Polling (#50)

- Enhanced `useCampaign` and `useCampaigns` hooks with background synchronization.
- Configurable intervals via environment variables:
  - `NEXT_PUBLIC_POLL_INTERVAL_CAMPAIGN_MS` (default 20s)
  - `NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS` (default 60s)
- Implemented visibility-state detection to pause polling when the tab is inactive, preserving network resources.

### 3. Dark Mode Support (#42)

- Built a robust `ThemeProvider` with React Context.
- System preference detection and `localStorage` persistence.
- Added a seamless theme toggle in the `Navbar`.
- Implemented consistent Tailwind CSS `dark:` variants across the entire application.

### 4. Social Sharing & Open Graph (#52)

- Transitioned campaign detail page to a hybrid Server/Client pattern.
- Implemented `generateMetadata` for dynamic server-side rendering of SEO and Social tags.
- Added Open Graph and Twitter Card tags with dynamic Titles, Descriptions, and Image URLs.

## Technical Details

- Split `src/app/causes/[id]/page.tsx` into a server component (`page.tsx`) and an interactive client component (`CauseDetailClient.tsx`).
- Updated `contractClient.ts` to include administrative methods (`getAdmin`, `verifyCampaign`).
- Used `setInterval` for polling with cleanup and re-fetch triggers after successful transactions.

## Checklist

- [x] All features from `issue.md` implemented.
- [x] Responsive and premium design applied.
- [x] Dark mode verified with system preference.
- [x] Data polling respects tab visibility.
- [x] Open Graph tags verified on initial server response.

Fixes: #42 fixed
Fixes: #47 fixed
Fixes: #50 fixed
Fixes: #52 fixed
