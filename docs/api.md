# ProofOfHeart API Reference

All routes are Next.js App Router API handlers under `/src/app/api/`. They are accessible at `https://<host>/api/<route>`.

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
