import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import type { WalletSigner } from "../../src/lib/walletSigner";

/**
 * #1789 — live Soroban happy path: create → verify (admin) → donate →
 * advance time → withdraw.
 *
 * Runs against a real local network (`stellar container start local`) instead
 * of mocks, driving `src/lib/contractClient.ts` directly from Node with a
 * keypair-backed test signer in place of Freighter.
 *
 * Everything network-facing comes from the environment:
 *
 *   E2E_LIVE=true                     required, otherwise the test is skipped
 *   E2E_CONTRACT_ADDRESS /            deployed ProofOfHeart contract
 *   NEXT_PUBLIC_CONTRACT_ADDRESS
 *   E2E_CREATOR_SECRET                S… keys for the three actors
 *   E2E_ADMIN_SECRET
 *   E2E_DONOR_SECRET
 *   NEXT_PUBLIC_SOROBAN_RPC_URL       defaults to the quickstart local RPC
 *   NEXT_PUBLIC_NETWORK_PASSPHRASE    derived via getNetwork when unset
 *   E2E_DOCKER_CONTAINER              container name (default: local)
 *
 * "Advance time": the contract's `withdraw_funds` requires the ledger close
 * time to be past `campaign.deadline`, which is always ≥1 day ahead (duration
 * is measured in whole days). Waiting that out is impossible in CI, so the
 * helper restarts the container's stellar-core under libfaketime with the
 * clock two days in the future — a testing-only shim, since production
 * stellar-core exposes no clock override. `Date.now` is then pinned to the
 * network's clock so the withdraw transaction's 300s timebounds stay valid
 * against the jumped close time.
 */

// Captured before any patch so later attempts can always return to real time.
const realDateNow = Date.now.bind(Date);
/** Offset added to Date.now so built transactions match the network clock. */
let clockOffsetMs = 0;

const isLive = process.env.E2E_LIVE === "true";
const DOCKER_CONTAINER = process.env.E2E_DOCKER_CONTAINER ?? "local";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. The live Soroban e2e needs it — see the e2e-soroban job in .github/workflows/ci.yml.`,
    );
  }
  return value;
}

function rpcCall(rpcUrl: string, method: string, params: unknown): Promise<any> {
  return fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }).then(async (res) => {
    const body = await res.json();
    if (!res.ok || body.error) {
      throw new Error(`RPC ${method} failed (${res.status}): ${JSON.stringify(body)}`);
    }
    return body.result;
  });
}

/** Close time (unix seconds) of the network's latest ledger. */
async function fetchLatestCloseTime(rpcUrl: string, txHash?: string): Promise<number> {
  if (txHash) {
    const result = await rpcCall(rpcUrl, "getTransaction", { hash: txHash });
    return Number(result.latestLedgerCloseTime);
  }
  const latest = await rpcCall(rpcUrl, "getLatestLedger", {});
  // getTransactions reports the latest ledger's close time even with no rows.
  const result = await rpcCall(rpcUrl, "getTransactions", {
    startLedger: Number(latest.sequence),
    limit: 1,
  });
  return Number(result.latestLedgerCloseTimestamp);
}

/**
 * Align this process's clock with the network's (0 before any jump, ~+2 days
 * after one), so `TransactionBuilder.setTimeout(300)` produces timebounds the
 * jumped ledger accepts. Safe to call on every attempt: the offset is
 * re-measured, never accumulated.
 */
async function syncClockToNetwork(rpcUrl: string, txHash?: string): Promise<number> {
  const closeTime = await fetchLatestCloseTime(rpcUrl, txHash);
  clockOffsetMs = closeTime * 1000 - realDateNow();
  Date.now = () => realDateNow() + clockOffsetMs;
  return closeTime;
}

/**
 * Restart the container's stellar-core with its clock two days ahead of
 * whichever clock is currently furthest ahead (real or previously jumped), so
 * retries after an earlier jump still move the deadline into the past.
 */
function jumpNetworkClock(): void {
  const script = `
set -euo pipefail
if ! command -v faketime > /dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq faketime
fi
LIB="$(dpkg -L faketime | grep -m1 'libfaketime\\.so\\.1$' || true)"
if [ -z "$LIB" ]; then
  echo "libfaketime.so.1 not found after installing faketime" >&2
  exit 1
fi

REAL="$(date +%s)"
CORE="$(curl -sf http://localhost:11626/info | jq -r '.info.last_close_time // 0' || echo 0)"
BASE="$REAL"
if [ "$CORE" -gt "$BASE" ]; then BASE="$CORE"; fi
TARGET="$(date -u -d "@$((BASE + 172800))" '+%Y-%m-%d %H:%M:%S')"

cat > /opt/stellar/core/etc/faketime.env <<ENV
export LD_PRELOAD="$LIB"
export FAKETIME="@$TARGET"
export FAKETIME_DONT_FAKE_MONOTONIC=1
ENV
chown stellar:stellar /opt/stellar/core/etc/faketime.env

# The supervisor program runs this wrapper; sourcing the env file makes the
# jump apply on every start and keeps the rewrite idempotent for retries.
cat > /opt/stellar/core/bin/start <<'WRAP'
#!/bin/bash
[ -f /opt/stellar/core/etc/faketime.env ] && . /opt/stellar/core/etc/faketime.env
while ! psql -U stellar -c 'select 1' core > /dev/null 2>&1 ; do
  sleep 1
done
echo "starting core..."
set -e
exec /usr/bin/stellar-core --conf "/opt/stellar/core/etc/stellar-core.cfg" run
WRAP
chmod +x /opt/stellar/core/bin/start

supervisorctl stop stellar-core
sudo -u stellar stellar-core force-scp --conf /opt/stellar/core/etc/stellar-core.cfg
supervisorctl start stellar-core
echo "stellar-core restarted with FAKETIME @$TARGET"
`;
  execFileSync("docker", ["exec", "-i", DOCKER_CONTAINER, "bash", "-s"], {
    input: script,
    encoding: "utf8",
    timeout: 240_000,
  });
}

/** Keypair-backed signer installed in place of Freighter for the test run. */
function testSigner(secret: string): WalletSigner {
  const keypair = Keypair.fromSecret(secret);
  return {
    kind: "freighter",
    async getAddress() {
      return keypair.publicKey();
    },
    async signTransaction(xdr, { networkPassphrase }) {
      const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
      tx.sign(keypair);
      return tx.toXDR();
    },
  };
}

test("live happy path: create → verify → donate → advance time → withdraw", async () => {
  test.skip(!isLive, "set E2E_LIVE=true to run against a local Soroban network");

  // Prepare env before importing contractClient — it reads these at module load.
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "http://localhost:8000/soroban/rpc";
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = rpcUrl;
  process.env.NEXT_PUBLIC_USE_MOCKS = "false";
  if (!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS && process.env.E2E_CONTRACT_ADDRESS) {
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = process.env.E2E_CONTRACT_ADDRESS;
  }
  if (!process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE) {
    const network = await rpcCall(rpcUrl, "getNetwork", {});
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = network.passphrase;
  }
  requireEnv("NEXT_PUBLIC_CONTRACT_ADDRESS");
  const creatorSecret = requireEnv("E2E_CREATOR_SECRET");
  const adminSecret = requireEnv("E2E_ADMIN_SECRET");
  const donorSecret = requireEnv("E2E_DONOR_SECRET");

  // Align with the network clock first: a retry after an earlier attempt's
  // jump must build valid timebounds from its very first transaction.
  await syncClockToNetwork(rpcUrl);

  const cc = await import("../../src/lib/contractClient");
  const { setActiveWalletSigner } = await import("../../src/lib/walletSigner");
  const { Category } = await import("../../src/types");

  const creator = Keypair.fromSecret(creatorSecret).publicKey();
  const donor = Keypair.fromSecret(donorSecret).publicKey();

  // 0.1 POH (7 decimals) — above the contract's 100_000 minimum, small enough
  // for a local faucet; donated in full so the goal-reached check passes.
  const fundingGoal = 1_000_000n;

  // --- create (creator) -----------------------------------------------------
  setActiveWalletSigner(testSigner(creatorSecret));
  const created = await cc.createCampaign(
    creator,
    "Live e2e happy path",
    "Created by tests/e2e/live-soroban.spec.ts against a local Soroban network (#1789).",
    fundingGoal,
    1, // duration in days; the deadline is ≥1 day out — see the header note
    Category.Learner,
    false,
    0,
    ["e2e"],
    0n,
  );
  expect(created.campaignId).not.toBeNull();
  const campaignId = created.campaignId as number;

  // --- verify (admin) -------------------------------------------------------
  setActiveWalletSigner(testSigner(adminSecret));
  await cc.verifyCampaign(campaignId);

  let campaign = await cc.getCampaign(campaignId);
  expect(campaign).not.toBeNull();
  expect(campaign!.is_verified).toBe(true);
  // UI extras travel in the ===POH_EXT=== suffix and must round-trip.
  expect(campaign!.tags).toContain("e2e");
  expect(campaign!.deadline).toBeGreaterThan(Math.floor(realDateNow() / 1000));

  // --- donate (donor) -------------------------------------------------------
  setActiveWalletSigner(testSigner(donorSecret));
  const donateTx = await cc.contribute(campaignId, donor, fundingGoal);
  expect(await cc.getContribution(campaignId, donor)).toBe(fundingGoal);

  campaign = await cc.getCampaign(campaignId);
  expect(campaign!.amount_raised).toBe(fundingGoal);

  // --- advance time ---------------------------------------------------------
  // Push the network's ledger clock past the deadline, then pin this
  // process's Date.now to it so the withdraw timebounds remain valid.
  jumpNetworkClock();
  const closeTimeDeadline = campaign!.deadline;
  let closeTime = 0;
  const waitStartedAt = realDateNow();
  for (;;) {
    try {
      closeTime = await syncClockToNetwork(rpcUrl, donateTx);
      if (closeTime > closeTimeDeadline) break;
    } catch {
      // RPC can be briefly unavailable while stellar-core restarts.
    }
    if (realDateNow() - waitStartedAt > 90_000) {
      throw new Error(
        `Ledger close time never passed the deadline (closeTime=${closeTime}, deadline=${closeTimeDeadline}).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  expect(closeTime).toBeGreaterThan(closeTimeDeadline);

  // --- withdraw (creator) ---------------------------------------------------
  setActiveWalletSigner(testSigner(creatorSecret));
  await cc.withdrawFunds(campaignId);

  campaign = await cc.getCampaign(campaignId);
  expect(campaign).not.toBeNull();
  expect(campaign!.funds_withdrawn).toBe(true);
  expect(campaign!.status).toBe("funded");
});
