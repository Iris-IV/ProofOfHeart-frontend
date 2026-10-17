import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Memo,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToBigInt,
  xdr,
} from "@stellar/stellar-sdk";
// #649 — Signing goes through the active wallet signer (Freighter or an
// embedded social wallet) rather than the Freighter API directly.
import { getSignerAddress, signTransactionXdr } from "./walletSigner";
import { captureTransactionError } from "./errorTracking";
import {
  classifyRpcFailure,
  classifySimulationFailure,
  recordObservabilityFailure,
  recordObservabilityKind,
  recordObservabilitySuccess,
} from "./observability";
import { appendWalletTransaction } from "./transactionLog";
import {
  Campaign,
  Category,
  deriveStatus,
  CampaignStatus,
  Milestone,
  ContractMilestone,
} from "../types";
import {
  parseContractError,
  getContractErrorCode,
  normalizeContractError,
  ContractError,
  ContractErrorException,
} from "../utils/contractErrors";
import { wrapFreighterError } from "../utils/freighterErrors";
import {
  validateStellarAddress,
  validateFundingGoal,
  validateDuration,
  validateRevenueShare,
  validateAmount,
} from "../utils/validators";

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://soroban-testnet.stellar.org";

/** Secondary node used while the primary is slow or unreachable. Optional. */
const SOROBAN_RPC_FALLBACK_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URL?.trim() ?? "";

/** A primary call slower than this switches traffic to the fallback node. */
export const RPC_LATENCY_THRESHOLD_MS =
  Number(process.env.NEXT_PUBLIC_RPC_LATENCY_THRESHOLD_MS) || 3_000;

/** How long the fallback is used before the primary is tried again. */
export const RPC_PRIMARY_RETRY_AFTER_MS = 60_000;

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

export type TransactionLifecyclePhase =
  "building" | "signing" | "submitting" | "confirming" | "confirmed" | "failed";

export interface TransactionLifecycleUpdate {
  phase: TransactionLifecyclePhase;
  txHash?: string;
  rpcStatus?: string;
}

export interface TransactionLifecycleOptions {
  onStatus?: (update: TransactionLifecycleUpdate) => void;
  timeoutMs?: number;
  /** Soroban contract method name for observability metrics. */
  operation?: string;
  /** Optional memo to attach to the transaction (e.g. campaign/cause ID). */
  memo?: string;
}

// ---------------------------------------------------------------------------
// Soroban RPC server (lazily initialised)
// ---------------------------------------------------------------------------

let _server: rpc.Server | null = null;
let _serverUrl: string | null = null;
let primaryDegradedUntil = 0;

/** The RPC endpoint calls currently go to (the fallback while the primary is degraded). */
export function getActiveRpcUrl(): string {
  return SOROBAN_RPC_FALLBACK_URL && Date.now() < primaryDegradedUntil
    ? SOROBAN_RPC_FALLBACK_URL
    : SOROBAN_RPC_URL;
}

function getServer(): rpc.Server {
  const url = getActiveRpcUrl();
  if (!_server || _serverUrl !== url) {
    _server = new rpc.Server(url);
    _serverUrl = url;
  }
  return _server;
}

function markPrimaryDegraded(reason: string): void {
  primaryDegradedUntil = Date.now() + RPC_PRIMARY_RETRY_AFTER_MS;
  console.warn(
    `[contractClient] Primary Soroban RPC ${reason}; using fallback ${SOROBAN_RPC_FALLBACK_URL} for ${RPC_PRIMARY_RETRY_AFTER_MS / 1000}s.`,
  );
}

class RpcLatencyExceededError extends Error {
  constructor() {
    super(`Soroban RPC did not respond within ${RPC_LATENCY_THRESHOLD_MS}ms`);
    this.name = "RpcLatencyExceededError";
  }
}

/** Rejects with RpcLatencyExceededError if `call` takes longer than the threshold. */
function withLatencyBudget<T>(call: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RpcLatencyExceededError()), RPC_LATENCY_THRESHOLD_MS);
  });
  // The slow call keeps running; swallow its eventual outcome.
  call.catch(() => undefined);
  return Promise.race([call, budget]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// Contract call response cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

// Cache storage: method_args -> { value, timestamp }
const contractCallCache = new Map<string, CacheEntry<unknown>>();

// Default TTL: 30 seconds for view methods
const DEFAULT_CACHE_TTL_MS = 30_000;

/**
 * Generates a cache key from method name and arguments.
 */
function getCacheKey(method: string, args: xdr.ScVal[]): string {
  const argsStr = args.map((arg) => arg.toXDR().toString("base64")).join(",");
  return `${method}:${argsStr}`;
}

/**
 * Retrieves a cached value if it exists and is not expired.
 */
function getCachedValue<T>(key: string, ttlMs: number = DEFAULT_CACHE_TTL_MS): T | null {
  const entry = contractCallCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > ttlMs) {
    contractCallCache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Stores a value in the cache.
 */
function setCachedValue<T>(key: string, value: T): void {
  contractCallCache.set(key, {
    value,
    timestamp: Date.now(),
  });
}

/**
 * Clears all cached contract call responses.
 */
export function clearContractCache(): void {
  contractCallCache.clear();
}

/**
 * Clears cache entries matching a specific method (e.g., "get_campaign").
 */
export function clearContractCacheByMethod(method: string): void {
  const keysToDelete: string[] = [];
  for (const key of contractCallCache.keys()) {
    if (key.startsWith(`${method}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => contractCallCache.delete(key));
}

/**
 * Discards the cached RPC client so the next call builds a fresh one.
 * Exported for tests and for callers that want to force a reconnect.
 */
export function resetRpcServer(): void {
  _server = null;
  _serverUrl = null;
  primaryDegradedUntil = 0;
}

/**
 * Drops all cached contract call results. Exported for tests and for callers
 * that need to bypass the response cache (e.g. after a wallet switch).
 */
export function clearContractCallCache(): void {
  contractCallCache.clear();
}

const CONNECTION_ERROR_PATTERNS = [
  "fetch failed",
  "failed to fetch",
  "network error",
  "networkerror",
  "load failed",
  "socket hang up",
  "econnrefused",
  "econnreset",
  "econnaborted",
  "epipe",
  "etimedout",
  "enotfound",
  "eai_again",
  // These three are deliberately broad. They also match a user-cancelled abort
  // and our own poll timeout, neither of which is a transport failure. The only
  // consequence is an unnecessary reconnect on the next call, which is cheaper
  // than holding on to a client that a real timeout has left unusable.
  "timeout",
  "timed out",
  "aborted",
];

/**
 * True when the failure looks like a transport problem (DNS, refused/reset
 * connection, timeout) rather than a response the RPC node actually produced.
 * Walks the `cause` chain because undici reports `TypeError: fetch failed`
 * with the real syscall error nested underneath.
 */
function isConnectionError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current === "object" && "code" in current) {
      const code = String((current as { code?: unknown }).code ?? "").toLowerCase();
      if (code && CONNECTION_ERROR_PATTERNS.includes(code)) return true;
    }
    const message = (current instanceof Error ? current.message : String(current)).toLowerCase();
    if (CONNECTION_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) return true;
    current = current instanceof Error ? current.cause : null;
  }
  return false;
}

/**
 * Runs an RPC call against the cached client. A transport-level failure leaves
 * the cached client unusable for every later call, so it is dropped before the
 * error propagates and the next call reconnects. Errors the node returned
 * (contract errors, bad requests) keep the client in place.
 *
 * When NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URL is set, a primary call that is
 * slower than RPC_LATENCY_THRESHOLD_MS or fails at the transport level is
 * retried on the fallback right away, and the fallback stays active for
 * RPC_PRIMARY_RETRY_AFTER_MS before the primary is tried again.
 */
const RPC_RETRY_DELAYS_MS = [500, 1_000, 2_000];

async function withRpcServer<T>(fn: (server: rpc.Server) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RPC_RETRY_DELAYS_MS.length; attempt += 1) {
    const onPrimary = Boolean(SOROBAN_RPC_FALLBACK_URL) && getActiveRpcUrl() === SOROBAN_RPC_URL;
    const server = getServer();
    try {
      return await (onPrimary ? withLatencyBudget(Promise.resolve(fn(server))) : fn(server));
    } catch (error) {
      lastError = error;
      if (onPrimary && error instanceof RpcLatencyExceededError) {
        markPrimaryDegraded(`exceeded ${RPC_LATENCY_THRESHOLD_MS}ms`);
        continue;
      }
      if (!isConnectionError(error)) {
        throw error;
      }
      if (onPrimary) {
        markPrimaryDegraded("is unreachable");
        continue;
      }

      _server = null;
      _serverUrl = null;
      const retryDelay = RPC_RETRY_DELAYS_MS[attempt];
      if (retryDelay === undefined) {
        throw error;
      }
      await sleep(retryDelay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Account cache — avoids redundant getAccount() calls on rapid submissions
// ---------------------------------------------------------------------------

const ACCOUNT_CACHE_TTL_MS = 10_000;

interface CachedAccount {
  account: Account;
  fetchedAt: number;
  sequenceOnFetch: string;
}

const _accountCache = new Map<string, CachedAccount>();

/**
 * Fetch the Stellar account, returning a cached copy if it was fetched within
 * ACCOUNT_CACHE_TTL_MS and the sequence number hasn't diverged.
 * On sequence mismatch the cache entry is discarded and a fresh lookup is made.
 */
async function getCachedAccount(publicKey: string): Promise<Account> {
  const now = Date.now();
  const cached = _accountCache.get(publicKey);

  if (cached && now - cached.fetchedAt < ACCOUNT_CACHE_TTL_MS) {
    // Verify the in-memory sequence still matches the cached baseline so
    // rapid consecutive transactions (which bump the sequence locally) work
    // correctly without going back to the network each time.
    const currentSeq = cached.account.sequenceNumber();
    if (currentSeq === cached.sequenceOnFetch || currentSeq > cached.sequenceOnFetch) {
      return cached.account;
    }
    // Sequence mismatch — evict and re-fetch.
    _accountCache.delete(publicKey);
  }

  const fresh = await withRpcServer((server) => server.getAccount(publicKey));
  _accountCache.set(publicKey, {
    account: fresh,
    fetchedAt: now,
    sequenceOnFetch: fresh.sequenceNumber(),
  });
  return fresh;
}

/** Fail before campaign construction if the creator is not funded on Stellar. */
async function requireExistingCreatorAccount(publicKey: string): Promise<void> {
  try {
    await getCachedAccount(publicKey);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/404|not found|does not exist|resource missing/i.test(detail)) {
      throw new Error("Creator account does not exist on the Stellar network.");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers — transaction building & submission
// ---------------------------------------------------------------------------

async function buildAndSubmitTransaction(
  sourcePublicKey: string,
  contractOp: xdr.Operation,
  options?: TransactionLifecycleOptions,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const operation = options?.operation ?? "contract_invoke";

  options?.onStatus?.({ phase: "building" });
  let sourceAccount;
  try {
    sourceAccount = await getCachedAccount(sourcePublicKey);
  } catch (error) {
    recordObservabilityFailure(classifyRpcFailure(error, "getAccount"), { operation });
    // Evict any stale cache entry on failure.
    _accountCache.delete(sourcePublicKey);
    throw error;
  }

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  txBuilder.addOperation(contractOp);
  if (options?.memo) {
    txBuilder.addMemo(Memo.text(options.memo));
  }
  txBuilder.setTimeout(300);

  const builtTx = txBuilder.build();
  let simulated;
  try {
    simulated = await withRpcServer((server) => server.simulateTransaction(builtTx));
  } catch (error) {
    recordObservabilityFailure(classifyRpcFailure(error, "simulateTransaction"), { operation });
    throw error;
  }

  if (rpc.Api.isSimulationError(simulated)) {
    const simulationError = normalizeContractError(simulated, "Transaction simulation failed.");
    recordObservabilityFailure(classifySimulationFailure(simulationError, operation), {
      operation,
    });
    throw simulationError;
  }

  const preparedTx = rpc
    .assembleTransaction(builtTx, simulated as rpc.Api.SimulateTransactionSuccessResponse)
    .build();

  options?.onStatus?.({ phase: "signing" });
  let signedTxXdr: string;
  try {
    signedTxXdr = await signTransactionXdr(preparedTx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
  } catch (error) {
    wrapFreighterError(error);
  }

  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE) as Transaction;

  options?.onStatus?.({ phase: "submitting" });
  let submissionResult;
  try {
    submissionResult = await withRpcServer((server) => server.sendTransaction(signedTx));
  } catch (error) {
    recordObservabilityFailure(classifyRpcFailure(error, "sendTransaction"), { operation });
    throw error;
  }

  if (submissionResult.status === "ERROR") {
    options?.onStatus?.({ phase: "failed", rpcStatus: submissionResult.status });
    recordObservabilityKind("submission_failure", "Transaction submission failed.", {
      operation,
      rpcStatus: submissionResult.status,
    });
    throw normalizeContractError(submissionResult, "Transaction submission failed.");
  }

  const txHash = submissionResult.hash;
  options?.onStatus?.({ phase: "confirming", txHash, rpcStatus: submissionResult.status });

  const timeoutMs = options?.timeoutMs ?? 90_000;
  const startedAt = Date.now();
  let pollDelay = 1_000;
  let getResult;
  try {
    getResult = await withRpcServer((server) => server.getTransaction(txHash));
  } catch (error) {
    recordObservabilityFailure(classifyRpcFailure(error, "getTransaction"), {
      operation,
      txHash,
    });
    throw error;
  }

  while (getResult.status === "NOT_FOUND") {
    if (Date.now() - startedAt >= timeoutMs) {
      options?.onStatus?.({ phase: "failed", txHash, rpcStatus: getResult.status });
      recordObservabilityKind("confirmation_timeout", "Transaction confirmation timed out.", {
        operation,
        rpcStatus: getResult.status,
        txHash,
      });
      throw new Error("Transaction confirmation timed out.");
    }
    await sleep(pollDelay);
    pollDelay = Math.min(Math.round(pollDelay * 1.5), 6_000);
    try {
      getResult = await withRpcServer((server) => server.getTransaction(txHash));
    } catch (error) {
      recordObservabilityFailure(classifyRpcFailure(error, "getTransaction"), {
        operation,
        txHash,
      });
      throw error;
    }
  }

  if (getResult.status === "FAILED") {
    options?.onStatus?.({ phase: "failed", txHash, rpcStatus: getResult.status });
    recordObservabilityKind("confirmation_failed", "Transaction failed on-chain.", {
      operation,
      rpcStatus: getResult.status,
      txHash,
    });
    throw normalizeContractError(getResult, "Transaction failed on-chain.");
  }

  options?.onStatus?.({ phase: "confirmed", txHash, rpcStatus: getResult.status });
  recordObservabilitySuccess(operation, txHash);
  return getResult as rpc.Api.GetSuccessfulTransactionResponse;
}

function emitMockLifecycle(txHash: string, options?: TransactionLifecycleOptions): string {
  options?.onStatus?.({ phase: "building", txHash });
  options?.onStatus?.({ phase: "signing", txHash });
  options?.onStatus?.({ phase: "submitting", txHash });
  options?.onStatus?.({ phase: "confirming", txHash, rpcStatus: "SUCCESS" });
  options?.onStatus?.({ phase: "confirmed", txHash, rpcStatus: "SUCCESS" });
  return txHash;
}

async function invokeViewMethod(method: string, args: xdr.ScVal[] = []): Promise<xdr.ScVal | null> {
  // Check cache first
  const cacheKey = getCacheKey(method, args);
  const cached = getCachedValue<xdr.ScVal | null>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const contract = new Contract(CONTRACT_ADDRESS);

  const zeroKeyPair = Keypair.random();
  const zeroAccount = new Account(zeroKeyPair.publicKey(), "0");

  const txBuilder = new TransactionBuilder(zeroAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  txBuilder.addOperation(contract.call(method, ...args));
  txBuilder.setTimeout(30);

  const tx = txBuilder.build();
  let simulated;
  try {
    simulated = await withRpcServer((server) => server.simulateTransaction(tx));
  } catch (error) {
    recordObservabilityFailure(classifyRpcFailure(error, `simulateTransaction:${method}`), {
      operation: method,
    });
    throw error;
  }

  if (rpc.Api.isSimulationError(simulated)) {
    const simulationError = normalizeContractError(simulated, `View call ${method} failed.`);
    recordObservabilityFailure(classifySimulationFailure(simulationError, method), {
      operation: method,
    });
    throw simulationError;
  }

  const successSim = simulated as rpc.Api.SimulateTransactionSuccessResponse;
  const result = successSim.result?.retval ?? null;

  // Cache the result
  setCachedValue(cacheKey, result);

  return result;
}

// ---------------------------------------------------------------------------
// XDR ↔ TypeScript decoders
// ---------------------------------------------------------------------------

function decodeCampaign(val: xdr.ScVal): Campaign {
  const map = val.map();
  if (!map) throw new Error("Expected ScVal map for Campaign.");

  const fields: Record<string, xdr.ScVal> = {};
  for (const entry of map) {
    const key = entry.key().sym().toString();
    fields[key] = entry.val();
  }

  const funding_goal = scValToBigInt(fields["funding_goal"]);
  const deadline = Number(fields["deadline"].u64());
  const amount_raised = scValToBigInt(fields["amount_raised"]);
  const is_active = fields["is_active"].b();
  const funds_withdrawn = fields["funds_withdrawn"].b();
  const is_cancelled = fields["is_cancelled"].b();
  const is_verified = fields["is_verified"].b();

  let rawDescription = fields["description"].str().toString();
  let cover_image_url: string | undefined = undefined;
  let milestones: Milestone[] | undefined = undefined;
  // Contract fields carry no `tags`; fall back to that key only for older/mock
  // records that may have stored it directly, otherwise default to [].
  let tags: string[] = fields["tags"]
    ? fields["tags"].vec().map((v: xdr.ScVal) => v.str().toString())
    : [];

  const EXT_MARKER = "\n\n===POH_EXT===\n";
  const extIndex = rawDescription.indexOf(EXT_MARKER);
  if (extIndex !== -1) {
    try {
      const extData = JSON.parse(rawDescription.substring(extIndex + EXT_MARKER.length));
      cover_image_url = extData.coverImageUrl;
      if (extData.milestones && Array.isArray(extData.milestones)) {
        milestones = extData.milestones.map(
          (m: { targetAmount: string | number; description: string }) => ({
            targetAmount: BigInt(m.targetAmount),
            description: m.description,
          }),
        );
      }
      if (extData.tags && Array.isArray(extData.tags)) {
        tags = extData.tags;
      }
    } catch (e) {
      console.warn("Failed to parse campaign extension data", e);
    }
    rawDescription = rawDescription.substring(0, extIndex);
  }

  return {
    id: fields["id"].u32(),
    creator: Address.fromScVal(fields["creator"]).toString(),
    title: fields["title"].str().toString(),
    description: rawDescription,
    funding_goal,
    deadline,
    amount_raised,
    is_active,
    status: deriveStatus({
      is_cancelled,
      is_verified,
      is_active,
      funds_withdrawn,
      deadline,
      amount_raised,
      funding_goal,
    }),
    created_at: Number(fields["created_at"].u64()),
    funds_withdrawn,
    is_cancelled,
    is_verified,
    category: fields["category"].u32() as Category,
    has_revenue_sharing: fields["has_revenue_sharing"].b(),
    revenue_share_percentage: fields["revenue_share_percentage"].u32(),
    tags,
    cover_image_url,
    milestones,
  };
}

// Exposed for targeted unit tests of XDR decoding behavior.
export const __testUtils = {
  decodeCampaign,
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeMockCampaign(partial: Omit<Campaign, "status">): Campaign {
  return {
    ...partial,
    status: deriveStatus(partial) as CampaignStatus,
  };
}

const MOCK_TIMESTAMP_SEC = 1700000000;

const MOCK_CAMPAIGNS: Campaign[] = [
  makeMockCampaign({
    id: 1,
    title: "Clean Water for Rural Communities",
    description: "Providing clean water access to 500 families in rural areas affected by drought.",
    creator: "GABC123456789012345678901234567890123456789012345678901234567890",
    funding_goal: BigInt(100_000_000_000),
    deadline: MOCK_TIMESTAMP_SEC + 86400 * 30,
    amount_raised: BigInt(65_000_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: true,
    category: Category.Learner,
    has_revenue_sharing: false,
    created_at: MOCK_TIMESTAMP_SEC,
    revenue_share_percentage: 0,
    tags: ["water", "rural", "health"],
    latitude: -1.2921,
    longitude: 36.8219,
    milestones: [
      { targetAmount: BigInt(25_000_000_000), description: "First 100 families connected" },
      { targetAmount: BigInt(50_000_000_000), description: "Next 200 families connected" },
      { targetAmount: BigInt(75_000_000_000), description: "Final 200 families connected" },
    ],
  }),
  makeMockCampaign({
    id: 2,
    title: "Education Technology for Underprivileged Children",
    description: "Equipping schools in low-income areas with tablets and educational software.",
    creator: "GDEF123456789012345678901234567890123456789012345678901234567890",
    funding_goal: BigInt(50_000_000_000),
    deadline: MOCK_TIMESTAMP_SEC + 86400 * 60,
    amount_raised: BigInt(12_000_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    created_at: MOCK_TIMESTAMP_SEC,
    category: Category.EducationalStartup,
    has_revenue_sharing: true,
    revenue_share_percentage: 500,
    tags: ["education", "tech", "children"],
    latitude: 28.6139,
    longitude: 77.209,
  }),
  makeMockCampaign({
    id: 3,
    title: "Medical Supplies for Remote Clinics",
    description: "Delivering essential medical supplies to clinics in remote areas.",
    creator: "GHIJ123456789012345678901234567890123456789012345678901234567890",
    funding_goal: BigInt(150_000_000_000),
    deadline: MOCK_TIMESTAMP_SEC + 86400 * 15,
    amount_raised: BigInt(89_000_000_000),
    is_active: true,
    created_at: MOCK_TIMESTAMP_SEC,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: true,
    category: Category.Educator,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    tags: ["medical", "clinic", "rural"],
    latitude: -3.3818,
    longitude: 29.3622,
  }),
  makeMockCampaign({
    id: 4,
    title: "Reforestation of Degraded Lands",
    description: "Planting 100,000 trees across deforested regions.",
    creator: "GKLM123456789012345678901234567890123456789012345678901234567890",
    funding_goal: BigInt(80_000_000_000),
    deadline: MOCK_TIMESTAMP_SEC - 86400 * 5,
    amount_raised: BigInt(32_000_000_000),
    is_active: false,
    funds_withdrawn: false,
    is_cancelled: false,
    created_at: MOCK_TIMESTAMP_SEC,
    is_verified: true,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    latitude: -9.5316,
    longitude: 147.4112,
  }),
  makeMockCampaign({
    id: 5,
    title: "Mental Health Support for Youth",
    description: "Building free counselling centres for teenagers in underserved areas.",
    creator: "GNOP123456789012345678901234567890123456789012345678901234567890",
    funding_goal: BigInt(60_000_000_000),
    deadline: MOCK_TIMESTAMP_SEC + 86400 * 45,
    amount_raised: BigInt(9_000_000_000),
    is_active: true,
    created_at: MOCK_TIMESTAMP_SEC,
    funds_withdrawn: false,
    is_cancelled: true,
    is_verified: false,
    category: Category.Publisher,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  }),
  makeMockCampaign({
    id: 6,
    title: "Solar Energy for Off-Grid Villages",
    description: "Installing solar panels in 20 villages without electricity.",
    creator: "GQRS123456789012345678901234567890123456789012345678901234567890",
    funding_goal: BigInt(200_000_000_000),
    deadline: MOCK_TIMESTAMP_SEC - 86400 * 2,
    amount_raised: BigInt(200_000_000_000),
    is_active: false,
    created_at: MOCK_TIMESTAMP_SEC,
    funds_withdrawn: true,
    is_cancelled: false,
    is_verified: true,
    category: Category.EducationalStartup,
    has_revenue_sharing: true,
    revenue_share_percentage: 300,
    latitude: 6.5244,
    longitude: 7.5162,
  }),
];

// #593 — a handful of hand-written campaigns isn't enough to exercise
// virtual scrolling / infinite pagination in dev mode. Extend the curated
// set with a deterministic, generated batch so `NEXT_PUBLIC_USE_MOCKS=true`
// has 100+ campaigns to page through, same as production eventually will.
const GENERATED_MOCK_COUNT = 114;
const CATEGORY_CYCLE = Object.values(Category).filter((v): v is Category => typeof v === "number");

for (let i = 0; i < GENERATED_MOCK_COUNT; i++) {
  const id = MOCK_CAMPAIGNS.length + 1;
  MOCK_CAMPAIGNS.push(
    makeMockCampaign({
      id,
      title: `Community Project #${id}`,
      description: `Generated mock campaign #${id} for exercising pagination and virtual scrolling.`,
      creator:
        `GMOCK${String(id).padStart(4, "0")}56789012345678901234567890123456789012345678901234567890`.slice(
          0,
          56,
        ),
      funding_goal: BigInt(10_000_000_000 + id * 1_000_000_000),
      deadline: MOCK_TIMESTAMP_SEC + 86400 * (10 + (id % 60)),
      amount_raised: BigInt((id % 7) * 3_000_000_000),
      is_active: id % 11 !== 0,
      funds_withdrawn: false,
      is_cancelled: id % 17 === 0,
      is_verified: id % 3 !== 0,
      created_at: MOCK_TIMESTAMP_SEC + id,
      category: CATEGORY_CYCLE[id % CATEGORY_CYCLE.length],
      has_revenue_sharing: id % 4 === 0,
      revenue_share_percentage: id % 4 === 0 ? 200 + (id % 5) * 100 : 0,
    }),
  );
}

// ---------------------------------------------------------------------------
// Public API — Read (view) functions
// ---------------------------------------------------------------------------

/**
 * Number of campaigns fetched per page on the /causes list (issue #1150).
 * A larger initial page means the first viewport is filled in a single round-
 * trip and the MIN_ROWS_BEFORE_PREFETCH guard in VirtualizedCauseGrid is not
 * hit on first render, preventing the cascade-load of all pages upfront.
 * Operators can tune this via NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE without a code
 * change (e.g. lower it on mobile-only deployments with slower RPCs).
 */
export const DEFAULT_CAMPAIGNS_PAGE_SIZE: number =
  Number(process.env.NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE) > 0
    ? Number(process.env.NEXT_PUBLIC_CAMPAIGNS_PAGE_SIZE)
    : 20;

/** Contract-enforced page size cap (LIST_MAX_LIMIT) for every paginated view. */
export const LIST_MAX_LIMIT = 50;

export interface CampaignsPage {
  campaigns: Campaign[];
  /**
   * Opaque cursor for the next page, or null once the listing is exhausted.
   * Unfiltered listings use "next campaign id" (1-based); category/creator
   * listings use a zero-based position in that index. Seed the first page with
   * `initialCampaignsCursor(filters)`.
   */
  nextCursor: number | null;
}

export interface ListCampaignsParams {
  cursor?: number;
  limit?: number;
  /** Uses the contract's `get_campaigns_by_category` index. */
  category?: Category;
  /** Uses the contract's `get_creator_campaigns` index. */
  creator?: string;
}

/** First cursor to pass to `listCampaigns` for a given filter combination. */
export function initialCampaignsCursor(filters: { category?: Category; creator?: string } = {}) {
  return filters.category !== undefined || filters.creator ? 0 : 1;
}

/** Decodes a `(Vec<Campaign>, u32)` page tuple returned by the paginated views. */
function decodeCampaignPage(result: xdr.ScVal | null): { campaigns: Campaign[]; next: number } {
  const [page, next] = result?.vec() ?? [];
  if (!page || !next) return { campaigns: [], next: 0 };
  const campaigns = (page.vec() ?? []).map((c) => decodeCampaign(c));
  return { campaigns, next: next.u32() };
}

/**
 * Cursor-paginated campaign listing. Each call issues exactly ONE contract
 * view (never one per campaign):
 *  - no filter        -> `list_campaigns(start, limit)`
 *  - `category`       -> `get_campaigns_by_category(category, offset, limit)`
 *  - `creator`        -> `get_creator_campaigns(creator, start, limit)`
 * Loading N visible campaigns therefore costs at most ceil(N / LIST_MAX_LIMIT)
 * RPC simulations.
 */
export async function listCampaigns({
  cursor,
  limit = DEFAULT_CAMPAIGNS_PAGE_SIZE,
  category,
  creator,
}: ListCampaignsParams = {}): Promise<CampaignsPage> {
  const filtered = category !== undefined || !!creator;
  const position = cursor ?? initialCampaignsCursor({ category, creator });
  const pageLimit = Math.max(1, Math.min(limit, LIST_MAX_LIMIT));

  if (USE_MOCKS) {
    const source = filtered
      ? MOCK_CAMPAIGNS.filter(
          (c) =>
            (category === undefined || c.category === category) &&
            (!creator || c.creator === creator),
        )
      : MOCK_CAMPAIGNS;
    const startIndex = filtered ? position : position - 1;
    const campaigns = source.slice(startIndex, startIndex + pageLimit);
    const nextCursor = startIndex + pageLimit < source.length ? position + pageLimit : null;
    return { campaigns, nextCursor };
  }

  try {
    if (!filtered) {
      // list_campaigns' `start` is an exclusive id cursor; our cursor is "next id".
      const result = await invokeViewMethod("list_campaigns", [
        nativeToScVal(Math.max(0, position - 1), { type: "u32" }),
        nativeToScVal(pageLimit, { type: "u32" }),
      ]);
      const { campaigns, next } = decodeCampaignPage(result);
      const exhausted = campaigns.length < pageLimit || next + 1 <= position;
      return { campaigns, nextCursor: exhausted ? null : next + 1 };
    }

    const result = creator
      ? await invokeViewMethod("get_creator_campaigns", [
          new Address(creator).toScVal(),
          nativeToScVal(position, { type: "u32" }),
          nativeToScVal(pageLimit, { type: "u32" }),
        ])
      : await invokeViewMethod("get_campaigns_by_category", [
          nativeToScVal(category, { type: "u32" }),
          nativeToScVal(position, { type: "u32" }),
          nativeToScVal(pageLimit, { type: "u32" }),
        ]);
    const { campaigns: indexed, next } = decodeCampaignPage(result);
    // The creator index has no category filter; narrow it client-side when both are set.
    const campaigns =
      creator && category !== undefined ? indexed.filter((c) => c.category === category) : indexed;
    const exhausted = indexed.length < pageLimit || next <= position;
    return { campaigns, nextCursor: exhausted ? null : next };
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export interface ContractPlatformStats {
  totalCampaigns: number;
  activeCampaigns: number;
  verifiedCampaigns: number;
  cancelledCampaigns: number;
  totalAmountRaised: bigint;
  /** True when the contract flags its counters as inconsistent. */
  statsArePartial: boolean;
}

/** Aggregate counts from `get_platform_stats` — one RPC call, no campaign scan. */
export async function getPlatformStats(): Promise<ContractPlatformStats> {
  if (USE_MOCKS) {
    return {
      totalCampaigns: MOCK_CAMPAIGNS.length,
      activeCampaigns: MOCK_CAMPAIGNS.filter((c) => c.is_active && !c.is_cancelled).length,
      verifiedCampaigns: MOCK_CAMPAIGNS.filter((c) => c.is_verified).length,
      cancelledCampaigns: MOCK_CAMPAIGNS.filter((c) => c.is_cancelled).length,
      totalAmountRaised: MOCK_CAMPAIGNS.reduce((sum, c) => sum + c.amount_raised, BigInt(0)),
      statsArePartial: false,
    };
  }
  try {
    const result = await invokeViewMethod("get_platform_stats");
    const map = result?.map();
    if (!map) throw new Error("Expected ScVal map for PlatformStats.");
    const fields: Record<string, xdr.ScVal> = {};
    for (const entry of map) fields[entry.key().sym().toString()] = entry.val();
    const field = (name: string): xdr.ScVal => {
      const value = fields[name];
      if (!value) throw new Error(`PlatformStats is missing ${name}.`);
      return value;
    };
    return {
      totalCampaigns: field("total_campaigns").u32(),
      activeCampaigns: field("active_campaigns").u32(),
      verifiedCampaigns: field("verified_campaigns").u32(),
      cancelledCampaigns: field("cancelled_campaigns").u32(),
      totalAmountRaised: scValToBigInt(field("total_amount_raised")),
      statsArePartial: fields["stats_are_partial"]?.b() ?? false,
    };
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getCampaignCount(): Promise<number> {
  if (USE_MOCKS) return MOCK_CAMPAIGNS.length;
  try {
    const result = await invokeViewMethod("get_campaign_count");
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getCampaign(id: number): Promise<Campaign | null> {
  if (USE_MOCKS) return MOCK_CAMPAIGNS.find((c) => c.id === id) ?? null;
  try {
    const result = await invokeViewMethod("get_campaign", [nativeToScVal(id, { type: "u32" })]);
    if (!result) return null;
    return decodeCampaign(result);
  } catch (err) {
    const code = getContractErrorCode(err);
    if (code === ContractError.CampaignNotFound) return null;
    throw new Error(parseContractError(err));
  }
}

/**
 * Loads every campaign by walking `list_campaigns` in LIST_MAX_LIMIT pages
 * (sequentially) — ceil(N / 50) RPC calls instead of one per campaign.
 * Prefer `listCampaigns` / `useInfiniteCampaigns` for user-facing lists.
 */
export async function getAllCampaigns(): Promise<Campaign[]> {
  if (USE_MOCKS) return [...MOCK_CAMPAIGNS];
  const all: Campaign[] = [];
  let cursor: number | null = 1;
  while (cursor !== null) {
    const page: CampaignsPage = await listCampaigns({ cursor, limit: LIST_MAX_LIMIT });
    all.push(...page.campaigns);
    cursor = page.nextCursor;
  }
  return all;
}

export async function getContribution(campaignId: number, contributor: string): Promise<bigint> {
  if (USE_MOCKS) return BigInt(0);
  try {
    const result = await invokeViewMethod("get_contribution", [
      nativeToScVal(campaignId, { type: "u32" }),
      new Address(contributor).toScVal(),
    ]);
    if (!result) return BigInt(0);
    return scValToBigInt(result);
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Fetch the personal contribution cap for a contributor on a specific campaign.
 * Returns the cap in stroops, or 0 if no cap is set (unlimited).
 */
export async function getPersonalCap(campaignId: number, contributor: string): Promise<bigint> {
  if (USE_MOCKS) return BigInt(0);
  try {
    const result = await invokeViewMethod("get_personal_cap", [
      nativeToScVal(campaignId, { type: "u32" }),
      new Address(contributor).toScVal(),
    ]);
    if (!result) return BigInt(0);
    return scValToBigInt(result);
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getRevenuePool(campaignId: number): Promise<bigint> {
  if (USE_MOCKS) return BigInt(0);
  try {
    const result = await invokeViewMethod("get_revenue_pool", [
      nativeToScVal(campaignId, { type: "u32" }),
    ]);
    if (!result) return BigInt(0);
    return scValToBigInt(result);
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getRevenueClaimed(campaignId: number, contributor: string): Promise<bigint> {
  if (USE_MOCKS) return BigInt(0);
  try {
    const result = await invokeViewMethod("get_revenue_claimed", [
      nativeToScVal(campaignId, { type: "u32" }),
      new Address(contributor).toScVal(),
    ]);
    if (!result) return BigInt(0);
    return scValToBigInt(result);
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

// ---------------------------------------------------------------------------
// Milestone payout plan (#783 / issue #1672)
// Mirrors the on-chain Milestone struct: { id, description, payout_bps, verified }
// ---------------------------------------------------------------------------

export const BPS_DENOMINATOR = 10_000;
const BPS_CEIL_OFFSET = 9_999;

function decodeMilestone(val: xdr.ScVal): ContractMilestone {
  const map = val.map();
  if (!map) throw new Error("Expected ScVal map for Milestone.");
  const fields: Record<string, xdr.ScVal> = {};
  for (const entry of map) {
    const key = entry.key().sym().toString();
    fields[key] = entry.val();
  }
  return {
    id: fields["id"].u32(),
    description: fields["description"].str().toString(),
    payout_bps: fields["payout_bps"].u32(),
    verified: fields["verified"].b(),
  };
}

/**
 * Fetch the on-chain milestone payout plan for `campaignId`.
 * Returns an empty array when the creator has not set a plan.
 */
export async function getMilestones(campaignId: number): Promise<ContractMilestone[]> {
  if (USE_MOCKS) return [];
  try {
    const result = await invokeViewMethod("get_milestones", [
      nativeToScVal(campaignId, { type: "u32" }),
    ]);
    return result?.vec()?.map(decodeMilestone) ?? [];
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Whether milestone `milestoneId` of `campaignId` has already claimed its payout.
 */
export async function isMilestoneClaimed(
  campaignId: number,
  milestoneId: number,
): Promise<boolean> {
  if (USE_MOCKS) return false;
  try {
    const result = await invokeViewMethod("is_milestone_claimed", [
      nativeToScVal(campaignId, { type: "u32" }),
      nativeToScVal(milestoneId, { type: "u32" }),
    ]);
    return result?.b() ?? false;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * What the creator would receive when claiming a milestone of `payoutBps` out
 * of `amountRaised`, before any dust absorption on the final milestone.
 * Mirrors the contract's release math (ceil fee, floor claim).
 */
export function expectedMilestonePayout(
  amountRaised: bigint,
  payoutBps: number,
  feeBps: number,
): bigint {
  const feeTotal =
    (amountRaised * BigInt(feeBps) + BigInt(BPS_CEIL_OFFSET)) / BigInt(BPS_DENOMINATOR);
  const totalAfterFee = amountRaised - feeTotal;
  return (totalAfterFee * BigInt(payoutBps)) / BigInt(BPS_DENOMINATOR);
}

/**
 * Admin: mark milestone `milestoneId` of `campaignId` as verified.
 * Returns the transaction hash on success.
 */
export async function verifyMilestone(
  campaignId: number,
  milestoneId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_verify_milestone", options);
  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "verify_milestone",
    nativeToScVal(campaignId, { type: "u32" }),
    nativeToScVal(milestoneId, { type: "u32" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "verify_milestone",
    });
    // The plan's verified flags changed.
    clearContractCacheByMethod("get_milestones");
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Creator: claim the already-verified milestone `milestoneId` of `campaignId`.
 * Returns the transaction hash on success.
 */
export async function claimMilestone(
  campaignId: number,
  milestoneId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_claim_milestone", options);
  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "claim_milestone",
    nativeToScVal(campaignId, { type: "u32" }),
    nativeToScVal(milestoneId, { type: "u32" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "claim_milestone",
    });
    // Claimed flag and (on the final claim) campaign status both changed.
    clearContractCacheByMethod("get_milestones");
    clearContractCacheByMethod("is_milestone_claimed");
    clearContractCacheByMethod("get_campaign");
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function extendCampaignDeadline(
  campaignId: number,
  additionalDays: number,
): Promise<string> {
  if (additionalDays < 1 || additionalDays > 30) throw new Error("additionalDays must be 1..30");
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "extend_campaign_deadline",
    nativeToScVal(campaignId, { type: "u32" }),
    nativeToScVal(additionalDays, { type: "u64" }),
  );
  // Caller must be campaign creator; retrieve from wallet context if needed
  // For now use a placeholder — the UI layer should pass the connected wallet address via options
  const caller =
    typeof window !== "undefined"
      ? (window as any).__walletPublicKey ||
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
      : "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  try {
    const result = await buildAndSubmitTransaction(caller, op, {
      operation: "extend_campaign_deadline",
    } as any);
    return result.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getAdmin(): Promise<string> {
  if (USE_MOCKS) return "GADMIN123456789012345678901234567890123456789012345678901234567890";
  try {
    const result = await invokeViewMethod("get_admin");
    if (!result) return "";
    return Address.fromScVal(result).toString();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export const EXPECTED_CONTRACT_VERSION = 1;

/**
 * Fetches the contract version.
 */
export async function getVersion(): Promise<number> {
  if (USE_MOCKS) return 1;

  try {
    const result = await invokeViewMethod("get_version");
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Fetches the platform fee in basis points.
 */
export async function getPlatformFee(): Promise<number> {
  if (USE_MOCKS) return 250;

  try {
    const result = await invokeViewMethod("get_platform_fee");
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

// ---------------------------------------------------------------------------
// Public API — Write (mutate) functions
// ---------------------------------------------------------------------------

export async function init(
  admin: string,
  token: string,
  platformFee: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(admin);
  validateStellarAddress(token);
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_init", options);
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "init",
    new Address(admin).toScVal(),
    new Address(token).toScVal(),
    nativeToScVal(platformFee, { type: "u32" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(admin, op, { ...options, operation: "init" });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function createCampaign(
  creator: string,
  title: string,
  description: string,
  fundingGoal: bigint,
  durationDays: number,
  category: Category,
  hasRevenueSharing: boolean,
  revenueSharePercentage: number,
  tags: string[],
  options?: TransactionLifecycleOptions & { coverImageUrl?: string; milestones?: Milestone[] },
): Promise<string> {
  validateStellarAddress(creator);
  validateFundingGoal(fundingGoal);
  validateDuration(durationDays);
  if (hasRevenueSharing) {
    validateRevenueShare(revenueSharePercentage);
  }

  // Tags, cover images, and milestones are now stored on-chain as native fields
  // instead of being embedded in the description blob. This ensures they are
  // properly validated and accessible through the contract interface.
  // For backward compatibility, old campaigns with blob data can still be parsed
  // by decodeCampaign().
  const finalDescription = description;

  if (USE_MOCKS) {
    const txHash = emitMockLifecycle("mock_tx_create_campaign", options);
    MOCK_CAMPAIGNS.push(
      makeMockCampaign({
        id: MOCK_CAMPAIGNS.length + 1,
        creator,
        title,
        description: finalDescription,
        funding_goal: fundingGoal,
        deadline: MOCK_TIMESTAMP_SEC + durationDays * 86400,
        amount_raised: BigInt(0),
        is_active: true,
        created_at: MOCK_TIMESTAMP_SEC,
        funds_withdrawn: false,
        is_cancelled: false,
        is_verified: false,
        category,
        has_revenue_sharing: hasRevenueSharing,
        revenue_share_percentage: revenueSharePercentage,
        tags,
        cover_image_url: options?.coverImageUrl,
        milestones: options?.milestones,
      }),
    );
    return txHash;
  }

  await requireExistingCreatorAccount(creator);
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "create_campaign",
    new Address(creator).toScVal(),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(finalDescription, { type: "string" }),
    nativeToScVal(fundingGoal, { type: "i128" }),
    nativeToScVal(durationDays, { type: "u64" }),
    nativeToScVal(category, { type: "u32" }),
    nativeToScVal(hasRevenueSharing, { type: "bool" }),
    nativeToScVal(revenueSharePercentage, { type: "u32" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(creator, op, {
      ...options,
      operation: "create_campaign",
    });

    // Invalidate campaign count and list cache
    clearContractCacheByMethod("get_campaign_count");
    clearContractCacheByMethod("get_campaign");

    return txResult.txHash;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorCode = getContractErrorCode(err);
    captureTransactionError("create_campaign", 0, error, errorCode ? String(errorCode) : undefined);
    throw new Error(parseContractError(err));
  }
}

/**
 * Simulate the exact contribution operation and return the assembled
 * transaction fee. Soroban RPC derives this from CPU, memory, ledger reads and
 * writes, so callers no longer have to guess with a fixed "gas limit".
 */
export async function estimateContributeNetworkFee(
  campaignId: number,
  contributor: string,
  amount: bigint,
): Promise<bigint> {
  validateStellarAddress(contributor);
  validateAmount(amount);
  if (USE_MOCKS) return 100_000n;

  const cached = await getCachedAccount(contributor);
  // TransactionBuilder increments its source Account during build. Estimation
  // must not consume a sequence number from the shared submission cache.
  const source = new Account(cached.accountId(), cached.sequenceNumber());
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "contribute",
    nativeToScVal(campaignId, { type: "u32" }),
    new Address(contributor).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
  );
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(300)
    .build();

  const simulation = await withRpcServer((server) => server.simulateTransaction(transaction));
  if (rpc.Api.isSimulationError(simulation)) {
    throw normalizeContractError(simulation, "Unable to estimate transaction fee.");
  }

  const prepared = rpc
    .assembleTransaction(transaction, simulation as rpc.Api.SimulateTransactionSuccessResponse)
    .build();
  return BigInt(prepared.fee);
}

export async function contribute(
  campaignId: number,
  contributor: string,
  amount: bigint,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(contributor);
  validateAmount(amount);

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_contribute", options);
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "contribute",
    nativeToScVal(campaignId, { type: "u32" }),
    new Address(contributor).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(contributor, op, {
      ...options,
      operation: "contribute",
    });
    appendWalletTransaction({
      walletAddress: contributor,
      campaignId,
      action: "contribute",
      txHash: txResult.txHash,
    });

    // Invalidate cache for this campaign and contribution
    clearContractCacheByMethod("get_campaign");
    clearContractCacheByMethod("get_contribution");

    return txResult.txHash;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorCode = getContractErrorCode(err);
    captureTransactionError(
      "contribute",
      campaignId,
      error,
      errorCode ? String(errorCode) : undefined,
    );
    throw new Error(parseContractError(err));
  }
}

export async function withdrawFunds(
  campaignId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_withdraw_funds", options);
  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call("withdraw_funds", nativeToScVal(campaignId, { type: "u32" }));
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "withdraw_funds",
    });
    appendWalletTransaction({
      walletAddress: callerAddress,
      campaignId,
      action: "withdraw",
      txHash: txResult.txHash,
    });

    // Invalidate campaign cache as status changes after withdrawal
    clearContractCacheByMethod("get_campaign");

    return txResult.txHash;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorCode = getContractErrorCode(err);
    captureTransactionError(
      "withdraw_funds",
      campaignId,
      error,
      errorCode ? String(errorCode) : undefined,
    );
    throw new Error(parseContractError(err));
  }
}

/**
 * Cancel a campaign (creator only).
 * Returns the transaction hash on success.
 */
export async function cancelCampaign(
  campaignId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_cancel_campaign", options);
  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call("cancel_campaign", nativeToScVal(campaignId, { type: "u32" }));
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "cancel_campaign",
    });
    return txResult.txHash;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorCode = getContractErrorCode(err);
    captureTransactionError(
      "cancel_campaign",
      campaignId,
      error,
      errorCode ? String(errorCode) : undefined,
    );
    throw new Error(parseContractError(err));
  }
}

/**
 * Claim a refund from a cancelled or failed campaign.
 * Returns the transaction hash on success.
 */
export async function claimRefund(
  campaignId: number,
  contributor: string,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(contributor);
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_claim_refund", options);
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "claim_refund",
    nativeToScVal(campaignId, { type: "u32" }),
    new Address(contributor).toScVal(),
  );
  try {
    const txResult = await buildAndSubmitTransaction(contributor, op, {
      ...options,
      operation: "claim_refund",
    });
    appendWalletTransaction({
      walletAddress: contributor,
      campaignId,
      action: "claim_refund",
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorCode = getContractErrorCode(err);
    captureTransactionError(
      "claim_refund",
      campaignId,
      error,
      errorCode ? String(errorCode) : undefined,
    );
    throw new Error(parseContractError(err));
  }
}

export async function depositRevenue(
  campaignId: number,
  amount: bigint,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateAmount(amount);
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_deposit_revenue", options);
  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "deposit_revenue",
    nativeToScVal(campaignId, { type: "u32" }),
    nativeToScVal(amount, { type: "i128" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "deposit_revenue",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function claimRevenue(
  campaignId: number,
  contributor: string,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(contributor);
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_claim_revenue", options);
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "claim_revenue",
    nativeToScVal(campaignId, { type: "u32" }),
    new Address(contributor).toScVal(),
  );
  try {
    const txResult = await buildAndSubmitTransaction(contributor, op, {
      ...options,
      operation: "claim_revenue",
    });
    appendWalletTransaction({
      walletAddress: contributor,
      campaignId,
      action: "claim_revenue",
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Creator withdraws their retained share of the revenue pool. The contract
 * rejects with NoFundsToWithdraw once the entitlement is fully claimed.
 */
export async function claimCreatorRevenue(
  campaignId: number,
  creator: string,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(creator);
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_claim_creator_revenue", options);
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call("claim_creator_revenue", nativeToScVal(campaignId, { type: "u32" }));
  try {
    const txResult = await buildAndSubmitTransaction(creator, op, {
      ...options,
      operation: "claim_creator_revenue",
    });
    clearContractCacheByMethod("get_revenue_pool");
    clearContractCacheByMethod("get_revenue_claimed");
    appendWalletTransaction({
      walletAddress: creator,
      campaignId,
      action: "claim_revenue",
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

// ---------------------------------------------------------------------------
// On-chain bookmarks (issue #1674)
// ---------------------------------------------------------------------------

/** Contract limit (MAX_BOOKMARKS_PER_WALLET) on a wallet's saved list. */
export const MAX_BOOKMARKS_PER_WALLET = 10;

const mockBookmarks = new Map<string, number[]>();

function clearBookmarkCache(): void {
  clearContractCacheByMethod("get_saved_campaigns");
  clearContractCacheByMethod("get_saved_campaigns_count");
}

async function submitBookmarkTx(
  user: string,
  method: string,
  args: xdr.ScVal[],
  options?: TransactionLifecycleOptions,
): Promise<string> {
  const contract = new Contract(CONTRACT_ADDRESS);
  try {
    const txResult = await buildAndSubmitTransaction(user, contract.call(method, ...args), {
      ...options,
      operation: method,
    });
    clearBookmarkCache();
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/** Campaign ids the wallet has saved (the contract already drops cancelled campaigns). */
export async function getSavedCampaigns(user: string): Promise<number[]> {
  if (USE_MOCKS) return [...(mockBookmarks.get(user) ?? [])];
  try {
    const result = await invokeViewMethod("get_saved_campaigns", [new Address(user).toScVal()]);
    return (result?.vec() ?? []).map((v) => v.u32());
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getSavedCampaignsCount(user: string): Promise<number> {
  if (USE_MOCKS) return (mockBookmarks.get(user) ?? []).length;
  try {
    const result = await invokeViewMethod("get_saved_campaigns_count", [
      new Address(user).toScVal(),
    ]);
    return result ? result.u32() : 0;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function saveCampaign(
  user: string,
  campaignId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(user);
  if (USE_MOCKS) {
    const saved = mockBookmarks.get(user) ?? [];
    if (saved.includes(campaignId))
      throw new Error(
        parseContractError(new ContractErrorException(ContractError.CampaignAlreadyBookmarked)),
      );
    if (saved.length >= MAX_BOOKMARKS_PER_WALLET)
      throw new Error(
        parseContractError(new ContractErrorException(ContractError.BookmarkLimitReached)),
      );
    mockBookmarks.set(user, [...saved, campaignId]);
    return emitMockLifecycle("mock_tx_save_campaign", options);
  }
  return submitBookmarkTx(
    user,
    "save_campaign",
    [new Address(user).toScVal(), nativeToScVal(campaignId, { type: "u32" })],
    options,
  );
}

/** Saves many campaigns atomically in one transaction (used for local → wallet migration). */
export async function batchSaveCampaigns(
  user: string,
  campaignIds: number[],
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(user);
  if (USE_MOCKS) {
    const saved = mockBookmarks.get(user) ?? [];
    const merged = [...saved];
    for (const id of campaignIds) {
      if (merged.includes(id))
        throw new Error(
          parseContractError(new ContractErrorException(ContractError.CampaignAlreadyBookmarked)),
        );
      if (merged.length >= MAX_BOOKMARKS_PER_WALLET)
        throw new Error(
          parseContractError(new ContractErrorException(ContractError.BookmarkLimitReached)),
        );
      merged.push(id);
    }
    mockBookmarks.set(user, merged);
    return emitMockLifecycle("mock_tx_batch_save_campaigns", options);
  }
  return submitBookmarkTx(
    user,
    "batch_save_campaigns",
    [
      new Address(user).toScVal(),
      xdr.ScVal.scvVec(campaignIds.map((id) => nativeToScVal(id, { type: "u32" }))),
    ],
    options,
  );
}

export async function removeSavedCampaign(
  user: string,
  campaignId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(user);
  if (USE_MOCKS) {
    mockBookmarks.set(
      user,
      (mockBookmarks.get(user) ?? []).filter((id) => id !== campaignId),
    );
    return emitMockLifecycle("mock_tx_remove_saved_campaign", options);
  }
  return submitBookmarkTx(
    user,
    "remove_saved_campaign",
    [new Address(user).toScVal(), nativeToScVal(campaignId, { type: "u32" })],
    options,
  );
}

export async function clearSavedCampaigns(
  user: string,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(user);
  if (USE_MOCKS) {
    mockBookmarks.set(user, []);
    return emitMockLifecycle("mock_tx_clear_saved_campaigns", options);
  }
  return submitBookmarkTx(user, "clear_saved_campaigns", [new Address(user).toScVal()], options);
}

export async function verifyCampaign(
  campaignId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_verify_campaign", options);
  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call("verify_campaign", nativeToScVal(campaignId, { type: "u32" }));
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "verify_campaign",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Update the platform fee (admin only).
 */
export async function updatePlatformFee(
  platformFee: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_update_platform_fee", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call("update_platform_fee", nativeToScVal(platformFee, { type: "u32" }));

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "update_platform_fee",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Transfer the admin role to a new address (admin only).
 */
export async function updateAdmin(
  newAdmin: string,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(newAdmin);
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_update_admin", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call("update_admin", new Address(newAdmin).toScVal());

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "update_admin",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

// ---------------------------------------------------------------------------
// Voting functions — wired to real contract
// ---------------------------------------------------------------------------

export async function getApproveVotes(campaignId: number): Promise<number> {
  if (USE_MOCKS) return 0;
  try {
    const result = await invokeViewMethod("get_approve_votes", [
      nativeToScVal(campaignId, { type: "u32" }),
    ]);
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getRejectVotes(campaignId: number): Promise<number> {
  if (USE_MOCKS) return 0;
  try {
    const result = await invokeViewMethod("get_reject_votes", [
      nativeToScVal(campaignId, { type: "u32" }),
    ]);
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function hasVoted(campaignId: number, voter: string): Promise<boolean> {
  if (USE_MOCKS) return false;
  try {
    const result = await invokeViewMethod("has_voted", [
      nativeToScVal(campaignId, { type: "u32" }),
      new Address(voter).toScVal(),
    ]);
    if (!result) return false;
    return result.b();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getMinVotesQuorum(): Promise<number> {
  if (USE_MOCKS) return 10;
  try {
    const result = await invokeViewMethod("get_min_votes_quorum");
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getApprovalThresholdBps(): Promise<number> {
  if (USE_MOCKS) return 5000;
  try {
    const result = await invokeViewMethod("get_approval_threshold_bps");
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Whether an off-chain comment has been censured on-chain (#1682).
 *
 * The contract stores censure records keyed by an opaque 32-byte comment hash;
 * the frontend computes that hash with `hashComment` in `./commentHash`.
 * Unknown hashes read as not censured.
 */
export async function isCommentCensured(campaignId: number, commentHash: string): Promise<boolean> {
  if (USE_MOCKS) return false;
  try {
    const result = await invokeViewMethod("is_comment_censured", [
      nativeToScVal(campaignId, { type: "u32" }),
      xdr.ScVal.scvBytes(Buffer.from(commentHash, "hex")),
    ]);
    if (!result) return false;
    return result.b();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Set or update a personal contribution cap for a campaign.
 * Pass BigInt(0) to remove the cap (unlimited).
 * Returns the transaction hash on success.
 */
export async function setPersonalCap(
  campaignId: number,
  contributor: string,
  capAmount: bigint,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  validateStellarAddress(contributor);

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_personal_cap", options);
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_personal_cap",
    nativeToScVal(campaignId, { type: "u32" }),
    new Address(contributor).toScVal(),
    nativeToScVal(capAmount, { type: "i128" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(contributor, op, {
      ...options,
      operation: "set_personal_cap",
    });
    appendWalletTransaction({
      walletAddress: contributor,
      campaignId,
      action: "set_personal_cap",
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorCode = getContractErrorCode(err);
    captureTransactionError(
      "set_personal_cap",
      campaignId,
      error,
      errorCode ? String(errorCode) : undefined,
    );
    throw new Error(parseContractError(err));
  }
}

/**
 * Cast a vote on a campaign via Freighter wallet.
 * approve = true → upvote, approve = false → downvote.
 */
export async function voteOnCampaign(
  campaignId: number,
  voter: string,
  approve: boolean,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) {
    return emitMockLifecycle(
      `mock_tx_vote_${campaignId}_${approve ? "approve" : "reject"}`,
      options,
    );
  }
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "vote_on_campaign",
    nativeToScVal(campaignId, { type: "u32" }),
    new Address(voter).toScVal(),
    nativeToScVal(approve, { type: "bool" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(voter, op, {
      ...options,
      operation: "vote_on_campaign",
    });
    appendWalletTransaction({
      walletAddress: voter,
      campaignId,
      action: "vote",
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorCode = getContractErrorCode(err);
    captureTransactionError(
      "vote_on_campaign",
      campaignId,
      error,
      errorCode ? String(errorCode) : undefined,
    );
    throw new Error(parseContractError(err));
  }
}

/**
 * Trigger on-chain campaign verification using accumulated votes.
 * Can be called by anyone once quorum + threshold are met.
 */
export async function verifyCampaignWithVotes(
  campaignId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_verify_with_votes", options);
  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "verify_campaign_with_votes",
    nativeToScVal(campaignId, { type: "u32" }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "verify_campaign_with_votes",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

// ---------------------------------------------------------------------------
// Vesting reserve
// ---------------------------------------------------------------------------

export interface CampaignReserve {
  /** Reserve amount in stroops (i128). */
  amount: bigint;
  /** Unix timestamp (seconds) when the reserve becomes claimable. */
  release_timestamp: number;
  /** Whether the reserve has already been claimed. */
  released: boolean;
}

/**
 * Returns the vesting reserve status for a campaign, or null when no reserve
 * exists (i.e. the campaign did not use vesting withdrawal).
 *
 * Calls the contract view method `get_campaign_reserve(campaign_id)` which
 * returns `Option<{ amount: i128, release_timestamp: u64, released: bool }>`.
 */
export async function getCampaignReserve(campaignId: number): Promise<CampaignReserve | null> {
  if (USE_MOCKS) return null;
  try {
    const result = await invokeViewMethod("get_campaign_reserve", [
      nativeToScVal(campaignId, { type: "u32" }),
    ]);
    if (!result) return null;

    // The contract returns an Option — a void/unit ScVal means None.
    if (result.switch().name === "scvVoid") return null;

    // Decode the struct fields from the map ScVal.
    const map = result.map();
    if (!map) return null;

    let amount = BigInt(0);
    let release_timestamp = 0;
    let released = false;

    for (const entry of map) {
      const key = entry.key().sym();
      switch (key) {
        case "amount":
          amount = scValToBigInt(entry.val());
          break;
        case "release_timestamp":
          release_timestamp = Number(scValToBigInt(entry.val()));
          break;
        case "released":
          released = entry.val().b() ?? false;
          break;
      }
    }

    return { amount, release_timestamp, released };
  } catch {
    return null;
  }
}

/**
 * Claim the vesting reserve for a campaign (creator only, after release_timestamp).
 * Returns the transaction hash on success.
 */
export async function claimReserve(
  campaignId: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_claim_reserve", options);
  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call("withdraw_reserve", nativeToScVal(campaignId, { type: "u32" }));
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "claim_reserve",
    });
    appendWalletTransaction({
      walletAddress: callerAddress,
      campaignId,
      action: "claim_reserve",
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorCode = getContractErrorCode(err);
    captureTransactionError(
      "claim_reserve",
      campaignId,
      error,
      errorCode ? String(errorCode) : undefined,
    );
    throw new Error(parseContractError(err));
  }
}
