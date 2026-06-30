# Local Data Migration Plan

This document inventories the current client-side storage keys and states how they should be handled when backend persistence is introduced.

## Inventory

| Storage key                                     | Owner                    | Data                          | Migration stance                                                                                                                                         |
| ----------------------------------------------- | ------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`                                         | `ThemeProvider`          | Light/dark preference         | Keep local. This is purely device preference.                                                                                                            |
| `stellar_wallet_public_key`                     | `WalletContext`          | Last connected wallet address | Keep local. This is a convenience cache, not source of truth.                                                                                            |
| `proof_of_heart_notifications_read_v1:<wallet>` | `useNotifications`       | Read/unread markers           | Migrate to backend persistence when notification sync exists. Local fallback remains for offline use.                                                    |
| `proof_of_heart_notifications_v1`               | legacy notification flow | Legacy notification feed      | Discard. The new notification flow sources events from the backend when available and falls back to wallet-scoped local derivations only when necessary. |
| `proof_of_heart_wallet_tx_log_v1`               | `transactionLog`         | Wallet action history         | Keep until the dashboard consumes an indexed event feed. This data is still useful as a local fallback for notification synthesis.                       |
| `proof_of_heart_admin_audit_log_v1`             | `adminLog`               | Admin action history          | Keep until the admin console has a backend audit trail.                                                                                                  |
| `proof_of_heart_reports_v1`                     | `campaignReports`        | User report submissions       | Migrate to backend persistence when moderation endpoints land.                                                                                           |
| `proof_of_heart_next_draft`                     | `NewCauseClient`         | Draft campaign form state     | Keep local. Drafts are user-device specific.                                                                                                             |

## Migration Policy

1. Backend-backed data should become the source of truth once the API exists.
2. Existing local data should be imported once per wallet or once per user session, then marked as migrated.
3. Read/unread notification state should move to backend storage first, because it is expected to roam across devices.
4. Drafts, theme choice, and wallet connection cache remain local by design.
5. If a dataset is intentionally reset, the release note must say so explicitly and the app should surface the reset in the relevant screen.

## User Communication

- Notification feed changes should be called out in release notes because the source of truth changes from local client state to backend/event data.
- Any intentional discard of legacy `localStorage` records should be announced before the migration ships.
- Wallet-scoped read state should preserve the visible unread count after migration by seeding backend rows from the existing local records.
