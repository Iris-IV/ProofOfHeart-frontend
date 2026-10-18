# Database Backup Strategy

ProofOfHeart's primary source of truth is the **Stellar/Soroban blockchain** — campaign state, votes, and contributions are stored on-chain and are inherently immutable and replicated.

However, the application maintains off-chain data stores that require a conventional backup strategy:

| Data store         | Contents                                    | Location                                                |
| ------------------ | ------------------------------------------- | ------------------------------------------------------- |
| Admin audit log    | Admin actions (verify, reject, fee changes) | File-system JSON (`/data/admin-audit-log.json`)         |
| Campaign reports   | Abuse reports and moderation decisions      | Shared store (`src/lib/reportRepository.ts`)            |
| Notification queue | Pending on-chain event notifications        | External service (configure via `NOTIFICATIONS_DB_URL`) |

Campaign reports and comments now live in the configurable server store described
in [docs/api.md](./api.md#storage-requirement-comments-reports-rate-limits)
(`COMMENT_STORE_DRIVER`): back up the `file` adapter's JSON file, or rely on the
`redis` adapter's own persistence.

---

## Automated daily backups

There is currently **no active backup workflow** in `.github/workflows/` — a
previously disabled `db-backup.yml.bak` was removed as a stale artifact. Restore
or recreate the workflow before relying on automated daily exports to a
configured cloud storage bucket.

### Required secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret               | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `BACKUP_STORAGE_URL` | Cloud storage destination (e.g. `s3://my-bucket/poh-backups/`)      |
| `BACKUP_STORAGE_KEY` | Access key / service account credentials                            |
| `APP_API_BASE_URL`   | Internal URL of the running app (for the audit-log export endpoint) |

### Retention policy

- Daily backups retained for **30 days**
- Weekly snapshots (Sunday) retained for **12 weeks**
- Older backups are pruned automatically by the workflow

### Restoring from backup

1. Download the target snapshot from cloud storage.
2. Place `admin-audit-log.json` at the path expected by `src/lib/adminLog.ts`.
3. Restore `campaign-reports.json` (or the Redis dump) into the configured store — see [docs/api.md](./api.md#storage-requirement-comments-reports-rate-limits).
4. Restart the application.

---

## Local development

With the default `file` adapter, off-chain data persists in `.data/poh-store.json`
across restarts. Under `NODE_ENV=test` (or `COMMENT_STORE_DRIVER=memory`) the
stores are ephemeral and reset on every restart, so no backup configuration is
needed for tests.

To persist the audit log across restarts in a staging environment, set `DATA_DIR` to a mounted volume path and ensure the backup workflow can reach the staging `APP_API_BASE_URL`.
