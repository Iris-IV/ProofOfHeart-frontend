# ProofOfHeart API Reference

All routes are Next.js App Router API handlers under `/src/app/api/`. They are accessible at `https://<host>/api/<route>`.

---

## Storage requirement (comments, reports, rate limits)

Campaign comments, abuse reports and rate-limit counters are server state. They
must **survive a process restart** and be **shared by every instance** — an
in-memory `Map` or array is lost on deploy and duplicated per instance, which
silently loses comments and lets a rate limit be bypassed by landing on another
instance.

That state goes through a single key/value store (`src/lib/persistentStore.ts`)
that the comment and report repositories (`src/lib/commentRepository.ts`,
`src/lib/reportRepository.ts`) and the rate limiter (`src/lib/rateLimit.ts`)
are built on:

| `COMMENT_STORE_DRIVER` | Behavior                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `memory`               | Process-local. Tests and throwaway local runs only — data is lost on restart.             |
| `file`                 | Single JSON file at `COMMENT_STORE_PATH`. Survives restart; shared across a shared volume. |
| `redis`                | Upstash-compatible REST. Survives restart **and** is shared across all instances. Use this in production. |

Both Redis variables are required when the `redis` adapter is selected; the
adapter is also selected automatically when both are set and no explicit driver
is given. See `.env.example` and `docs/ENVIRONMENT_VARIABLES.md`.

### On-chain comment censure

Comment text lives off-chain, but moderation is not meant to be invisible.
The contract records censures keyed by a **32-byte comment hash**
(`censure_comment` / `is_comment_censured`). Every comment is therefore stored
with `commentHash`, the sha256 of its canonical fields
(`src/lib/commentHash.ts`), and `GET`/`POST` comments filter out any hash the
contract has censured (`src/lib/commentCensure.ts`).

---

## `GET /api/health`

Health check for Docker `HEALTHCHECK`, uptime monitors, and the in-app degraded-network banner.

**Response**

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "app": "healthy",
    "rpc": "healthy" | "unhealthy"
  },
  "rpc_url": "https://soroban-testnet.stellar.org"
}
```

| HTTP status | Meaning                           |
| ----------- | --------------------------------- |
| `200`       | All services healthy              |
| `503`       | RPC unreachable — app is degraded |

---

## `POST /api/rpc`

Server-side proxy to the Stellar Soroban RPC. Keeps the RPC URL and API key out of the browser bundle. Applies per-IP rate limiting (60 req/min).

**Request body** — any valid JSON-RPC 2.0 payload for the Soroban RPC:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "simulateTransaction",
  "params": { "transaction": "<xdr>" }
}
```

**Response** — proxied JSON-RPC response from the Soroban node.

| Status | Meaning             |
| ------ | ------------------- |
| `200`  | Successful proxy    |
| `429`  | Rate limit exceeded |
| `500`  | RPC proxy error     |

---

## `GET /api/campaigns/[id]`

Fetch on-chain data for a single campaign by numeric ID (Soroban contract call, server-side).

**Path params**

| Param | Type     | Description |
| ----- | -------- | ----------- |
| `id`  | `number` | Campaign ID |

**Response** — serialised `Campaign` object (BigInt amounts encoded as strings).

| Status | Meaning                 |
| ------ | ----------------------- |
| `200`  | Campaign found          |
| `404`  | Campaign does not exist |

---

## `GET /api/reports`

Admin moderation queue. Returns all abuse reports, optionally filtered by status.

**Query params**

| Param    | Values                           | Default |
| -------- | -------------------------------- | ------- |
| `status` | `pending` \| `reviewed` \| `all` | `all`   |

**Response** — array of `CampaignReport` objects sorted newest-first.

```json
[
  {
    "id": "uuid",
    "campaignId": 1,
    "reporterAddress": "G...",
    "reason": "spam",
    "details": "optional free text",
    "timestamp": 1700000000000,
    "status": "pending"
  }
]
```

---

## `POST /api/reports`

Submit a new abuse report for a campaign. Rate-limited to 3 requests per wallet per minute.

**Request body**

```json
{
  "campaignId": 1,
  "reporterAddress": "G...",
  "reason": "spam" | "misleading" | "inappropriate" | "scam" | "other",
  "details": "optional free text"
}
```

**Response**

| Status | Meaning             |
| ------ | ------------------- |
| `201`  | Report submitted    |
| `400`  | Invalid payload     |
| `429`  | Rate limit exceeded |

---

## `PATCH /api/reports/[id]`

Mark a report as reviewed (admin only — caller should verify admin address server-side).

**Path params**

| Param | Type            |
| ----- | --------------- |
| `id`  | `string` (UUID) |

**Request body**

```json
{ "status": "reviewed" }
```

**Response** — `204 No Content` on success, `404` if the report ID is unknown.

---

## `GET /api/campaigns/[id]/comments`

Page through a campaign's off-chain comments. Comments censured on-chain are
removed before the page is built, so a censured comment never reaches the UI.

**Query params**

| Param      | Default | Notes                    |
| ---------- | ------- | ------------------------ |
| `page`     | `1`     | 1-based page number      |
| `pageSize` | `20`    | Clamped to the range 1–100 |

**Response**

```json
{
  "items": [
    {
      "id": "comment-1-1",
      "campaignId": 1,
      "content": "…",
      "authorAddress": "G…",
      "timestamp": 1700000000,
      "parentId": null,
      "signature": "…",
      "isPinned": false,
      "isReported": false,
      "commentHash": "sha256 hex of the canonical comment"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```

| Status | Meaning                      |
| ------ | ---------------------------- |
| `200`  | Page returned (may be empty) |
| `400`  | Invalid campaign ID          |

---

## `POST /api/campaigns/[id]/comments`

Create a comment. Rate-limited to 5 per address per campaign per minute.

**Request body**

```json
{
  "content": "string (1–2000 chars)",
  "authorAddress": "G…",
  "timestamp": 1700000000,
  "parentId": null,
  "signature": "hex signature over the comment payload"
}
```

**Response** — the stored comment, including the computed `commentHash`.

| Status | Meaning               |
| ------ | --------------------- |
| `201`  | Comment created       |
| `400`  | Invalid payload       |
| `429`  | Rate limit exceeded   |

---

## `POST /api/campaigns/[id]/comments/[commentId]/pin`

Pin or unpin a comment.

**Request body**

```json
{ "isPinned": true }
```

**Response** — the updated comment, or `404` if the comment ID is unknown.

---

## `POST /api/campaigns/[id]/comments/[commentId]/report`

Report a comment. Rate-limited to 3 per IP per minute.

**Response** — the updated comment with `isReported: true`, or `404` if the
comment ID is unknown.

---

## `GET /api/admin-audit-log`

Retrieve the admin action audit trail (verify, reject, fee update, admin transfer).

**Response** — array of `AdminAuditLogEntry` objects:

```json
[
  {
    "adminAddress": "G...",
    "action": "verify_campaign" | "reject_campaign" | "update_platform_fee" | "transfer_admin",
    "targetId": 1,
    "timestamp": 1700000000000,
    "txHash": "optional"
  }
]
```

---

## `POST /api/admin-audit-log`

Append an entry to the audit log. Called internally by admin UI actions.

**Request body**

```json
{
  "adminAddress": "G...",
  "action": "verify_campaign",
  "targetId": 1,
  "txHash": "optional"
}
```

**Response** — `201 Created` with the new entry.

---

## `POST /api/observability`

Ingest client-side error events for server-side logging and monitoring.

**Request body**

```json
{
  "type": "error",
  "message": "...",
  "stack": "optional",
  "context": {}
}
```

**Response** — `204 No Content`.

---

## Environment variables

| Variable                      | Used by       | Description                                       |
| ----------------------------- | ------------- | ------------------------------------------------- |
| `MAINNET_RPC_URL`             | `/api/rpc`    | Mainnet Soroban RPC with API key                  |
| `TESTNET_RPC_URL`             | `/api/rpc`    | Testnet Soroban RPC (defaults to public endpoint) |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `/api/rpc`    | `mainnet` or `testnet`                            |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `/api/health` | Public RPC for health probe                       |
| `COMMENT_STORE_DRIVER`        | comments, reports, rate limits | `memory`, `file` or `redis` |
| `COMMENT_STORE_PATH`          | comments, reports, rate limits | File path for the `file` adapter |
| `COMMENT_STORE_REDIS_REST_URL` | comments, reports, rate limits | Shared Redis REST endpoint |
| `COMMENT_STORE_REDIS_REST_TOKEN` | comments, reports, rate limits | Auth token for the Redis REST endpoint |
