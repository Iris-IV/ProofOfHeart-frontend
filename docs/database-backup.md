# Database Backup Strategy

ProofOfHeart's primary source of truth is the **Stellar/Soroban blockchain** — campaign state, votes, and contributions are stored on-chain and are inherently immutable and replicated.

However, the application maintains off-chain data stores that require a conventional backup strategy:

| Data store         | Contents                                    | Location                                                |
| ------------------ | ------------------------------------------- | ------------------------------------------------------- |
| Admin audit log    | Admin actions (verify, reject, fee changes) | File-system JSON (`/data/admin-audit-log.json`)         |
| Campaign reports   | Abuse reports and moderation decisions      | In-memory `reportStore` (see `src/lib/reportStore.ts`)  |
| Notification queue | Pending on-chain event notifications        | External service (configure via `NOTIFICATIONS_DB_URL`) |

---

## Automated daily backups

A GitHub Actions workflow (`.github/workflows/db-backup.yml`) runs every day at **02:00 UTC** and exports off-chain data to a configured cloud storage bucket.

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
3. Replay `campaign-reports.json` into `reportStore` via the admin import endpoint (to be implemented — see issue #683).
4. Restart the application.

---

## Local development

Off-chain stores are ephemeral in development — they reset on every server restart. No backup configuration is needed locally.

To persist the audit log across restarts in a staging environment, set `DATA_DIR` to a mounted volume path and ensure the backup workflow can reach the staging `APP_API_BASE_URL`.
